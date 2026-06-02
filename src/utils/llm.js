import { format, eachDayOfInterval, parseISO } from 'date-fns';
import { API_BASE } from '../config';
import { extractJson, validateAndAdjustCosts, buildPrompt } from './llmHelpers';

const getErrorMessage = (status, errorData) => {
  switch (status) {
    case 401:
      return 'Invalid API key. Please check your OpenRouter API key and try again.';
    case 429:
      return 'Too many requests. Wait a moment and try again.';
    case 402:
      return 'Your OpenRouter account is out of credits. Please top up at openrouter.ai.';
    case 408:
    case 504:
      return 'The model is taking too long. Please try again.';
    case 404:
      return `Model temporarily unavailable.`;
    default:
      return errorData?.error || `Failed to get response from API (HTTP ${status})`;
  }
};

const makeLLMRequest = async (messages, temperature, maxTokens, grounding, model, provider) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 300000);

  try {
    const response = await fetch(`${API_BASE}/api/generate`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, temperature, maxTokens, grounding, model, provider })
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(getErrorMessage(response.status, errorData));
    }

    const data = await response.json();
    return data.content;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timed out after 5 minutes. The model may be overloaded. Please try again.');
    }
    throw error;
  }
};

export const generateItinerary = async (tripData) => {
  try {
    if (!tripData.from || !tripData.destination || !tripData.dates?.start || !tripData.dates?.end || !tripData.budget) {
      throw new Error('Missing required trip data: Please fill in From, Destination, dates, and budget');
    }

    const startDate = parseISO(tripData.dates.start);
    const endDate = parseISO(tripData.dates.end);

    if (startDate > endDate) {
      throw new Error('Invalid date range: End date must be on or after the start date');
    }

    const dateRange = eachDayOfInterval({ start: startDate, end: endDate });

    if (!dateRange || dateRange.length === 0) {
      throw new Error('Invalid date range: Please select valid travel dates');
    }

    if (dateRange.length > 14) {
      throw new Error('Trip duration too long: Maximum 14 days supported');
    }

    const formattedDates = dateRange.map(date => format(date, 'yyyy-MM-dd'));
    const numPeople = parseInt(tripData.numPeople || 1);
    const budgetPerPerson = Math.floor(parseInt(tripData.budget) / numPeople);

    if (budgetPerPerson < 50) {
      throw new Error('Budget too low: Minimum $50 per person total required');
    }

    const fromName = typeof tripData.from === 'string' ? tripData.from : tripData.from?.fullName;
    if (!fromName) {
      throw new Error('Missing origin city');
    }

    const dayCount = formattedDates.length;
    const groupBudget = parseInt(tripData.budget);

    // The system prompt is built server-side after grounding. We send an
    // initial prompt without the web context; the worker fetches Exa and
    // prepends results before calling OpenRouter.
    const { systemPrompt, userPrompt } = buildPrompt({
      destination: tripData.destination,
      from: fromName,
      dates: tripData.dates,
      dayCount,
      groupBudget,
      numPeople,
      budgetPerPerson,
      formattedDates,
      interests: tripData.interests
    });

    const grounding = {
      destination: tripData.destination,
      home: fromName
    };

    const rawContent = await makeLLMRequest(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      0.3,
      5000,
      grounding,
      tripData.model,
      tripData.modelProvider
    );

    const parsed = extractJson(rawContent);
    if (!parsed) {
      throw new Error('Invalid response format: No JSON object found');
    }

    let validatedItinerary = validateAndAdjustCosts(parsed, numPeople);

    // Iterative budget enforcement.
    const MAX_TRIM_PASSES = 3;
    for (let attempt = 0; attempt < MAX_TRIM_PASSES && validatedItinerary.groupTotal > groupBudget; attempt++) {
      const overBy = validatedItinerary.groupTotal - groupBudget;
      const trimPrompt = `This itinerary is $${overBy} OVER the $${groupBudget} group budget (attempt ${attempt + 1} of ${MAX_TRIM_PASSES}).

Current itinerary:
${JSON.stringify(validatedItinerary.days.map(d => ({
  date: d.date,
  activities: d.activities.map(a => ({ name: a.name, cost: a.cost })),
  meals: d.meals.map(m => ({ name: m.name, cost: m.cost }))
})), null, 2)}

Trim this to stay UNDER $${groupBudget} total by:
1. Replacing expensive activities with cheaper or free alternatives
2. Replacing expensive meals with cheaper local spots
3. Reducing transport costs (consider switching from flight to train/bus for medium distances)
4. If needed, remove 1 activity from the most expensive day

Keep the SAME structure (including transport_to_destination, transport_back_home, accommodation_options). Return the trimmed JSON.`;

      const trimRaw = await makeLLMRequest(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: trimPrompt }
        ],
        0.3,
        5000,
        grounding,
        tripData.model,
        tripData.modelProvider
      );

      const trimParsed = extractJson(trimRaw);
      if (!trimParsed) break;
      validatedItinerary = validateAndAdjustCosts(trimParsed, numPeople);
    }

    if (validatedItinerary.groupTotal > groupBudget) {
      console.warn(
        `Itinerary is $${validatedItinerary.groupTotal - groupBudget} over budget after ${MAX_TRIM_PASSES} trim attempts`
      );
    }

    const locations = validatedItinerary.days.flatMap(day =>
      (day.activities || []).map(activity => ({
        name: activity.name,
        coordinates: activity.coordinates,
        description: activity.description
      }))
    );

    return { itinerary: validatedItinerary, locations };

  } catch (error) {
    console.error('Generation Error:', error);
    // Surface a friendlier message for the common 401 case so the user
    // doesn't stare at "User not found." wondering what's broken.
    const msg = String(error.message || '');
    if (/user not found|invalid api key|unauthorized|401/i.test(msg)) {
      throw new Error('OpenRouter rejected the API key. Set OPENROUTER_API_KEY in worker/.dev.vars and restart wrangler.');
    }
    if (/timed out|abort/i.test(msg)) {
      throw new Error('The model took too long. Try again, or pick a faster model from the dropdown.');
    }
    if (/rate|429/i.test(msg)) {
      throw new Error('Too many requests. Wait a few minutes and try again.');
    }
    if (/quota|credits|402/i.test(msg)) {
      throw new Error('OpenRouter account is out of credits. Top up at openrouter.ai.');
    }
    throw new Error(`Failed to generate valid itinerary: ${error.message}`);
  }
};
