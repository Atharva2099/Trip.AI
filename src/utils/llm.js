import { format, eachDayOfInterval, parseISO } from 'date-fns';

// Helper function to extract all unique events
const extractUniqueEvents = (itinerary) => {
  if (!itinerary || !itinerary.days || !Array.isArray(itinerary.days)) {
    return new Set();
  }

  const uniqueEvents = new Set();
  
  itinerary.days.forEach(day => {
    if (day.activities && Array.isArray(day.activities)) {
      day.activities.forEach(activity => {
        if (activity && activity.name) {
          uniqueEvents.add(activity.name.toLowerCase());
        }
      });
    }
    if (day.meals && Array.isArray(day.meals)) {
      day.meals.forEach(meal => {
        if (meal && meal.name) {
          uniqueEvents.add(meal.name.toLowerCase());
        }
      });
    }
  });

  return uniqueEvents;
};

const makeGroqRequest = async (messages, temperature = 0.3) => {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.REACT_APP_GROQ_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: "llama3-8b-8192",
      messages: messages,
      temperature: temperature,
      max_tokens: 4000,
      top_p: 1,
      response_format: { type: "json_object" }
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('API Response Error:', errorData);
    throw new Error(errorData.error?.message || 'Failed to get response from Groq API');
  }

  const data = await response.json();

  if (!data?.choices?.[0]?.message?.content) {
    throw new Error("Invalid or empty response from API");
  }

  let content = data.choices[0].message.content;
  
  // Clean up the content
  try {
    // Remove any potential markdown code block syntax
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    
    // Find the first { and last }
    const firstBrace = content.indexOf('{');
    const lastBrace = content.lastIndexOf('}');
    
    if (firstBrace === -1 || lastBrace === -1) {
      throw new Error('No valid JSON object found in response');
    }
    
    content = content.slice(firstBrace, lastBrace + 1);
    
    // Validate JSON
    JSON.parse(content);
    
    return content;
  } catch (error) {
    console.error('JSON Parsing Error:', error);
    console.error('Raw Content:', content);
    throw new Error('JSON_PARSE_ERROR');
  }
};

// Helper function to validate and adjust costs
const validateAndAdjustCosts = (itinerary, numPeople) => {
  let totalPerPerson = 0;
  let costBreakdown = {};

  itinerary.days = itinerary.days.map(day => {
    const activitiesCost = day.activities.reduce((sum, act) => sum + (act.cost || 0), 0);
    const mealsCost = day.meals.reduce((sum, meal) => sum + (meal.cost || 0), 0);
    const dailyTotal = activitiesCost + mealsCost;
    
    totalPerPerson += dailyTotal;
    costBreakdown[day.date] = dailyTotal;
    
    return {
      ...day,
      dailyTotal
    };
  });

  const actualGroupTotal = totalPerPerson * numPeople;

  return {
    ...itinerary,
    perPersonTotal: totalPerPerson,
    groupTotal: actualGroupTotal,
    costBreakdown
  };
};

