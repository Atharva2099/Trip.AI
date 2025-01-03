// src/components/ItineraryDisplay.js
import React, { useState } from 'react';
import EventChat from './EventChat';

const checkSimilarActivities = (activity, itinerary) => {
  const similarTypes = {
    temple: ['temple', 'shrine', 'religious'],
    museum: ['museum', 'gallery', 'exhibition'],
    park: ['park', 'garden', 'nature'],
    beach: ['beach', 'water', 'coast'],
    shopping: ['market', 'mall', 'shopping'],
    adventure: ['trek', 'hike', 'adventure', 'sport'],
    historical: ['fort', 'palace', 'historical', 'monument', 'ruins'],
    cultural: ['cultural', 'traditional', 'heritage', 'art']
  };

  const activityType = Object.keys(similarTypes).find(type => 
    similarTypes[type].some(keyword => 
      activity.name.toLowerCase().includes(keyword) || 
      activity.description.toLowerCase().includes(keyword)
    )
  );

  if (!activityType) return null;

  const similarActivities = itinerary.days.flatMap(day => 
    day.activities.filter(a => 
      a.name !== activity.name && 
      similarTypes[activityType].some(keyword => 
        a.name.toLowerCase().includes(keyword) || 
        a.description.toLowerCase().includes(keyword)
      )
    )
  );

  return similarActivities.length > 0 ? {
    type: activityType,
    activities: similarActivities
  } : null;
};

const MealCard = ({ meal, onClick }) => (
  <div 
    className="bg-yellow-50 p-4 rounded-lg border border-yellow-100 cursor-pointer hover:bg-yellow-100 transition-colors"
    onClick={onClick}
  >
    <div className="flex justify-between items-center mb-2">
      <h5 className="font-medium capitalize">{meal.type}</h5>
      <span className="text-sm text-gray-600">{meal.time}</span>
    </div>
    <div className="font-medium">{meal.name}</div>
    <div className="text-sm text-gray-600 mb-2">{meal.description}</div>
    <div className="text-sm font-medium">${meal.cost}</div>
  </div>
);

