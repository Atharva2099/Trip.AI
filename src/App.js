import React, { useState } from 'react';
import TripForm from './components/TripForm';
import TripMap from './components/TripMap';
import ItineraryDisplay from './components/ItineraryDisplay';
import { generateItinerary } from './utils/llm';
import './App.css';

function App() {
  const [tripData, setTripData] = useState(null);
  const [itinerary, setItinerary] = useState(null);
  const [mapPoints, setMapPoints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-gray-800 mb-8 text-center">
          Trip.AI
        </h1>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
            {error}
          </div>
        )}
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-8">
            <TripForm onSubmit={handleTripSubmit} disabled={loading} />
            {loading && (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                <p className="mt-2 text-gray-600">Generating your perfect itinerary...</p>
              </div>
            )}
            {itinerary && <ItineraryDisplay itinerary={itinerary} />}
          </div>
          
          <div className="h-[600px] bg-white rounded-lg shadow-lg">
            <TripMap points={mapPoints} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;