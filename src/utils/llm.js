import { format, eachDayOfInterval, parseISO } from 'date-fns';

const makeGroqRequest = async (messages, temperature = 0.3, apiKey) => {
  if (!apiKey) {
    throw new Error('Please provide a valid Groq API key');
  }

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "gemma2-9b-it",
        messages: messages,
        temperature: temperature,
        max_tokens: 4000,
        top_p: 1
      })
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Invalid API key. Please check your Groq API key and try again.');
      }
      throw new Error('Failed to get response from Groq API');
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
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
  // Extract API key from tripData
  const { apiKey, ...restTripData } = tripData;

  try {
    const dateRange = eachDayOfInterval({
      start: parseISO(restTripData.dates.start),
      end: parseISO(restTripData.dates.end)
    });

    const formattedDates = dateRange.map(date => format(date, 'yyyy-MM-dd'));
    const budgetPerPerson = Math.floor(parseInt(restTripData.budget) / parseInt(restTripData.numPeople || 1));

    const systemPrompt = `You are a travel planning assistant that MUST ONLY respond with valid JSON. Create realistic daily itineraries ensuring UNIQUE experiences each day.`;

    const userPrompt = `Create a ${formattedDates.length}-day itinerary for ${restTripData.destination}:
- Budget per person: $${budgetPerPerson}
- Dates: ${formattedDates.join(', ')}
- Number of people: ${restTripData.numPeople}
- Interests: ${restTripData.interests || 'general sightseeing'}

Required format:
{
  "days": [
    {
      "date": "YYYY-MM-DD",
      "activities": [
        {
          "name": "Activity name",
          "time": "HH:MM",
          "description": "Activity description",
          "cost": number,
          "coordinates": { "lat": number, "lng": number },
          "transport": {
            "method": "transport type",
            "duration": "duration",
            "cost": number
          }
        }
      ],
      "meals": [
        {
          "type": "breakfast|lunch|dinner",
          "time": "HH:MM",
          "name": "Restaurant name",
          "description": "Description",
          "cost": number
        }
      ]
    }
  ]
}`;

    try {
      const content = await makeGroqRequest([
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ], 0.3, apiKey);

      // Clean up the content
      const cleanContent = content
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      // Extract JSON object
      const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in response');
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

      return {
        itinerary: validatedItinerary,
        locations
      };

    } catch (error) {
      console.error('Parsing Error:', error);
      throw new Error('Failed to generate valid itinerary. Please try again.');
    }
  } catch (error) {
    if (error.message.includes('API key')) {
      throw new Error('API Key Error: ' + error.message);
    }
    console.error('Generation Error:', error);
    throw error;
  }
};

export { makeGroqRequest, validateAndAdjustCosts };