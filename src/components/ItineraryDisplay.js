import React from 'react';

// Separate component for meals
const MealCard = ({ meal }) => (
  <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-100">
    <div className="flex justify-between items-center mb-2">
      <h5 className="font-medium capitalize">{meal.type}</h5>
      <span className="text-sm text-gray-600">{meal.time}</span>
    </div>
    <div className="font-medium">{meal.name}</div>
    <div className="text-sm text-gray-600 mb-2">{meal.description}</div>
    <div className="text-sm font-medium">${meal.cost}</div>
  </div>
);

// Separate component for accommodation options
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

// Main component
const ItineraryDisplay = ({ itinerary, tripData }) => {
  if (!itinerary) return null;

  // Filter out empty days
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
                  <MealCard key={index} meal={meal} />
                ))}
              </div>
            )}

            {/* Activities Section */}
            <div className="space-y-6">
              {day.activities.map((activity, actIndex) => (
                <div key={actIndex} className="relative pl-8 border-l-2 border-blue-500">
                  <div className="mb-2">
                    <span className="text-lg font-medium text-blue-600">
                      {activity.time}
                    </span>
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-lg mb-2">{activity.name}</h4>
                    <p className="text-gray-600 mb-2">{activity.description}</p>
                    
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
                      >
                        Get Directions
                      </a>
                      <a
                        href={`https://www.google.com/search?q=${encodeURIComponent(activity.name)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm hover:bg-green-200"
                      >
                        More Info
                      </a>
                    </div>
                  </div>
                </div>
              ))}
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
    </div>
  );
};

export default ItineraryDisplay;