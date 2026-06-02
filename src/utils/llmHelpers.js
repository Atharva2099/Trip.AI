// Pure helpers from generateItinerary, extracted so they're testable
// without `fetch` or React.

// Strip ```json / ``` fences and find the first JSON object in the response.
export function extractJson(raw) {
  if (!raw) return null;
  const cleaned = String(raw)
    .replace(/```json\s*/g, '')
    .replace(/```\s*/g, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch { return null; }
    }
    return null;
  }
}

export function validateAndAdjustCosts(itinerary, numPeople) {
  let totalPerPerson = 0;
  const costBreakdown = {
    activities: 0,
    food: 0,
    transportation: 0
  };

  itinerary.days = itinerary.days.map(day => {
    const activitiesCost = (day.activities || []).reduce((sum, act) => sum + (act.cost || 0), 0);
    const mealsCost = (day.meals || []).reduce((sum, meal) => sum + (meal.cost || 0), 0);
    const transportCost = (day.activities || []).reduce((sum, act) => sum + (act.transport?.cost || 0), 0);

    costBreakdown.activities += activitiesCost;
    costBreakdown.food += mealsCost;
    costBreakdown.transportation += transportCost;

    const dailyTotal = activitiesCost + mealsCost + transportCost;
    totalPerPerson += dailyTotal;

    return { ...day, dailyTotal };
  });

  return {
    ...itinerary,
    costBreakdown,
    perPersonTotal: totalPerPerson,
    groupTotal: totalPerPerson * numPeople
  };
}

// Build the round-trip-aware prompt. Pass `groundingContext` to inject
// recent web context (Exa highlights) into the system prompt.
export function buildPrompt({ destination, from, dates, dayCount, groupBudget, numPeople, budgetPerPerson, formattedDates, interests, groundingContext = '' }) {
  const systemPrompt = `Generate a ${dayCount}-day travel itinerary from "${from}" to "${destination}" in valid JSON.

ROUND-TRIP RULES:
- Day 1 should account for travel from "${from}" to "${destination}". If the trip is short (<2h from home), day 1 is at the destination. Otherwise, day 1 starts with the actual transport leg (flight/train/bus) and has a lighter schedule on arrival.
- The last day (day ${dayCount}) should account for travel back to "${from}". If the trip is short, it can still be a full day at the destination. Otherwise, it ends with the actual transport leg.
- For trips under ~2h from home, treat all days as full destination days.
- Use LOCAL time at "${destination}" for all timestamps.

DISTANCE-BASED TRANSPORT RULES (apply to home↔destination AND any inter-city segments):
- <50 km: walk, taxi, or local transit
- 50–300 km: car, intercity bus, or short train
- 300–1500 km: high-speed train (if available) or short flight
- >1500 km: flight
GEOGRAPHY OVERRIDES:
- Europe / Japan / Korea: prioritise rail (TGV, Shinkansen, KTX) over short flights when total time is competitive
- USA / Canada / Australia: car for <500 mi, flight for longer
- Southeast Asia / Latin America: bus and short flights common
- Always include a realistic primary mode AND 1 alternative for the home↔destination leg with prices

CRITICAL BUDGET RULES:
- TOTAL GROUP BUDGET CEILING: $${groupBudget} for ALL ${numPeople} people combined across ALL ${dayCount} days
- This includes BOTH inter-city transport legs (home↔destination) AND on-the-ground costs
- Per person total must stay under $${Math.floor(groupBudget / numPeople)}
- Accommodation is NOT included (user books separately)
- Costs to include: inter-city transport per person, activities entry fees, meals, local transport between activities
- If you cannot fit within budget, cut activities or choose cheaper transport (bus > flight for medium distances)
- NEVER exceed the total budget

OTHER RULES:
- 2-3 activities + 3 meals per day at destination
- Same-day activities in the same neighborhood (walking/short drive)
- Different days explore different areas of ${destination}
- Inter-activity transport: walk/taxi/local transit under 15 min
- All locations real with exact coordinates
- Realistic costs for ${destination}
- Activities between 8:00–22:00
- No duplicate places anywhere in the trip
- EVERY day MUST include an "accommodation_options" array with at least 1 option (name, type, description, cost_per_night, coordinates) — required, not optional

OUTPUT JSON SHAPE:
{
  "from": "${from}",
  "to": "${destination}",
  "transport_to_destination": {
    "primary": { "mode": "flight|train|bus|car|taxi", "duration": "3h 10m", "cost_per_person": 95, "details": "BER → LIS direct, 09:00–12:10" },
    "alternatives": [ { "mode": "train", "duration": "24h", "cost_per_person": 130, "details": "via Paris" } ]
  },
  "transport_back_home": { /* same shape as transport_to_destination, with return details */ },
  "days": [
    {
      "date": "YYYY-MM-DD",
      "activities": [ { "name", "time", "description", "cost", "coordinates": {lat, lng}, "transport": { "method", "duration", "cost" } } ],
      "meals": [ { "type": "breakfast|lunch|dinner", "time", "name", "description", "cost" } ],
      "accommodation_options": [ { "name", "type", "description", "cost_per_night", "coordinates": {lat, lng} } ],
      "dailyTotal": <number>
    }
  ]
}
${groundingContext ? `\n${groundingContext}\n` : ''}
Respond with ONLY the JSON object, no prose, no markdown fences, no thinking.`;

  const userPrompt = `Generate the round-trip itinerary now.

From: ${from}
To: ${destination}
Dates: ${formattedDates.join(', ')} (${dayCount} days)
Group size: ${numPeople} people
Group budget: $${groupBudget} (about $${budgetPerPerson}/person total — includes inter-city transport)
Interests: ${interests || 'general sightseeing'}

Make sure transport_to_destination and transport_back_home are filled in with realistic modes and prices. Include accommodation_options for every day.`;

  return { systemPrompt, userPrompt };
}
