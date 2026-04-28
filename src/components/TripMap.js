import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';
import 'leaflet-routing-machine';
import {
  computeJourneyStats,
  formatDistance,
  buildLegLookup
} from '../utils/map';
import {
  BarChart3, X, ChevronRight, MapPin, Navigation,
  Clock, TrendingUp, Footprints, Car, Bus, Train, Map as MapIcon
} from 'lucide-react';

// ─── Custom marker icons ─────────────────────────────────────

const createCustomIcon = (dayNumber, isActive) => {
  const colors = [
    '#6366F1', '#EC4899', '#F59E0B', '#10B981',
    '#3B82F6', '#8B5CF6', '#EF4444', '#14B8A6'
  ];
  const color = colors[(dayNumber - 1) % colors.length];

  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        width: 28px;
        height: 28px;
        background: ${color};
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 11px;
        font-weight: 700;
        font-family: system-ui, sans-serif;
      ">${dayNumber}</div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14]
  });
};

// ─── Popup content ───────────────────────────────────────────

function MarkerPopup({ point, prevLeg, nextLeg }) {
  return (
    <div className="min-w-[220px] max-w-[280px]">
      <div className="flex items-center gap-2 mb-1">
        <span
          className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded text-white"
          style={{ backgroundColor: point.dayColor }}
        >
          Day {point.dayNumber}
        </span>
        {point.time && (
          <span className="text-xs text-gray-500">{point.time}</span>
        )}
      </div>

      <h3 className="font-bold text-gray-800 text-sm leading-tight mb-1">
        {point.name}
      </h3>
      <p className="text-xs text-gray-500 line-clamp-2 mb-2">
        {point.description}
      </p>

      {point.cost !== undefined && (
        <p className="text-xs font-medium text-gray-700 mb-2">
          ${point.cost}
        </p>
      )}

      {prevLeg && (
        <div className="border-t border-gray-100 pt-2 mb-2">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">
            Getting here
          </p>
          <p className="text-xs text-gray-600">
            From <span className="font-medium">{prevLeg.from}</span>
          </p>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs text-gray-500">{formatDistance(prevLeg.distance)}</span>
            <span className="text-xs text-gray-400">•</span>
            <span className="text-xs text-gray-500">{prevLeg.durationText}</span>
            <span className="text-xs text-gray-400">•</span>
            <span className="text-xs text-gray-500 capitalize">{prevLeg.mode}</span>
          </div>
        </div>
      )}

      {nextLeg && (
        <div className="border-t border-gray-100 pt-2 mb-2">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">
            Next stop
          </p>
          <p className="text-xs text-gray-600">
            To <span className="font-medium">{nextLeg.to}</span>
          </p>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs text-gray-500">{formatDistance(nextLeg.distance)}</span>
            <span className="text-xs text-gray-400">•</span>
            <span className="text-xs text-gray-500">{nextLeg.durationText}</span>
            <span className="text-xs text-gray-400">•</span>
            <span className="text-xs text-gray-500 capitalize">{nextLeg.mode}</span>
          </div>
        </div>
      )}

      <a
        href={`https://www.google.com/maps/dir/?api=1&destination=${point.coordinates.lat},${point.coordinates.lng}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 mt-1"
        onClick={(e) => e.stopPropagation()}
      >
        <Navigation size={12} />
        Get Directions
      </a>
    </div>
  );
}

// ─── Transport mode icon ─────────────────────────────────────

function TransportIcon({ mode }) {
  const m = mode?.toLowerCase() || '';
  if (m.includes('walk')) return <Footprints size={14} />;
  if (m.includes('bus') || m.includes('transit')) return <Bus size={14} />;
  if (m.includes('train')) return <Train size={14} />;
  return <Car size={14} />;
}

// ─── Journey stats panel ─────────────────────────────────────

function JourneyStatsPanel({ stats, onClose, activeDay, onDayClick }) {
  if (!stats) return null;

  const filteredDayStats = activeDay
    ? stats.dayStats.filter((d) => d.day === activeDay)
    : stats.dayStats;

  return (
    <div className="absolute top-14 right-3 z-[400] w-72 bg-white/95 backdrop-blur rounded-xl shadow-xl border border-gray-100 max-h-[70vh] overflow-y-auto">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <BarChart3 size={16} className="text-gray-500" />
          <span className="font-semibold text-sm text-gray-800">Journey Stats</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* Overview */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-gray-50 rounded-lg p-2.5 text-center">
            <MapIcon size={16} className="mx-auto text-gray-400 mb-1" />
            <p className="text-lg font-bold text-gray-800">{formatDistance(stats.totalDistance)}</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wide">Total Distance</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-2.5 text-center">
            <Clock size={16} className="mx-auto text-gray-400 mb-1" />
            <p className="text-lg font-bold text-gray-800">{stats.totalDurationText}</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wide">Travel Time</p>
          </div>
        </div>

        {/* Longest leg */}
        {stats.longestLeg.distance > 0 && (
          <div className="bg-amber-50 rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp size={12} className="text-amber-600" />
              <span className="text-[10px] font-semibold text-amber-700 uppercase tracking-wide">
                Longest Leg
              </span>
            </div>
            <p className="text-xs text-gray-700">
              {stats.longestLeg.from} → {stats.longestLeg.to}
            </p>
            <p className="text-xs text-gray-500">
              {formatDistance(stats.longestLeg.distance)} • {stats.longestLeg.durationText} • Day {stats.longestLeg.day}
            </p>
          </div>
        )}

        {/* Transport breakdown */}
        {stats.transportBreakdown.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Transport Breakdown
            </p>
            <div className="space-y-1.5">
              {stats.transportBreakdown.map((t) => (
                <div key={t.mode} className="flex items-center gap-2">
                  <TransportIcon mode={t.mode} />
                  <div className="flex-1">
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="capitalize text-gray-600">{t.mode}</span>
                      <span className="text-gray-500">{t.percentage}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full transition-all"
                        style={{ width: `${t.percentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Per day */}
        <div>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
            By Day
          </p>
          <div className="space-y-1.5">
            {filteredDayStats.map((day) => (
              <button
                key={day.day}
                onClick={() => onDayClick(day.day === activeDay ? null : day.day)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors ${
                  day.day === activeDay
                    ? 'bg-indigo-50 border border-indigo-100'
                    : 'bg-gray-50 hover:bg-gray-100'
                }`}
              >
                <span className="text-xs font-bold text-gray-500 w-8">D{day.day}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-700 truncate">
                    {day.activityCount} activities{day.mealCount > 0 ? `, ${day.mealCount} meals` : ''}
                  </p>
                  {day.distance > 0 && (
                    <p className="text-[10px] text-gray-400">
                      {formatDistance(day.distance)} • {day.durationText} travel
                    </p>
                  )}
                </div>
                <ChevronRight size={12} className="text-gray-400 shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────

const TripMap = ({ itinerary }) => {
  const [map, setMap] = useState(null);
  const [activeDay, setActiveDay] = useState(null); // null = all days
  const [showStats, setShowStats] = useState(false);

  // Compute mappable points with metadata
  const allPoints = useMemo(() => {
    if (!itinerary?.days) return [];

    const dayColors = [
      '#6366F1', '#EC4899', '#F59E0B', '#10B981',
      '#3B82F6', '#8B5CF6', '#EF4444', '#14B8A6'
    ];

    const points = [];
    itinerary.days.forEach((day, dayIndex) => {
      const dayNumber = dayIndex + 1;
      const dayColor = dayColors[dayIndex % dayColors.length];

      (day.activities || []).forEach((activity, actIndex) => {
        if (
          activity.coordinates?.lat &&
          activity.coordinates?.lng &&
          !isNaN(activity.coordinates.lat) &&
          !isNaN(activity.coordinates.lng)
        ) {
          points.push({
            ...activity,
            dayIndex,
            dayNumber,
            dayColor,
            sequenceIndex: actIndex,
            type: 'activity'
          });
        }
      });

      // Include meals if they have coordinates
      (day.meals || []).forEach((meal, mealIndex) => {
        if (
          meal.coordinates?.lat &&
          meal.coordinates?.lng &&
          !isNaN(meal.coordinates.lat) &&
          !isNaN(meal.coordinates.lng)
        ) {
          points.push({
            ...meal,
            dayIndex,
            dayNumber,
            dayColor,
            sequenceIndex: mealIndex + (day.activities || []).length,
            type: 'meal'
          });
        }
      });
    });

    // Sort within each day by sequence
    return points.sort((a, b) => {
      if (a.dayIndex !== b.dayIndex) return a.dayIndex - b.dayIndex;
      return a.sequenceIndex - b.sequenceIndex;
    });
  }, [itinerary]);

  const visiblePoints = useMemo(() => {
    if (activeDay === null) return allPoints;
    return allPoints.filter((p) => p.dayNumber === activeDay);
  }, [allPoints, activeDay]);

  const stats = useMemo(() => computeJourneyStats(itinerary), [itinerary]);
  const { toMap, fromMap } = useMemo(() => buildLegLookup(stats?.dayStats), [stats]);

  // Fit bounds when visible points change
  useEffect(() => {
    if (map && visiblePoints.length > 0) {
      const bounds = L.latLngBounds(
        visiblePoints.map((p) => [p.coordinates.lat, p.coordinates.lng])
      );
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
    }
  }, [map, visiblePoints]);

  // Routing control — draw route for visible points
  useEffect(() => {
    if (!map || visiblePoints.length < 2) {
      // Remove existing routing controls if not enough points
      if (map) {
        map.eachLayer((layer) => {
          if (layer instanceof L.Routing.Control) {
            map.removeLayer(layer);
          }
        });
      }
      return;
    }

    // Remove old routing controls
    map.eachLayer((layer) => {
      if (layer instanceof L.Routing.Control) {
        map.removeLayer(layer);
      }
    });

    try {
      const waypoints = visiblePoints.map((p) =>
        L.latLng(p.coordinates.lat, p.coordinates.lng)
      );

      // Use a different color for each day when viewing single day
      const routeColor = activeDay !== null
        ? visiblePoints[0]?.dayColor || '#6366F1'
        : '#6366F1';

      L.Routing.control({
        waypoints,
        routeWhileDragging: false,
        show: false,
        addWaypoints: false,
        draggableWaypoints: false,
        fitSelectedRoutes: false,
        lineOptions: {
          styles: [
            { color: 'white', weight: 7, opacity: 0.6 },
            { color: routeColor, weight: 4, opacity: 0.9 }
          ]
        },
        createMarker: () => null // We render our own markers
      }).addTo(map);
    } catch (error) {
      console.error('Error setting up route:', error);
    }
  }, [map, visiblePoints, activeDay]);

  // Empty state
  if (!itinerary || allPoints.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-gray-50 rounded-2xl">
        <div className="text-center p-6">
          <MapPin size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm">Generate an itinerary to see the map</p>
        </div>
      </div>
    );
  }

  const defaultCenter = [18.5204, 73.8567];
  const center = visiblePoints.length > 0
    ? [visiblePoints[0].coordinates.lat, visiblePoints[0].coordinates.lng]
    : defaultCenter;

  const dayCount = itinerary.days?.length || 0;

  return (
    <div className="relative h-full w-full">
      {/* Day filter */}
      <div className="absolute top-3 left-3 right-16 z-[400] flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        <button
          onClick={() => setActiveDay(null)}
          className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
            activeDay === null
              ? 'bg-gray-800 text-white border-gray-800 shadow-md'
              : 'bg-white/90 text-gray-600 border-gray-200 hover:bg-white'
          }`}
        >
          All Days
        </button>
        {Array.from({ length: dayCount }, (_, i) => i + 1).map((day) => (
          <button
            key={day}
            onClick={() => setActiveDay(activeDay === day ? null : day)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
              activeDay === day
                ? 'text-white shadow-md'
                : 'bg-white/90 text-gray-600 border-gray-200 hover:bg-white'
            }`}
            style={
              activeDay === day
                ? {
                    backgroundColor: allPoints.find((p) => p.dayNumber === day)?.dayColor || '#6366F1',
                    borderColor: allPoints.find((p) => p.dayNumber === day)?.dayColor || '#6366F1'
                  }
                : {}
            }
          >
            Day {day}
          </button>
        ))}
      </div>

      {/* Stats toggle */}
      <button
        onClick={() => setShowStats((s) => !s)}
        className={`absolute top-3 right-3 z-[400] flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border shadow-sm transition-all ${
          showStats
            ? 'bg-gray-800 text-white border-gray-800'
            : 'bg-white/90 text-gray-600 border-gray-200 hover:bg-white'
        }`}
      >
        <BarChart3 size={13} />
        Stats
      </button>

      {/* Stats panel */}
      {showStats && (
        <JourneyStatsPanel
          stats={stats}
          onClose={() => setShowStats(false)}
          activeDay={activeDay}
          onDayClick={setActiveDay}
        />
      )}

      <MapContainer
        center={center}
        zoom={12}
        style={{ height: '100%', width: '100%' }}
        ref={setMap}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors'
        />
        {visiblePoints.map((point) => {
          const prevLeg = toMap.get(point.name);
          const nextLeg = fromMap.get(point.name);

          return (
            <Marker
              key={`${point.dayNumber}-${point.sequenceIndex}-${point.name}`}
              position={[point.coordinates.lat, point.coordinates.lng]}
              icon={createCustomIcon(point.dayNumber, activeDay === point.dayNumber || activeDay === null)}
            >
              <Popup maxWidth={300}>
                <MarkerPopup
                  point={point}
                  prevLeg={prevLeg}
                  nextLeg={nextLeg}
                />
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
};

export default TripMap;
