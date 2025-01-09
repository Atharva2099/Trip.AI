import { format, eachDayOfInterval, parseISO } from 'date-fns';

const makeGroqRequest = async (messages) => {
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.REACT_APP_GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "gemma2-9b-it",
        messages: messages,
        temperature: 0.7,
        max_tokens: 4000,
        top_p: 1
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || 'Failed to get response from API');
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('API Request Error:', error);
    throw error;
  }
};

export const generateItinerary = async (tripData) => {
  try {
    const dateRange = eachDayOfInterval({
      start: parseISO(tripData.dates.start),
      end: parseISO(tripData.dates.end)
    });

    const formattedDates = dateRange.map(date => format(date, 'yyyy-MM-dd'));
    const budgetPerPerson = Math.floor(parseInt(tripData.budget) / parseInt(tripData.numPeople || 1));

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
      }],
      costBreakdown: {
        activities: 50,
        food: 20,
        transportation: 10
      },
      perPersonTotal: 80,
      groupTotal: 80
    };

    const systemPrompt = `As a travel planning assistant, generate a detailed itinerary in JSON format. Follow this EXACT structure (replace sample values):
${JSON.stringify(template, null, 2)}`;

    const userPrompt = `Create a ${formattedDates.length}-day itinerary for ${tripData.destination}:
- Budget per person: $${budgetPerPerson}
- Dates: ${formattedDates.join(', ')}
- Number of people: ${tripData.numPeople}
- Interests: ${tripData.interests || 'general sightseeing'}

Requirements:
1. Each day needs 2-3 activities and 3 meals (breakfast, lunch, dinner)
2. Include exact coordinates for each activity
3. All activities between 8:00-22:00
4. Include transport details between locations
5. Stay within budget
6. No duplicate activities or restaurants

Return ONLY valid JSON matching the structure shown.`;

    const content = await makeGroqRequest([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ]);

    try {
      // Clean up the response
      const cleanContent = content
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      // Extract JSON
      const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON object found in response');
      }

      const parsedContent = JSON.parse(jsonMatch[0]);

      // Validate the structure
      if (!parsedContent.days || !Array.isArray(parsedContent.days)) {
        throw new Error('Invalid itinerary structure');
      }

      // Ensure all required fields are present
      parsedContent.days = parsedContent.days.map((day, index) => ({
        date: formattedDates[index],
        activities: day.activities.map(activity => ({
          name: activity.name,
          time: activity.time,
          description: activity.description,
          cost: parseFloat(activity.cost),
          coordinates: {
            lat: parseFloat(activity.coordinates.lat),
            lng: parseFloat(activity.coordinates.lng)
          },
          transport: {
            method: activity.transport?.method || "walking",
            duration: activity.transport?.duration || "10 min",
            cost: parseFloat(activity.transport?.cost || 0)
          }
        })),
        meals: day.meals.map(meal => ({
          type: meal.type,
          time: meal.time,
          name: meal.name,
          description: meal.description,
          cost: parseFloat(meal.cost)
        })),
        dailyTotal: day.dailyTotal || 0
      }));

      // Calculate totals and breakdowns
      let totalActivities = 0;
      let totalFood = 0;
      let totalTransport = 0;

      parsedContent.days.forEach(day => {
        day.activities.forEach(activity => {
          totalActivities += activity.cost;
          totalTransport += activity.transport.cost;
        });
        day.meals.forEach(meal => {
          totalFood += meal.cost;
        });
      });

      const perPersonTotal = totalActivities + totalFood + totalTransport;
      const groupTotal = perPersonTotal * tripData.numPeople;

      const validatedItinerary = {
        ...parsedContent,
        costBreakdown: {
          activities: totalActivities,
          food: totalFood,
          transportation: totalTransport
        },
        perPersonTotal,
        groupTotal
      };

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
      console.error('Raw Content:', content);
      throw new Error('Failed to parse itinerary');
    }
  } catch (error) {
    console.error('Generation Error:', error);
    throw new Error('Failed to generate valid itinerary. Please try again.');
  }
};

export default generateItinerary;