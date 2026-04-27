// src/App.js
import React, { useState } from 'react';
import TripForm from './components/TripForm';
import TripMap from './components/TripMap';
import ItineraryDisplay from './components/ItineraryDisplay';
import { generateItinerary } from './utils/llm';
import { getTheme } from './utils/season';
import './App.css';

function App() {
  const [tripData, setTripData] = useState(null);
  const [itinerary, setItinerary] = useState(null);
  const [mapPoints, setMapPoints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [theme, setTheme] = useState(null);

  const currentTheme = theme ? getTheme(theme) : null;

  const handleTripSubmit = async (formData) => {
    setLoading(true);
    setError(null);
    try {
      console.log('Form submitted with data:', formData);
      setTripData(formData);

      const result = await generateItinerary(formData);
      console.log('Generated itinerary:', result);

      setItinerary(result.itinerary);
      setMapPoints(result.locations);
    } catch (err) {
      console.error('Error in handleTripSubmit:', err);
      setError(err.message || 'Failed to generate itinerary. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleItineraryUpdate = (updatedItinerary) => {
    setItinerary(updatedItinerary);

    const newMapPoints = updatedItinerary.days.flatMap(day => [
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

    setMapPoints(newMapPoints);
  };

  return (
    <div className={`min-h-screen transition-colors duration-700 ${currentTheme?.bg || 'bg-gray-50'}`}>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-gray-800 mb-8 text-center">
          Trip.AI
        </h1>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-8">
            <TripForm
              onSubmit={handleTripSubmit}
              disabled={loading}
              theme={theme}
              onThemeChange={setTheme}
            />
            {loading && (
              <div className="bg-white/80 backdrop-blur rounded-2xl shadow-lg border border-gray-100 p-8 text-center">
                <div className={`animate-spin rounded-full h-10 w-10 border-b-2 mx-auto ${currentTheme?.accent?.replace('text-', 'border-') || 'border-emerald-600'}`}></div>
                <p className="mt-4 text-gray-600 font-medium">Building your trip...</p>
                <p className="mt-1 text-sm text-gray-400">This usually takes 5-15 seconds</p>
              </div>
            )}
            {itinerary && (
              <ItineraryDisplay
                itinerary={itinerary}
                tripData={tripData}
                onItineraryUpdate={handleItineraryUpdate}
                apiKey={tripData?.apiKey}
                model={tripData?.model}
              />
            )}
          </div>

          <div className="h-[600px] bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden sticky top-8">
            <TripMap points={mapPoints} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;