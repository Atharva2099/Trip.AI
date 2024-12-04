export const generateItinerary = async (tripData) => {
  console.log("Starting itinerary generation with data:", tripData);

  try {
    const systemPrompt = `You are a travel planning assistant. You must respond ONLY with valid JSON, no explanatory text. Your response must exactly follow the specified JSON format.`;

    const userPrompt = `Generate a travel itinerary with these requirements:
    - Destination: ${tripData.destination}
    - Duration: ${(new Date(tripData.dates.end) - new Date(tripData.dates.start)) / (1000 * 60 * 60 * 24)} days
    - Budget: $${tripData.budget}
    - Interests: ${tripData.interests}
    - Additional Notes: ${tripData.additionalNotes || "None"}

    You must respond with a JSON object exactly matching this structure:
    {
      "days": [
        {
          "date": "YYYY-MM-DD",
          "activities": [
            {
              "time": "HH:MM",
              "name": "Specific Location Name",
              "description": "Brief Description",
              "cost": 100,
              "coordinates": {
                "lat": 40.4167,
                "lng": -3.7033
              }
            }
          ]
        }
      ],
      "totalCost": 1000
    }

    Rules:
    1. Use real coordinates for actual locations
    2. Use exact location names
    3. Use realistic costs
    4. Keep descriptions concise
    5. Format times as HH:MM
    6. Format dates as YYYY-MM-DD
    7. All numbers should be without quotes
    8. Respond only with the JSON, no additional text`;

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
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.5, // Reduced for more consistent output
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

    // Try to clean the response before parsing
    let content = data.choices[0].message.content;
    try {
      // Remove any markdown code block indicators if present
      content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      // Remove any leading/trailing whitespace
      content = content.trim();
      
      const itinerary = JSON.parse(content);
      console.log("Successfully parsed itinerary:", itinerary);

      // Validate the structure
      if (!itinerary.days || !Array.isArray(itinerary.days)) {
        throw new Error("Invalid itinerary structure");
      }

      // Extract locations for mapping
      const locations = itinerary.days.flatMap(day =>
        (day.activities || []).map(activity => ({
          name: activity.name,
          coordinates: activity.coordinates,
          description: activity.description,
        }))
      ).filter(loc => loc.coordinates && loc.coordinates.lat && loc.coordinates.lng);

      return { itinerary, locations };
      
    } catch (parseError) {
      console.error("Failed to parse content:", content);
      throw new Error("Failed to parse LLM response. The model returned invalid JSON.");
    }
  } catch (error) {
    console.error("Detailed error in generateItinerary:", error);
    throw error;
  }
};