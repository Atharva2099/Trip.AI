// src/App.js
import React, { useState } from 'react';
import { Plus, Edit3, Compass, X } from 'lucide-react';
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
      setTripData(formData);
      const result = await generateItinerary(formData);
      setItinerary(result.itinerary);
      setShowForm(false);
    } catch (err) {
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
    <div className="min-h-screen bg-cream text-ink antialiased font-sans">
      {/* Nav bar — warm near-black */}
      <nav className="sticky top-0 z-50 bg-ink border-b border-ink-light/20">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Compass size={20} className="text-cream" strokeWidth={1.5} />
            <span className="font-serif text-xl text-cream tracking-tight">Trip.AI</span>
          </div>
          {hasItinerary && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowForm((s) => !s)}
                className="flex items-center gap-2 px-4 py-2 text-xs font-medium uppercase tracking-[0.14em] text-cream/80 hover:text-cream border border-cream/20 hover:border-cream/40 transition-colors"
              >
                {showForm ? <X size={13} /> : <Edit3 size={13} />}
                {showForm ? 'Close' : 'Edit'}
              </button>
              <button
                onClick={handleNewTrip}
                className="flex items-center gap-2 px-4 py-2 text-xs font-medium uppercase tracking-[0.14em] bg-terra text-cream hover:bg-terra-dark transition-colors"
              >
                <Plus size={13} />
                New Trip
              </button>
            </div>
          )}
        </div>
      </nav>

      <div className="container mx-auto px-6">
        {error && (
          <div className="mt-8 bg-terra/10 border-l-2 border-terra text-terra px-5 py-3 text-sm">
            {error}
          </div>
        )}

        {/* Form area */}
        {showForm && (
          <div className={`${hasItinerary ? 'mt-8 max-w-md' : 'mt-16 max-w-lg mx-auto'}`}>
            {!hasItinerary && (
              <div className="mb-12 text-center">
                <h1 className="font-serif text-5xl text-ink mb-4 tracking-tight">Plan your next adventure</h1>
                <p className="text-ink-light text-sm max-w-md mx-auto leading-relaxed">
                  Tell us where you want to go, and our AI will craft a detailed itinerary with real places, costs, and routes.
                </p>
              </div>
            )}
            <TripForm
              onSubmit={handleTripSubmit}
              disabled={loading}
              theme={theme}
              onThemeChange={setTheme}
            />
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="mt-16 max-w-lg mx-auto text-center">
            <div className="border-t-2 border-terra w-12 mx-auto mb-6 animate-pulse" />
            <p className="font-serif text-2xl text-ink mb-2">Curating your trip</p>
            <p className="text-ink-muted text-sm">This usually takes 1–3 minutes</p>
          </div>
        )}

        {/* Results */}
        {hasItinerary && (
          <div className="mt-12 grid grid-cols-1 xl:grid-cols-12 gap-0">
            {/* Itinerary */}
            <div className="xl:col-span-5 xl:border-r border-rule">
              <ItineraryDisplay
                itinerary={itinerary}
                tripData={tripData}
                onItineraryUpdate={handleItineraryUpdate}
                apiKey={tripData?.apiKey}
                model={tripData?.model}
              />
            </div>

            {/* Map */}
            <div className="xl:col-span-7">
              <div className="h-[500px] lg:h-[85vh] bg-cream-dark border-b border-rule xl:border-b-0 sticky top-[57px]">
                <TripMap itinerary={itinerary} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
