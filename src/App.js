// src/App.js
import React, { useState, useEffect } from 'react';
import { Plus, Edit3, Compass, X, LogOut, User, MapPin, Bookmark } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import LandingPage from './components/LandingPage';
import TripForm from './components/TripForm';
import TripMap from './components/TripMap';
import ItineraryDisplay from './components/ItineraryDisplay';
import SavedTrips from './components/SavedTrips';
import BookmarksPage from './components/BookmarksPage';
import { generateItinerary } from './utils/llm';
import { getTheme } from './utils/season';
import { tripsApi } from './api/client';
import './App.css';

function AuthNav() {
  const { user, isAuthenticated, logout } = useAuth();
  const [showMenu, setShowMenu] = useState(false);

  if (isAuthenticated && user) {
    return (
      <div className="relative">
        <button
          onClick={() => setShowMenu((s) => !s)}
          className="flex items-center gap-2 text-cream/80 hover:text-cream transition-colors"
        >
          {user.avatar ? (
            <img src={user.avatar} alt="" className="w-7 h-7 object-cover border border-cream/20" />
          ) : (
            <User size={18} strokeWidth={1.5} />
          )}
          <span className="text-xs hidden sm:inline">{user.name || user.email}</span>
        </button>
        {showMenu && (
          <div className="absolute right-0 mt-2 w-48 bg-cream border border-rule shadow-xl z-50">
            <button
              onClick={() => { logout(); setShowMenu(false); }}
              className="w-full flex items-center gap-2 px-4 py-3 text-xs text-ink hover:bg-cream-dark transition-colors text-left"
            >
              <LogOut size={13} strokeWidth={1.5} />
              Sign Out
            </button>
          </div>
        )}
      </div>
    );
  }

  return null;
}

