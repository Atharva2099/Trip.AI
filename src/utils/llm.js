import { format, eachDayOfInterval, parseISO } from 'date-fns';

export const generateItinerary = async (tripData) => {
  console.log("Starting itinerary generation with data:", tripData);

  try {
    const dateRange = eachDayOfInterval({
      start: parseISO(tripData.dates.start),
      end: parseISO(tripData.dates.end)
    });

    const formattedDates = dateRange.map(date => format(date, 'yyyy-MM-dd'));
    
    const systemPrompt = `You are a travel planning assistant that MUST ONLY respond with valid JSON. Do not include any explanatory text or markdown formatting. The response must be a pure JSON object and nothing else. Focus only on providing realistic, verified information.`;

    const userPrompt = `Generate a detailed travel itinerary for ${tripData.destination}.
Trip Details:
- Duration: ${formattedDates.length} days
- Start Date: ${formattedDates[0]}
- End Date: ${formattedDates[formattedDates.length - 1]}
- Budget: $${tripData.budget}
- Interests: ${tripData.interests}
- Notes: ${tripData.additionalNotes || 'None'}

Required Elements Per Day:
1. Main Activities (2-3)
2. Meals at local restaurants
3. Transportation between locations

Constraints:
1. Keep all locations within 50km of city center
2. Total cost must not exceed budget
3. Use realistic prices
4. Include exact coordinates
5. Activities between 8:00-22:00 only

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
          }
        }
      ],
      "meals": [
        {
          "type": "lunch",
          "time": "12:00",
          "name": "Restaurant Name",
          "description": "Cuisine type",
          "cost": 25,
          "coordinates": {
            "lat": 37.7749,
            "lng": -122.4194
          }
        }
      ]
    }
  ],
  "totalCost": 500,
  "costBreakdown": {
    "activities": 200,
    "food": 150,
    "transportation": 150
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
        temperature: 0.3,  // Lower temperature for more consistent output
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
      
      // Attempt to parse JSON
      const itinerary = JSON.parse(content);

      // Validate structure
      if (!itinerary.days || !Array.isArray(itinerary.days)) {
        throw new Error("Invalid itinerary structure");
      }

      // Ensure all days have proper data
      itinerary.days = itinerary.days.map((day, index) => ({
        date: formattedDates[index],
        activities: day.activities || [],
        meals: day.meals || []
      }));

      console.log("Parsed itinerary:", itinerary);

      // Extract locations for mapping
      const locations = itinerary.days.flatMap(day => [
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

      return {
        itinerary,
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