const AccommodationOptions = ({ options }) => (
  <div className="mt-6 bg-blue-50 p-4 rounded-lg border border-blue-100">
    <h4 className="font-medium mb-3">Accommodation Options</h4>
    <div className="space-y-3">
      {options.map((option, index) => (
        <div key={index} className="bg-white p-3 rounded border">
          <div className="flex justify-between items-start">
            <div>
              <div className="font-medium">{option.name}</div>
              <div className="text-sm text-gray-600">{option.description}</div>
              <div className="text-sm text-gray-600">
                {option.distance_to_next_activity} to next activity
              </div>
            </div>
            <div className="text-right">
              <div className="font-medium">${option.cost_per_night}/night</div>
              <div className="text-sm text-gray-500">{option.type}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const ItineraryDisplay = ({ itinerary, tripData, onItineraryUpdate }) => {
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isEventChatOpen, setIsEventChatOpen] = useState(false);
  const [isActivity, setIsActivity] = useState(true);

  if (!itinerary) return null;

  const handleEventUpdate = (updatedEvent) => {
    const updatedItinerary = JSON.parse(JSON.stringify(itinerary));
    
    const dayIndex = updatedItinerary.days.findIndex(day => 
      day.activities.some(activity => activity.name === selectedEvent.name) ||
      day.meals.some(meal => meal.name === selectedEvent.name)
    );

    if (dayIndex !== -1) {
      const day = updatedItinerary.days[dayIndex];
      
      if (isActivity) {
        const activityIndex = day.activities.findIndex(
          activity => activity.name === selectedEvent.name
        );
        if (activityIndex !== -1) {
          day.activities[activityIndex] = updatedEvent;
        }
      } else {
        const mealIndex = day.meals.findIndex(
          meal => meal.name === selectedEvent.name
        );
        if (mealIndex !== -1) {
          day.meals[mealIndex] = updatedEvent;
        }
      }

      day.dailyTotal = [
        ...day.activities.map(a => a.cost),
        ...day.meals.map(m => m.cost),
        ...day.activities.map(a => a.transport?.cost || 0)
      ].reduce((sum, cost) => sum + cost, 0);

      onItineraryUpdate(updatedItinerary);
    }
  };

  const validDays = itinerary.days.filter(day => 
    day.activities && day.activities.length > 0
  );

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg mt-8">
      <h2 className="text-2xl font-semibold mb-6">Your Itinerary</h2>
      
      <div className="space-y-8">
        {validDays.map((day, dayIndex) => (
          <div key={dayIndex} className="border-b pb-6 last:border-b-0">
            <h3 className="text-xl font-semibold mb-4">
              Day {dayIndex + 1} - {day.date}
            </h3>

            {/* Meals Section */}
            {day.meals && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {day.meals.map((meal, index) => (
                  <MealCard 
                    key={index} 
                    meal={meal} 
                    onClick={() => {
                      setSelectedEvent(meal);
                      setIsActivity(false);
                      setIsEventChatOpen(true);
                    }}
                  />
                ))}
              </div>
            )}

            {/* Activities Section */}
            <div className="space-y-6">
              {day.activities.map((activity, actIndex) => {
                const similarInfo = checkSimilarActivities(activity, itinerary);
                return (
                  <div 
                    key={actIndex} 
                    className="relative pl-8 border-l-2 border-blue-500 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => {
                      setSelectedEvent(activity);
                      setIsActivity(true);
                      setIsEventChatOpen(true);
                    }}
                  >
                    <div className="mb-2">
                      <span className="text-lg font-medium text-blue-600">
                        {activity.time}
                      </span>
                    </div>
                    
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="font-semibold text-lg mb-2">{activity.name}</h4>
                      <p className="text-gray-600 mb-2">{activity.description}</p>
                      
                      {/* Similarity Warning */}
                      {similarInfo && (
                        <div className="text-amber-600 text-sm mt-1 flex items-center mb-3">
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Similar to: {similarInfo.activities.map(a => a.name).join(', ')}
                        </div>
                      )}
                      
                      {/* Price Display */}
                      <div className="text-gray-600 mb-3">
                        Cost: {activity.price?.verified ? (
                          <span className="text-green-600">
                            ${activity.price.suggested}
                            <span className="text-xs ml-1">
                              ({activity.price.confidence} confidence)
                            </span>
                          </span>
                        ) : (
                          <span>${activity.cost}</span>
                        )}
                      </div>

                      {/* Transportation Info */}
                      {activity.transport && (
                        <div className="text-sm text-gray-600 mb-3">
                          Transport: {activity.transport.method} ({activity.transport.duration})
                          {activity.transport.cost > 0 && ` - $${activity.transport.cost}`}
                        </div>
                      )}

                      {/* Location Info */}
                      {activity.distance && (
                        <div className="text-sm text-gray-600 mb-3">
                          {activity.distance.toFixed(1)}km from city center
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex flex-wrap gap-2">
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${activity.coordinates.lat},${activity.coordinates.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm hover:bg-blue-200"
                          onClick={e => e.stopPropagation()}
                        >
                          Get Directions
                        </a>
                        <a
                          href={`https://www.google.com/search?q=${encodeURIComponent(activity.name)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm hover:bg-green-200"
                          onClick={e => e.stopPropagation()}
                        >
                          More Info
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Accommodation Section */}
            {day.accommodation_options && (
              <AccommodationOptions options={day.accommodation_options} />
            )}

            {/* Daily Total */}
            <div className="mt-4 text-right text-gray-600">
              Daily Total: ${day.dailyTotal || 
                day.activities.reduce((sum, act) => 
                  sum + (act.price?.suggested || act.cost), 0)
              }
            </div>
          </div>
        ))}
      </div>
      
      {/* Cost Breakdown */}
      {itinerary.costBreakdown && (
        <div className="mt-8 pt-6 border-t">
          <h3 className="text-xl font-semibold mb-4">Cost Breakdown (Per Person)</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-gray-50 rounded">
              <div className="text-sm text-gray-600">Activities</div>
              <div className="font-medium">${itinerary.costBreakdown.activities}</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded">
              <div className="text-sm text-gray-600">Food</div>
              <div className="font-medium">${itinerary.costBreakdown.food}</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded">
              <div className="text-sm text-gray-600">Transportation</div>
              <div className="font-medium">${itinerary.costBreakdown.transportation}</div>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded">
              <div className="text-sm text-blue-600">Per Person Total</div>
              <div className="font-medium">${itinerary.perPersonTotal}</div>
            </div>
          </div>
        </div>
      )}

      {/* Total Cost */}
      <div className="mt-6 flex flex-col space-y-2">
        <div className="flex justify-between items-center p-4 bg-blue-50 rounded-lg">
          <span className="text-xl font-semibold">Total Cost for Group:</span>
          <span className="text-2xl font-bold text-blue-600">
            ${itinerary.groupTotal}
          </span>
        </div>
        <div className="text-sm text-gray-500 text-right">
          Based on {tripData?.numPeople || 1} {(tripData?.numPeople || 1) === 1 ? 'person' : 'people'}
        </div>
      </div>

      {/* Event Chat Modal */}
      {isEventChatOpen && selectedEvent && (
    <EventChat
      event={selectedEvent}
      isActivity={isActivity}
      currentItinerary={itinerary}  // Add this line
      onClose={() => {
        setIsEventChatOpen(false);
        setSelectedEvent(null);
      }}
      onEventUpdate={handleEventUpdate}
    />
  )}
    </div>
  );
};

export default ItineraryDisplay;