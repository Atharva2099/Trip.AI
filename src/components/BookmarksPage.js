import React, { useState, useEffect, useMemo } from 'react';
import { Heart, MapPin, UtensilsCrossed, Building2, Trash2, Loader2, Filter, ArrowUpDown } from 'lucide-react';
import { bookmarksApi } from '../api/client';

export function BookmarkButton({ item, destination, type, onToggle }) {
  const [bookmarked, setBookmarked] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check if already bookmarked on mount
    checkBookmarked();
  }, [item.name]);

  async function checkBookmarked() {
    try {
      const { bookmarks } = await bookmarksApi.list();
      const exists = bookmarks.some(b => b.name === item.name && b.type === type);
      setBookmarked(exists);
    } catch { /* ignore */ }
  }

  async function handleToggle(e) {
    e.stopPropagation();
    setLoading(true);
    try {
      if (bookmarked) {
        const { bookmarks } = await bookmarksApi.list();
        const existing = bookmarks.find(b => b.name === item.name && b.type === type);
        if (existing) {
          await bookmarksApi.delete(existing.id);
          setBookmarked(false);
        }
      } else {
        await bookmarksApi.create({
          name: item.name,
          destination,
          type,
          coordinates: item.coordinates || null,
          notes: item.cuisine || item.description || ''
        });
        setBookmarked(true);
      }
      if (onToggle) onToggle();
    } catch (err) {
      console.error('Bookmark error:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`p-1 transition-colors ${
        bookmarked ? 'text-terra' : 'text-ink-muted hover:text-terra'
      }`}
    >
      {loading ? (
        <Loader2 size={14} className="animate-spin" strokeWidth={1.5} />
      ) : (
        <Heart size={14} fill={bookmarked ? 'currentColor' : 'none'} strokeWidth={1.5} />
      )}
    </button>
  );
}

export default function BookmarksPage() {
  const [bookmarks, setBookmarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortBy, setSortBy] = useState('date'); // 'date' | 'destination' | 'type'
  const [filterType, setFilterType] = useState('all'); // 'all' | 'activity' | 'meal' | 'accommodation'

  useEffect(() => {
    loadBookmarks();
  }, []);

  async function loadBookmarks() {
    setLoading(true);
    try {
      const data = await bookmarksApi.list();
      setBookmarks(data.bookmarks || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    try {
      await bookmarksApi.delete(id);
      setBookmarks((prev) => prev.filter((b) => b.id !== id));
    } catch (err) {
      alert('Failed to delete: ' + err.message);
    }
  }

  const filtered = useMemo(() => {
    let result = [...bookmarks];
    if (filterType !== 'all') {
      result = result.filter(b => b.type === filterType);
    }
    
    switch (sortBy) {
      case 'date':
        result.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
        break;
      case 'destination':
        result.sort((a, b) => (a.destination || '').localeCompare(b.destination || ''));
        break;
      case 'type':
        result.sort((a, b) => (a.type || '').localeCompare(b.type || ''));
        break;
      default:
        break;
    }
    return result;
  }, [bookmarks, filterType, sortBy]);

  const groupedByType = useMemo(() => {
    const groups = {};
    filtered.forEach(b => {
      const type = b.type || 'other';
      if (!groups[type]) groups[type] = [];
      groups[type].push(b);
    });
    return groups;
  }, [filtered]);

  const groupedByDestination = useMemo(() => {
    const groups = {};
    filtered.forEach(b => {
      const dest = b.destination || 'Unknown';
      if (!groups[dest]) groups[dest] = [];
      groups[dest].push(b);
    });
    return groups;
  }, [filtered]);

  const typeLabels = {
    activity: 'Activities & Places',
    meal: 'Restaurants & Food',
    accommodation: 'Hotels & Stays'
  };

  const typeIcons = {
    activity: MapPin,
    meal: UtensilsCrossed,
    accommodation: Building2
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={20} className="animate-spin text-ink-muted" strokeWidth={1.5} />
        <span className="ml-3 text-sm text-ink-light">Loading saved places...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-12 text-center">
        <p className="text-terra text-sm">{error}</p>
        <button onClick={loadBookmarks} className="mt-4 text-xs uppercase tracking-[0.14em] text-ink-light hover:text-terra transition-colors">
          Retry
        </button>
      </div>
    );
  }

  if (bookmarks.length === 0) {
    return (
      <div className="py-20 text-center">
        <Heart size={32} className="mx-auto text-ink-muted mb-4" strokeWidth={1.5} />
        <h2 className="font-serif text-2xl text-ink mb-2">No saved places yet</h2>
        <p className="text-ink-light text-sm max-w-sm mx-auto">
          Click the heart icon on any activity, meal, or hotel to save it here for future trips.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h2 className="font-serif text-3xl text-ink tracking-tight">Saved Places</h2>
        <span className="text-[10px] uppercase tracking-[0.14em] text-ink-muted">
          {bookmarks.length} saved
        </span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-8 pb-6 border-b border-rule">
        <div className="flex items-center gap-1">
          <Filter size={12} className="text-ink-muted" strokeWidth={1.5} />
          <span className="text-[10px] uppercase tracking-[0.14em] text-ink-muted">Filter</span>
        </div>
        {[
          { key: 'all', label: 'All' },
          { key: 'activity', label: 'Activities' },
          { key: 'meal', label: 'Food' },
          { key: 'accommodation', label: 'Hotels' }
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilterType(f.key)}
            className={`text-[10px] uppercase tracking-[0.14em] px-3 py-1.5 border transition-colors ${
              filterType === f.key
                ? 'bg-ink text-cream border-ink'
                : 'border-rule text-ink-light hover:border-terra hover:text-terra'
            }`}
          >
            {f.label}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-1">
          <ArrowUpDown size={12} className="text-ink-muted" strokeWidth={1.5} />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="text-[10px] uppercase tracking-[0.14em] text-ink-light bg-transparent border-none focus:outline-none cursor-pointer"
          >
            <option value="date">Date Added</option>
            <option value="destination">Destination</option>
            <option value="type">Type</option>
          </select>
        </div>
      </div>

      {/* Grouped by Type */}
      {Object.entries(groupedByType).map(([type, items]) => {
        const Icon = typeIcons[type] || MapPin;
        return (
          <div key={type} className="mb-12">
            <div className="flex items-center gap-2 mb-4">
              <Icon size={16} className="text-terra" strokeWidth={1.5} />
              <h3 className="text-[10px] uppercase tracking-[0.14em] text-ink-light">
                {typeLabels[type] || type} ({items.length})
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0 border-t border-rule">
              {items.map((bookmark) => (
                <div
                  key={bookmark.id}
                  className="border-b border-r border-rule p-5 hover:bg-cream-dark transition-colors group"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-serif text-base text-ink">{bookmark.name}</h4>
                      {bookmark.destination && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-ink-muted">
                          <MapPin size={10} strokeWidth={1.5} />
                          {bookmark.destination}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleDelete(bookmark.id)}
                      className="p-1 text-ink-muted hover:text-terra opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={12} strokeWidth={1.5} />
                    </button>
                  </div>

                  {bookmark.notes && (
                    <p className="text-xs text-ink-light line-clamp-2 mb-2">{bookmark.notes}</p>
                  )}

                  {bookmark.coordinates?.lat && (
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${bookmark.coordinates.lat},${bookmark.coordinates.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] text-terra hover:text-terra-dark transition-colors"
                    >
                      <MapPin size={10} />
                      Get Directions
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* By Destination summary */}
      {Object.keys(groupedByDestination).length > 1 && (
        <div className="mt-12 pt-8 border-t border-rule">
          <h3 className="text-[10px] uppercase tracking-[0.14em] text-ink-light mb-4">
            By Destination
          </h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(groupedByDestination).map(([dest, items]) => (
              <button
                key={dest}
                onClick={() => setFilterType('all')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-rule text-ink-light hover:border-terra hover:text-terra transition-colors"
              >
                <MapPin size={11} strokeWidth={1.5} />
                {dest} ({items.length})
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
