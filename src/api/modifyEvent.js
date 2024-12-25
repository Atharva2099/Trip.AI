// src/api/modifyEvent.js

const getExistingEvents = (event, currentItinerary) => {
  const existingEvents = new Set();
  currentItinerary.days.forEach(day => {
    day.activities.forEach(activity => {
      // Don't include the current event being modified
      if (activity.name !== event.name) {
        existingEvents.add(activity.name.toLowerCase());
      }
    });
    day.meals.forEach(meal => {
      if (meal.name !== event.name) {
        existingEvents.add(meal.name.toLowerCase());
      }
    });
  });
  return existingEvents;
};

export const modifyEvent = async (message, context, currentItinerary) => {
  try {
    const existingEvents = getExistingEvents(context.currentDetails, currentItinerary);
    
    const systemPrompt = `You are a travel planning assistant. Your task is to modify a ${context.type} based on the user's request. 
Important constraints:
1. NEVER suggest any of these existing places: ${Array.from(existingEvents).join(', ')}
2. Keep all locations within 50km of city center
3. Activities must be between 8:00-22:00
4. Use realistic local prices
5. For activities, always include exact coordinates, transport info, and distance
6. For meals, include time, type (breakfast/lunch/dinner), and cost
7. Suggest unique places that aren't already in the itinerary
8. Ensure suggestions are location-appropriate and culturally relevant

The response must be a valid JSON object with the same structure as the current details.`;

    const userPrompt = `Current ${context.type} details: 
${JSON.stringify(context.currentDetails, null, 2)}

User request: ${message}

Respond with a JSON object containing the modified event details. Maintain the exact structure of the current details while incorporating the requested changes.`;

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
        temperature: 0.4,
        max_tokens: 1000,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      throw new Error('Failed to get response from Groq API');
    }

    const data = await response.json();
    
    if (!data.choices?.[0]?.message?.content) {
      throw new Error("No content in response");
    }

    try {
      const updatedEvent = JSON.parse(data.choices[0].message.content);

      // Validate structure and uniqueness
      if (!validateEventStructure(updatedEvent, context.type)) {
        throw new Error("Invalid event structure returned");
      }

      if (updatedEvent.name && existingEvents.has(updatedEvent.name.toLowerCase())) {
        // If duplicate found, try one more time with stronger uniqueness constraint
        const retryPrompt = `${userPrompt}\n\nIMPORTANT: The suggested place "${updatedEvent.name}" is already in the itinerary. Please suggest a completely different place that's not in this list: ${Array.from(existingEvents).join(', ')}`;

        const retryResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
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
            temperature: 0.5,
            max_tokens: 1000,
            response_format: { type: "json_object" }
          })
        });

        const retryData = await retryResponse.json();
        const retryEvent = JSON.parse(retryData.choices[0].message.content);

        if (!validateEventStructure(retryEvent, context.type)) {
          throw new Error("Invalid event structure in retry");
        }

        return {
          message: "I've found a unique alternative that meets your requirements.",
          updatedEvent: retryEvent
        };
      }

      return {
        message: "I've updated the event based on your request while ensuring it's unique in your itinerary.",
        updatedEvent
      };

    } catch (parseError) {
      console.error("Failed to parse content:", data.choices[0].message.content);
      throw new Error("Failed to parse the AI response. Please try again.");
    }
  } catch (error) {
    console.error('Error modifying event:', error);
    throw error;
  }
};

// Helper function to validate event structure
const validateEventStructure = (event, type) => {
  const requiredActivityFields = ['name', 'time', 'description', 'cost', 'coordinates', 'transport', 'distance'];
  const requiredMealFields = ['name', 'time', 'description', 'cost', 'type'];

  const requiredFields = type === 'activity' ? requiredActivityFields : requiredMealFields;

  return requiredFields.every(field => {
    if (field === 'coordinates' && type === 'activity') {
      return event.coordinates && 
             typeof event.coordinates.lat === 'number' && 
             typeof event.coordinates.lng === 'number';
    }
    if (field === 'transport' && type === 'activity') {
      return event.transport && 
             event.transport.method && 
             event.transport.duration && 
             typeof event.transport.cost === 'number';
    }
    return event.hasOwnProperty(field) && event[field] !== null && event[field] !== undefined;
  });
};