function AppContent() {
  const [tripData, setTripData] = useState(null);
  const [itinerary, setItinerary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [theme, setTheme] = useState(null);
  const [showForm, setShowForm] = useState(true);
  const [view, setView] = useState('plan'); // 'plan' | 'my-trips' | 'bookmarks'

  const { isAuthenticated } = useAuth();
  const hasItinerary = !!itinerary;

  const handleTripSubmit = async (formData) => {
    setLoading(true);
    setError(null);
    try {
      setTripData(formData);
      const result = await generateItinerary(formData);
      setItinerary(result.itinerary);
      setShowForm(false);

      if (isAuthenticated) {
        try {
          await tripsApi.create({
            title: `${formData.destination} Trip`,
            destination: formData.destination,
            start_date: formData.dates?.start,
            end_date: formData.dates?.end,
            budget: formData.budget,
            proposed_budget: result.itinerary?.groupTotal || formData.budget,
            travelers: formData._travelers || { adults: 2, children: 0 },
            interests: formData.interests?.split(',').map(s => s.trim()).filter(Boolean) || [],
            itinerary_data: result.itinerary
          });
        } catch (saveErr) {
          console.error('Failed to auto-save trip:', saveErr);
        }
      }
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
    setView('plan');
  };

  const handleLoadTrip = (trip) => {
    setTripData({
      destination: trip.destination,
      dates: { start: trip.start_date, end: trip.end_date },
      budget: trip.budget,
      numPeople: (trip.travelers?.adults || 2) + (trip.travelers?.children || 0),
      interests: Array.isArray(trip.interests) ? trip.interests.join(', ') : '',
      _travelers: trip.travelers
    });
    setItinerary(trip.itinerary_data);
    setShowForm(false);
    setView('plan');
  };

  // ─── Landing Page for Guests ────────────────────────────────
  if (!isAuthenticated) {
    return <LandingPage />;
  }

  // ─── Authenticated App ──────────────────────────────────────
  return (
    <div className="min-h-screen bg-cream text-ink antialiased font-sans">
      {/* Nav bar */}
      <nav className="sticky top-0 z-50 bg-ink border-b border-ink-light/20">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button onClick={handleNewTrip} className="flex items-center gap-3">
              <Compass size={20} className="text-cream" strokeWidth={1.5} />
              <span className="font-serif text-xl text-cream tracking-tight">Trip.AI</span>
            </button>
            <div className="hidden sm:flex items-center gap-1">
              <button
                onClick={() => setView('plan')}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs uppercase tracking-[0.14em] transition-colors ${
                  view === 'plan' ? 'text-cream' : 'text-cream/50 hover:text-cream/80'
                }`}
              >
                Plan
              </button>
              <button
                onClick={() => setView('my-trips')}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs uppercase tracking-[0.14em] transition-colors ${
                  view === 'my-trips' ? 'text-cream' : 'text-cream/50 hover:text-cream/80'
                }`}
              >
                <MapPin size={12} strokeWidth={1.5} />
                My Trips
              </button>
              <button
                onClick={() => setView('bookmarks')}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs uppercase tracking-[0.14em] transition-colors ${
                  view === 'bookmarks' ? 'text-cream' : 'text-cream/50 hover:text-cream/80'
                }`}
              >
                <Bookmark size={12} strokeWidth={1.5} />
                Saved
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {hasItinerary && view === 'plan' && (
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
            <AuthNav />
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-6">
        {error && (
          <div className="mt-8 bg-terra/10 border-l-2 border-terra text-terra px-5 py-3 text-sm">
            {error}
          </div>
        )}

        {/* My Trips view */}
        {view === 'my-trips' && (
          <div className="mt-12 max-w-4xl mx-auto">
            <SavedTrips onLoadTrip={handleLoadTrip} />
          </div>
        )}

        {/* Bookmarks view */}
        {view === 'bookmarks' && (
          <div className="mt-12 max-w-6xl mx-auto">
            <BookmarksPage />
          </div>
        )}

        {/* Plan view */}
        {view === 'plan' && (
          <>
            {showForm && !hasItinerary && (
              <div className="mt-16 px-4 md:px-8 lg:px-12">
                <div className="mb-12">
                  <h1 className="font-serif text-5xl md:text-6xl text-ink mb-4 tracking-tight">Plan your next adventure</h1>
                  <p className="text-ink-light text-sm md:text-base max-w-xl leading-relaxed">
                    Tell us where you want to go, and our AI will craft a detailed itinerary with real places, costs, and routes.
                  </p>
                </div>
                <TripForm
                  onSubmit={handleTripSubmit}
                  disabled={loading}
                  theme={theme}
                  onThemeChange={setTheme}
                />
              </div>
            )}

            {loading && (
              <div className="mt-16 max-w-lg mx-auto text-center">
                <div className="border-t-2 border-terra w-12 mx-auto mb-6 animate-pulse" />
                <p className="font-serif text-2xl text-ink mb-2">Curating your trip</p>
                <p className="text-ink-muted text-sm">This usually takes 1–3 minutes</p>
              </div>
            )}

            {hasItinerary && (
              <div className="mt-12 grid grid-cols-1 xl:grid-cols-12 gap-0">
                {showForm && (
                  <div className="xl:col-span-3 xl:border-r border-rule">
                    <div className="p-6">
                      <TripForm
                        onSubmit={handleTripSubmit}
                        disabled={loading}
                        theme={theme}
                        onThemeChange={setTheme}
                      />
                    </div>
                  </div>
                )}

                <div className={showForm ? 'xl:col-span-4 xl:border-r border-rule' : 'xl:col-span-5 xl:border-r border-rule'}>
                  <ItineraryDisplay
                    itinerary={itinerary}
                    tripData={tripData}
                    onItineraryUpdate={handleItineraryUpdate}
                  />
                </div>

                <div className={showForm ? 'xl:col-span-5' : 'xl:col-span-7'}>
                  <div className="h-[500px] lg:h-[85vh] bg-cream-dark border-b border-rule xl:border-b-0 sticky top-[57px]">
                    <TripMap itinerary={itinerary} />
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
