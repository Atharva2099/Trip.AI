import { format, eachDayOfInterval, parseISO } from 'date-fns';

const makeGroqRequest = async (messages, temperature = 0.3, apiKey) => {
  if (!apiKey) {
    throw new Error('Please provide a valid Groq API key');
  }

  try {
    console.log('Making API request with messages:', messages);

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
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
      if (response.status === 401) {
        throw new Error('Invalid API key. Please check your Groq API key and try again.');
      }
      const errorData = await response.json().catch(() => ({}));
      console.error('API Error:', errorData);
      throw new Error(errorData.error?.message || 'Failed to get response from API');
    }

    const data = await response.json();
    console.log('API Response:', data);
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
    console.log('Generating itinerary with trip data:', tripData);

    // Validate required fields
    if (!tripData.destination || !tripData.dates?.start || !tripData.dates?.end || !tripData.budget) {
      throw new Error('Missing required trip data: Please fill in destination, dates, and budget');
    }

    // Validate dates
    const dateRange = eachDayOfInterval({
      start: parseISO(restTripData.dates.start),
      end: parseISO(restTripData.dates.end)
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
    const content = await makeGroqRequest([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ], 0.3, apiKey);

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

export { makeGroqRequest, validateAndAdjustCosts };