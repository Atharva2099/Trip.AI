import { format, eachDayOfInterval, parseISO } from 'date-fns';

export const generateItinerary = async (tripData) => {
  console.log("Starting itinerary generation with data:", tripData);

  try {
    const dateRange = eachDayOfInterval({
      start: parseISO(tripData.dates.start),
      end: parseISO(tripData.dates.end)
    });

    const formattedDates = dateRange.map(date => format(date, 'yyyy-MM-dd'));
    
    const systemPrompt = `You are a travel planning assistant that MUST ONLY respond with valid JSON. Do not include any explanatory text, markdown formatting, or additional content. The response must be a pure JSON object and nothing else.`;

    const userPrompt = `Create an itinerary with these exact requirements:
    - Destination: ${tripData.destination}
    - Dates: ${formattedDates.join(', ')}
    - Budget: $${tripData.budget}
    - Interests: ${tripData.interests}
    - Additional Notes: ${tripData.additionalNotes || 'None'}

    Respond with ONLY a JSON object using this structure, no other text:
    {
      "days": [
        {
          "date": "${formattedDates[0]}",
          "activities": [
            {
              "time": "09:00",
              "name": "Example Location",
              "description": "Brief activity description",
              "cost": 50,
              "coordinates": {
                "lat": 37.7749,
                "lng": -122.4194
              }
            }
          ]
        }
      ],
      "totalCost": 500
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
        temperature: 0.5, // Reduced temperature for more consistent output
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

    // Clean the response
    let content = data.choices[0].message.content;
    
    // Remove any non-JSON content
    try {
      content = content.substring(
        content.indexOf('{'),
        content.lastIndexOf('}') + 1
      );
      
      const itinerary = JSON.parse(content);

      // Validate the structure
      if (!itinerary.days || !Array.isArray(itinerary.days)) {
        throw new Error("Invalid itinerary structure");
      }

      // Ensure correct dates
      itinerary.days = itinerary.days.map((day, index) => ({
        ...day,
        date: formattedDates[index] || formattedDates[0]
      }));

      // Sort days by date
      itinerary.days.sort((a, b) => new Date(a.date) - new Date(b.date));

      console.log("Parsed itinerary:", itinerary);

      // Extract locations for mapping
      const locations = itinerary.days.flatMap(day =>
        day.activities.map(activity => ({
          name: activity.name,
          coordinates: activity.coordinates,
          description: activity.description,
        }))
      );

      return { itinerary, locations };
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