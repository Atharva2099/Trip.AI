import { format, eachDayOfInterval, parseISO } from 'date-fns';

export const generateItinerary = async (tripData) => {
  console.log("Starting itinerary generation with data:", tripData);

  try {
    const dateRange = eachDayOfInterval({
      start: parseISO(tripData.dates.start),
      end: parseISO(tripData.dates.end)
    });

    const formattedDates = dateRange.map(date => format(date, 'yyyy-MM-dd'));
    const budgetPerPerson = Math.floor(parseInt(tripData.budget) / parseInt(tripData.numPeople || 1));
    
    const systemPrompt = `You are a travel planning assistant that MUST ONLY respond with valid JSON. Your task is to create realistic daily itineraries with accurate cost breakdowns for ${tripData.numPeople || 1} people. Calculate all costs per person and ensure they sum correctly. Each daily total must include all meals and activities. The final total must accurately reflect the sum of all daily costs multiplied by the number of people. Do not include any explanatory text or markdown formatting. The response must be a pure JSON object and nothing else. Focus only on providing realistic, verified information.`;

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
8. Final total must be the sum of all daily costs multiplied by ${tripData.numPeople || 1}

Respond with only this exact JSON structure:
{
  "days": [
    {
      "date": "${formattedDates[0]}",
      "activities": [
        {
          "time": "09:00",
          "name": "Example Location",
          "description": "Brief description",
          "cost": 50,
          "coordinates": {
            "lat": 37.7749,
            "lng": -122.4194
          },
          "transport": {
            "method": "subway",
            "duration": "20 mins",
            "cost": 3
          },
          "distance": 2.5
        }
      ],
      "meals": [
        {
          "type": "breakfast",
          "time": "08:00",
          "name": "Restaurant Name",
          "description": "Cuisine type",
          "cost": 25
        }
      ],
      "accommodation_options": [
        {
          "name": "Hotel Name",
          "description": "Hotel description",
          "type": "hotel",
          "cost_per_night": 150,
          "distance_to_next_activity": "1.2 km"
        }
      ],
      "dailyTotal": 75
    }
  ],
  "perPersonTotal": 500,
  "groupTotal": 1000,
  "costBreakdown": {
    "activities": 200,
    "food": 150,
    "transportation": 150,
    "accommodation": 0
  }
}`;

    console.log("Sending request to Groq API...");
    
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.REACT_APP_GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "llama3-8b-8192",
        messages: [
          { 
            role: "system", 
            content: systemPrompt 
          },
          { 
            role: "user", 
            content: userPrompt 
          }
        ],
        temperature: 0.3,
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
    console.log("Raw API response:", data);

    if (!data.choices?.[0]?.message?.content) {
      throw new Error("No content in response");
    }

    // Clean and parse the response
    let content = data.choices[0].message.content;
    try {
      // Remove any non-JSON content
      content = content.substring(
        content.indexOf('{'),
        content.lastIndexOf('}') + 1
      );
      
      // Parse and validate the response
      const parsedItinerary = JSON.parse(content);
      const validatedItinerary = validateAndAdjustCosts(parsedItinerary, tripData.numPeople || 1);

      // Extract locations for mapping
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

// Helper function to validate and adjust costs
const validateAndAdjustCosts = (itinerary, numPeople) => {
  itinerary.days = itinerary.days.map(day => {
    // Calculate actual daily total including all costs
    const activitiesCost = day.activities.reduce((sum, act) => sum + (act.cost || 0), 0);
    const mealsCost = day.meals.reduce((sum, meal) => sum + (meal.cost || 0), 0);
    const transportCost = day.activities.reduce((sum, act) => 
      sum + (act.transport?.cost || 0), 0);
    
    const accommodationCost = day.accommodation_options?.[0]?.cost_per_night || 0;
    
    day.dailyTotal = activitiesCost + mealsCost + transportCost + accommodationCost;
    return day;
  });

  // Calculate actual totals
  const totalPerPerson = itinerary.days.reduce((sum, day) => sum + day.dailyTotal, 0);
  const actualGroupTotal = totalPerPerson * numPeople;

  // Update the cost breakdown
  const costBreakdown = {
    activities: itinerary.days.reduce((sum, day) => 
      sum + day.activities.reduce((actSum, act) => actSum + (act.cost || 0), 0), 0),
    food: itinerary.days.reduce((sum, day) => 
      sum + day.meals.reduce((mealSum, meal) => mealSum + (meal.cost || 0), 0), 0),
    transportation: itinerary.days.reduce((sum, day) => 
      sum + day.activities.reduce((transSum, act) => 
        transSum + (act.transport?.cost || 0), 0), 0),
    accommodation: itinerary.days.reduce((sum, day) => 
      sum + (day.accommodation_options?.[0]?.cost_per_night || 0), 0)
  };

  return {
    ...itinerary,
    perPersonTotal: totalPerPerson,
    groupTotal: actualGroupTotal,
    costBreakdown
  };
};