export const generateItinerary = async (tripData) => {
  console.log("Starting itinerary generation with data:", tripData);

  try {
    const dateRange = eachDayOfInterval({
      start: parseISO(tripData.dates.start),
      end: parseISO(tripData.dates.end)
    });

    const formattedDates = dateRange.map(date => format(date, 'yyyy-MM-dd'));
    const budgetPerPerson = Math.floor(parseInt(tripData.budget) / parseInt(tripData.numPeople || 1));
    
    const systemPrompt = `You are a travel planning assistant that MUST ONLY respond with valid JSON. Your task is to create realistic daily itineraries with accurate cost breakdowns for ${tripData.numPeople || 1} people, ensuring UNIQUE experiences each day. Rules:
1. Never repeat activities or restaurants across days
2. If suggesting similar activity types (e.g., temples, museums), each must be distinctly different and noteworthy
3. Distribute activity types evenly across the trip duration
4. For longer trips, explore different areas/neighborhoods each day
5. Maintain variety in cuisine types for meals
${tripData.interests ? `6. Focus on these interests while maintaining variety: ${tripData.interests}` : ''}

Calculate all costs per person and ensure they sum correctly. Each daily total must include all meals and activities. The final total must accurately reflect the sum of all daily costs multiplied by the number of people.`;

    const userPrompt = `Generate a detailed travel itinerary for ${tripData.destination}.
Trip Details:
- Number of People: ${tripData.numPeople || 1}
- Duration: ${formattedDates.length} days
- Start Date: ${formattedDates[0]}
- End Date: ${formattedDates[formattedDates.length - 1]}
- Budget Per Person: $${budgetPerPerson}
- Total Group Budget: $${tripData.budget}
- Interests: ${tripData.interests}
- Notes: ${tripData.additionalNotes || 'None'}

Required Elements Per Day:
1. Main Activities (2-3) with accurate individual costs
2. Three meals at local restaurants (breakfast, lunch, dinner)
3. Transportation between locations with per-person costs

Constraints:
1. Keep all locations within 50km of city center
2. Total cost per person must not exceed ${budgetPerPerson}
3. Use realistic local prices
4. Include exact coordinates
5. Activities between 8:00-22:00 only
6. All costs must be per person
7. Daily totals must include all meals and activities
8. Each activity and restaurant must be unique across all days
9. Final total must be the sum of all daily costs multiplied by ${tripData.numPeople || 1}`;

    let content;
    try {
      content = await makeGroqRequest([
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]);
    } catch (error) {
      if (error.message === 'JSON_PARSE_ERROR') {
        console.log("Retrying with simpler prompt...");
        const simplifiedUserPrompt = `Generate a travel itinerary for ${tripData.destination} with:
- ${formattedDates.length} days of activities
- Budget per person: $${budgetPerPerson}
- Include breakfast, lunch, and dinner each day
- 2-3 activities per day
- All costs must be accurate and within budget
Response must be valid JSON following this structure for each day:
{
  "days": [
    {
      "date": "YYYY-MM-DD",
      "activities": [{"name": "", "time": "", "description": "", "cost": 0, "coordinates": {"lat": 0, "lng": 0}}],
      "meals": [{"type": "", "time": "", "name": "", "description": "", "cost": 0}]
    }
  ]
}`;
        
        content = await makeGroqRequest([
          { role: "system", content: "You are a travel planning assistant. Only respond with valid JSON." },
          { role: "user", content: simplifiedUserPrompt }
        ], 0.2);
      } else {
        throw error;
      }
    }

    // Function to validate uniqueness
    const validateUniqueness = (content) => {
      try {
        // First check if we can parse the content
        let itinerary;
        try {
          itinerary = JSON.parse(content);
        } catch (error) {
          console.error('Failed to parse itinerary:', error);
          return false;
        }
    
        // Check if itinerary has the expected structure
        if (!itinerary || !itinerary.days || !Array.isArray(itinerary.days)) {
          console.error('Invalid itinerary structure');
          return false;
        }
    
        const uniqueEvents = new Set();
        const allEvents = [];
        
        itinerary.days.forEach(day => {
          // Check if activities exist and is an array
          if (day.activities && Array.isArray(day.activities)) {
            day.activities.forEach(activity => {
              if (activity && activity.name) {
                allEvents.push(activity.name.toLowerCase());
              }
            });
          }
          
          // Check if meals exist and is an array
          if (day.meals && Array.isArray(day.meals)) {
            day.meals.forEach(meal => {
              if (meal && meal.name) {
                allEvents.push(meal.name.toLowerCase());
              }
            });
          }
        });
    
        // Add all events to the uniqueEvents Set
        allEvents.forEach(event => uniqueEvents.add(event));
    
        // Compare counts to check for duplicates
        return uniqueEvents.size === allEvents.length;
      } catch (error) {
        console.error('Error in validateUniqueness:', error);
        return false;
      }
    };

    // If there are duplicates, regenerate with stronger uniqueness constraints
    if (!validateUniqueness(content)) {
      console.log("Detected duplicates, regenerating with stricter constraints...");
      
      const uniqueEvents = extractUniqueEvents(JSON.parse(content));
      const avoidList = Array.from(uniqueEvents).join(', ');

      const retryPrompt = `${userPrompt}\n\nIMPORTANT: Generate completely different activities and restaurants. DO NOT use any of these already used places: ${avoidList}`;

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.REACT_APP_GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: "llama3-8b-8192",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: retryPrompt }
          ],
          temperature: 0.4,
          max_tokens: 4000,
          top_p: 1,
          response_format: { type: "json_object" }
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('API Response Error:', errorData);
        throw new Error(errorData.error?.message || 'Failed to get response from Groq API');
      }

      const data = await response.json();

      if (!data?.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
        console.error('Invalid API response structure:', data);
        throw new Error("Invalid response from API");
      }

      content = data.choices[0].message.content;
    }

    try {
      content = content.substring(
        content.indexOf('{'),
        content.lastIndexOf('}') + 1
      );
      
      const parsedItinerary = JSON.parse(content);
      const validatedItinerary = validateAndAdjustCosts(parsedItinerary, tripData.numPeople || 1);

      const locations = validatedItinerary.days.flatMap(day => [
        ...day.activities.map(activity => ({
          name: activity.name,
          coordinates: activity.coordinates,
          description: activity.description
        })),
        ...day.meals.map(meal => ({
          name: meal.name,
          coordinates: meal.coordinates,
          description: `${meal.type} - ${meal.description}`
        }))
      ]);

      console.log("Validated itinerary:", validatedItinerary);

      return {
        itinerary: validatedItinerary,
        locations
      };

    } catch (parseError) {
      console.error("Failed to parse content:", content);
      console.error("Parse error:", parseError);
      throw new Error("Failed to parse LLM response. The model returned invalid JSON.");
    }
  } catch (error) {
    console.error("Detailed error in generateItinerary:", error);
    throw error;
  }
};

export { makeGroqRequest, validateAndAdjustCosts };