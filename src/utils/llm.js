import { format, eachDayOfInterval, parseISO } from 'date-fns';

const FALLBACK_MODEL = 'qwen/qwen3.6-max-preview';

const getOpenRouterErrorMessage = (status, errorData) => {
  switch (status) {
    case 401:
      return 'Invalid API key. Please check your OpenRouter API key and try again.';
    case 429:
      return 'Too many requests. Wait a moment and try again.';
    case 402:
      return 'Your OpenRouter account is out of credits. Please top up at openrouter.ai.';
    case 408:
    case 504:
      return 'The model is taking too long. Try DeepSeek V4 Flash for faster results.';
    case 404:
      return `Model temporarily unavailable.`;
    default:
      return errorData.error?.message || `Failed to get response from API (HTTP ${status})`;
  }
};

const makeOpenRouterRequest = async (messages, temperature = 0.3, apiKey, model, useFallback = true) => {
  if (!apiKey) {
    throw new Error('Please provide a valid OpenRouter API key');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

  try {
    console.log('Making API request with messages:', messages);

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Trip.AI'
      },
      body: JSON.stringify({
        model: model || FALLBACK_MODEL,
        messages: messages,
        temperature: temperature,
        max_tokens: 4000,
        top_p: 1,
        include_reasoning: false,
        response_format: { type: "json_object" }
      })
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('API Error:', errorData);
      const message = getOpenRouterErrorMessage(response.status, errorData);

      // Auto-fallback to default model if selected model is unavailable
      if (response.status === 404 && useFallback && model && model !== FALLBACK_MODEL) {
        console.warn(`Model ${model} unavailable. Falling back to ${FALLBACK_MODEL}`);
        return makeOpenRouterRequest(messages, temperature, apiKey, FALLBACK_MODEL, false);
      }

      throw new Error(message);
    }

    const data = await response.json();
    console.log('API Response:', data);
    return data.choices[0].message.content;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timed out after 30 seconds. The model may be overloaded. Please try again or switch to a faster model.');
    }
    console.error('API Request Error:', error);
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
  // Extract API key and model from tripData
  const { apiKey, model, ...restTripData } = tripData;

  try {
    console.log('Generating itinerary with trip data:', tripData);

    // Validate required fields
    if (!tripData.destination || !tripData.dates?.start || !tripData.dates?.end || !tripData.budget) {
      throw new Error('Missing required trip data: Please fill in destination, dates, and budget');
    }

    // Validate dates
    const startDate = parseISO(restTripData.dates.start);
    const endDate = parseISO(restTripData.dates.end);

    if (startDate > endDate) {
      throw new Error('Invalid date range: End date must be on or after the start date');
    }

    const dateRange = eachDayOfInterval({
      start: startDate,
      end: endDate
    });

    if (!dateRange || dateRange.length === 0) {
      throw new Error('Invalid date range: Please select valid travel dates');
    }

    if (dateRange.length > 14) {
      throw new Error('Trip duration too long: Maximum 14 days supported');
    }

    const formattedDates = dateRange.map(date => format(date, 'yyyy-MM-dd'));
    const budgetPerPerson = Math.floor(parseInt(restTripData.budget) / parseInt(restTripData.numPeople || 1));

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
          transport: {
            method: "taxi",
            duration: "20 min",
            cost: 10
          }
        }],
        meals: [{
          type: "breakfast",
          time: "08:00",
          name: "Sample Restaurant",
          description: "Restaurant description",
          cost: 20
        }],
        dailyTotal: 80
      }]
    };

    const systemPrompt = `As a travel planning assistant, generate a detailed itinerary in JSON format. Follow this EXACT structure (replace sample values):
${JSON.stringify(template, null, 2)}

Important requirements:
1. All JSON must be valid and match the template structure exactly
2. All costs must be realistic for ${restTripData.destination}
3. All locations must be real and verifiable
4. Activities must be between 8:00-22:00
5. Include exact coordinates for each location
6. No duplicate activities or restaurants`;

    const userPrompt = `Create a ${formattedDates.length}-day itinerary for ${restTripData.destination}:
- Budget per person: $${budgetPerPerson}
- Dates: ${formattedDates.join(', ')}
- Number of people: ${restTripData.numPeople}
- Interests: ${restTripData.interests || 'general sightseeing'}

Requirements:
1. Each day needs 2-3 activities and 3 meals (breakfast, lunch, dinner)
2. Include exact coordinates for each activity
3. All activities between 8:00-22:00
4. Include transport details between locations
5. Stay within budget
6. No duplicate activities or restaurants

Return ONLY valid JSON matching the template structure exactly.`;

    console.log('Sending prompts to API');
    const content = await makeOpenRouterRequest([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ], 0.3, apiKey, model);

    console.log('Received content from API:', content);

    try {
      // Clean up the content
      const cleanContent = content
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      console.log('Cleaned content:', cleanContent);

      // Extract JSON
      const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('No JSON object found in content:', content);
        throw new Error('Invalid response format: No JSON object found');
      }

      const parsedContent = JSON.parse(jsonMatch[0]);
      const validatedItinerary = validateAndAdjustCosts(parsedContent, restTripData.numPeople);

      // Extract locations for map
      const locations = validatedItinerary.days.flatMap(day => 
        day.activities.map(activity => ({
          name: activity.name,
          coordinates: activity.coordinates,
          description: activity.description
        }))
      );

      console.log('Successfully generated itinerary');
      return {
        itinerary: validatedItinerary,
        locations
      };

    } catch (parseError) {
      console.error('Parsing Error:', parseError);
      console.error('Raw Content:', content);
      throw new Error(`Failed to parse itinerary: ${parseError.message}`);
    }
  } catch (error) {
    if (error.message.includes('API key')) {
      throw new Error('API Key Error: ' + error.message);
    }
    console.error('Generation Error:', error);
    throw new Error(`Failed to generate valid itinerary: ${error.message}`);
  }
};

export { makeOpenRouterRequest, validateAndAdjustCosts };