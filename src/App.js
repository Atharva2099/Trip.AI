// src/App.js
import React, { useState } from 'react';
import { Plus, Edit3, Compass } from 'lucide-react';
import TripForm from './components/TripForm';
import TripMap from './components/TripMap';
import ItineraryDisplay from './components/ItineraryDisplay';
import { generateItinerary } from './utils/llm';
import { getTheme } from './utils/season';
import './App.css';

function App() {
  const [tripData, setTripData] = useState(null);
  const [itinerary, setItinerary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [theme, setTheme] = useState(null);
  const [showForm, setShowForm] = useState(true);

  const currentTheme = theme ? getTheme(theme) : null;
  const hasItinerary = !!itinerary;

  const handleTripSubmit = async (formData) => {
    setLoading(true);
    setError(null);
    try {
      console.log('Form submitted with data:', formData);
      setTripData(formData);

      const result = await generateItinerary(formData);
      console.log('Generated itinerary:', result);

      setItinerary(result.itinerary);
      setShowForm(false);
    } catch (err) {
      console.error('Error in handleTripSubmit:', err);
      setError(err.message || 'Failed to generate itinerary. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleItineraryUpdate = (updatedItinerary) => {
    setItinerary(updatedItinerary);
  };

  const handleNewTrip = () => {
    setTripData(null);
    setItinerary(null);
    setError(null);
    setShowForm(true);
  };

  return (
    <div className={`min-h-screen transition-colors duration-700 ${currentTheme?.bg || 'bg-gray-50'}`}>
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Compass size={28} className="text-gray-800" />
            <h1 className="text-2xl font-bold text-gray-800">Trip.AI</h1>
          </div>
          {hasItinerary && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowForm((s) => !s)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 shadow-sm transition-all"
              >
                <Edit3 size={14} />
                {showForm ? 'Hide Form' : 'Edit Search'}
              </button>
              <button
                onClick={handleNewTrip}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-gray-800 text-white hover:bg-gray-700 shadow-sm transition-all"
              >
                <Plus size={14} />
                New Trip
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 text-sm">
            {error}
          </div>
        )}

        {/* Form area — collapses after generation */}
        {showForm && (
          <div className="max-w-xl mx-auto mb-8">
            <TripForm
              onSubmit={handleTripSubmit}
              disabled={loading}
              theme={theme}
              onThemeChange={setTheme}
            />
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="max-w-xl mx-auto mb-8">
            <div className="bg-white/80 backdrop-blur rounded-2xl shadow-lg border border-gray-100 p-8 text-center">
              <div className={`animate-spin rounded-full h-10 w-10 border-b-2 mx-auto ${currentTheme?.accent?.replace('text-', 'border-') || 'border-emerald-600'}`}></div>
              <p className="mt-4 text-gray-600 font-medium">Building your trip...</p>
              <p className="mt-1 text-sm text-gray-400">This usually takes 3-10 seconds</p>
            </div>
          </div>
        )}

        {/* Results: itinerary + map */}
        {hasItinerary && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-6">
              <ItineraryDisplay
                itinerary={itinerary}
                tripData={tripData}
                onItineraryUpdate={handleItineraryUpdate}
                apiKey={tripData?.apiKey}
                model={tripData?.model}
              />
            </div>

            <div className="h-[600px] bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden sticky top-6">
              <TripMap itinerary={itinerary} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
