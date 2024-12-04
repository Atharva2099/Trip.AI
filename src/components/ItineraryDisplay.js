import React from 'react';

const ItineraryDisplay = ({ itinerary }) => {
  if (!itinerary) return null;

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg mt-8">
      <h2 className="text-2xl font-semibold mb-6">Your Itinerary</h2>
      <div className="space-y-8">
        {itinerary.days.map((day, dayIndex) => (
          <div key={dayIndex} className="border-b pb-6 last:border-b-0">
            <h3 className="text-xl font-semibold mb-4">
              Day {dayIndex + 1} - {day.date}
            </h3>
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
                    <p className="text-gray-500 mb-3">Estimated cost: ${activity.cost}</p>
                    
                    <div className="flex flex-wrap gap-2 mb-3">
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
          </div>
        ))}
      </div>
      
      <div className="mt-8 pt-6 border-t">
        <div className="flex justify-between items-center">
          <span className="text-xl font-semibold">Total Estimated Cost:</span>
          <span className="text-2xl font-bold text-blue-600">
            ${itinerary.totalCost}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ItineraryDisplay;