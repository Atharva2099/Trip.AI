import React, { useState, useEffect } from 'react';
import { MapPin, Calendar, Trash2, Loader2, Eye } from 'lucide-react';
import { tripsApi } from '../api/client';

export default function SavedTrips({ onLoadTrip }) {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [loadingTrip, setLoadingTrip] = useState(null);

  useEffect(() => {
    loadTrips();
  }, []);

  async function loadTrips() {
    setLoading(true);
    try {
      const data = await tripsApi.list();
      setTrips(data.trips || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleViewTrip(trip) {
    setLoadingTrip(trip.id);
    try {
      const fullTrip = await tripsApi.get(trip.id);
      onLoadTrip(fullTrip);
    } catch (err) {
      alert('Failed to load trip: ' + err.message);
    } finally {
      setLoadingTrip(null);
    }
  }

  async function handleDelete(id) {
    setDeleting(id);
    try {
      await tripsApi.delete(id);
      setTrips((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      alert('Failed to delete: ' + err.message);
    } finally {
      setDeleting(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={20} className="animate-spin text-ink-muted" strokeWidth={1.5} />
        <span className="ml-3 text-sm text-ink-light">Loading your trips...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-12 text-center">
        <p className="text-terra text-sm">{error}</p>
        <button onClick={loadTrips} className="mt-4 text-xs uppercase tracking-[0.14em] text-ink-light hover:text-terra transition-colors">
          Retry
        </button>
      </div>
    );
  }

  if (trips.length === 0) {
    return (
      <div className="py-20 text-center">
        <MapPin size={32} className="mx-auto text-ink-muted mb-4" strokeWidth={1.5} />
        <h2 className="font-serif text-2xl text-ink mb-2">No saved trips yet</h2>
        <p className="text-ink-light text-sm max-w-sm mx-auto mb-6">
          Generate your first itinerary and it will be automatically saved here for easy access.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="font-serif text-3xl text-ink mb-8 tracking-tight">My Trips</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0 border-t border-rule">
        {trips.map((trip) => (
          <div
            key={trip.id}
            className="border-b border-r border-rule p-6 hover:bg-cream-dark transition-colors group"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-serif text-lg text-ink leading-tight">{trip.title || trip.destination}</h3>
                <div className="flex items-center gap-1.5 mt-1 text-xs text-ink-muted">
                  <MapPin size={11} strokeWidth={1.5} />
                  {trip.destination}
                </div>
              </div>
              <button
                onClick={() => handleDelete(trip.id)}
                disabled={deleting === trip.id}
                className="p-1.5 text-ink-muted hover:text-terra opacity-0 group-hover:opacity-100 transition-opacity"
              >
                {deleting === trip.id ? (
                  <Loader2 size={13} className="animate-spin" strokeWidth={1.5} />
                ) : (
                  <Trash2 size={13} strokeWidth={1.5} />
                )}
              </button>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-ink-light mb-4">
              <Calendar size={11} strokeWidth={1.5} />
              {trip.start_date && trip.end_date
                ? `${formatDate(trip.start_date)} — ${formatDate(trip.end_date)}`
                : 'Dates not set'}
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="font-serif text-xl text-ink">${(trip.proposed_budget || trip.budget)?.toLocaleString()}</span>
                <span className="text-[10px] uppercase tracking-[0.14em] text-ink-muted ml-2">
                  {trip.proposed_budget ? 'proposed' : 'budget'}
                </span>
              </div>
              <button
                onClick={() => handleViewTrip(trip)}
                disabled={loadingTrip === trip.id}
                className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] px-3 py-1.5 border border-rule text-ink-light hover:border-terra hover:text-terra transition-colors"
              >
                {loadingTrip === trip.id ? (
                  <Loader2 size={11} className="animate-spin" strokeWidth={1.5} />
                ) : (
                  <Eye size={11} strokeWidth={1.5} />
                )}
                View Trip
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
