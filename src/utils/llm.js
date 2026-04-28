import { format, eachDayOfInterval, parseISO } from 'date-fns';

const API_BASE = 'https://tripai-api.athuspydy.workers.dev';

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

const makeLLMRequest = async (messages, temperature = 0.3, maxTokens = 6000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 300000);

  try {
    const response = await fetch(`${API_BASE}/api/generate`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, temperature, maxTokens })
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

const validateAndAdjustCosts = (itinerary, numPeople) => {
  let totalPerPerson = 0;
  let costBreakdown = {
    activities: 0,
    food: 0,
    transportation: 0
  };

  itinerary.days = itinerary.days.map(day => {
    const activitiesCost = day.activities.reduce((sum, act) => sum + (act.cost || 0), 0);
    const mealsCost = day.meals.reduce((sum, meal) => sum + (meal.cost || 0), 0);
    const transportCost = day.activities.reduce((sum, act) => sum + (act.transport?.cost || 0), 0);
    
    costBreakdown.activities += activitiesCost;
    costBreakdown.food += mealsCost;
    costBreakdown.transportation += transportCost;
    
    const dailyTotal = activitiesCost + mealsCost + transportCost;
    totalPerPerson += dailyTotal;
    
    return {
      ...day,
      dailyTotal
    };
  });

  return {
    ...itinerary,
    costBreakdown,
    perPersonTotal: totalPerPerson,
    groupTotal: totalPerPerson * numPeople
  };
};

export const generateItinerary = async (tripData) => {
  try {
    if (!tripData.destination || !tripData.dates?.start || !tripData.dates?.end || !tripData.budget) {
      throw new Error('Missing required trip data: Please fill in destination, dates, and budget');
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
    const budgetPerPerson = Math.floor(parseInt(tripData.budget) / parseInt(tripData.numPeople || 1));

    if (budgetPerPerson < 50) {
      throw new Error('Budget too low: Minimum $50 per person per day required');
    }

    const template = {
      days: [{
        date: formattedDates[0],
        activities: [{
          name: "Sample Activity",
          time: "09:00",
          description: "Activity description",
          cost: 50,
          coordinates: { lat: 0, lng: 0 },
          transport: { method: "taxi", duration: "20 min", cost: 10 }
        }],
        meals: [{
          type: "breakfast", time: "08:00", name: "Sample Restaurant",
          description: "Restaurant description", cost: 20
        }],
        dailyTotal: 80
      }]
    };

    const dayCount = formattedDates.length;
    const systemPrompt = `Generate a ${dayCount}-day travel itinerary for ${tripData.destination} in valid JSON matching this structure:
${JSON.stringify(template, null, 2)}

Rules:
- 2-3 activities + 3 meals per day
- Same-day activities must be in the same neighborhood (walking/short drive)
- Different days explore different areas of ${tripData.destination}
- Transport between activities: walk/taxi/local transit under 15 min
- All locations real with exact coordinates
- Realistic costs for ${tripData.destination}
- Activities between 8:00-22:00
- No duplicate places anywhere in the trip`;

    const userPrompt = `Budget: $${budgetPerPerson}/person/day for ${tripData.numPeople} people
Dates: ${formattedDates.join(', ')}
Interests: ${tripData.interests || 'general sightseeing'}

Generate the itinerary JSON now.`;

    const content = await makeLLMRequest([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ], 0.4, 6000);

    const cleanContent = content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid response format: No JSON object found');
    }

    const parsedContent = JSON.parse(jsonMatch[0]);
    const validatedItinerary = validateAndAdjustCosts(parsedContent, tripData.numPeople);

    const locations = validatedItinerary.days.flatMap(day => 
      day.activities.map(activity => ({
        name: activity.name,
        coordinates: activity.coordinates,
        description: activity.description
      }))
    );

    return {
      itinerary: validatedItinerary,
      locations
    };

  } catch (error) {
    console.error('Generation Error:', error);
    throw new Error(`Failed to generate valid itinerary: ${error.message}`);
  }
};
