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

const createCustomIcon = (dayNumber) => {
  const colors = [
    '#C9593A', '#6B5C4A', '#1A1208', '#B0A090',
    '#8B7355', '#A08060', '#5C4A3A', '#D8D0C4'
  ];
  const color = colors[(dayNumber - 1) % colors.length];

  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        width: 28px;
        height: 28px;
        background: ${color};
        border: 2px solid #F5F0E8;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #F5F0E8;
        font-size: 11px;
        font-weight: 600;
        font-family: 'Inter', system-ui, sans-serif;
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
    <div className="min-w-[200px] max-w-[260px] font-sans">
      <div className="flex items-center gap-2 mb-1">
        <span
          className="text-[9px] uppercase tracking-[0.14em] px-1.5 py-0.5 text-cream"
          style={{ backgroundColor: point.dayColor }}
        >
          Day {point.dayNumber}
        </span>
        {point.time && <span className="text-xs text-ink-muted">{point.time}</span>}
      </div>
      <h3 className="font-serif text-base text-ink leading-tight mb-1">{point.name}</h3>
      <p className="text-xs text-ink-light line-clamp-2 mb-2">{point.description}</p>
      {point.cost !== undefined && <p className="text-xs font-medium text-ink mb-2">${point.cost}</p>}

      {prevLeg && (
        <div className="border-t border-rule pt-2 mb-2">
          <p className="text-[9px] uppercase tracking-[0.14em] text-ink-muted mb-1">Getting Here</p>
          <p className="text-xs text-ink-light">From <span className="text-ink">{prevLeg.from}</span></p>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-ink-muted">
            <span>{formatDistance(prevLeg.distance)}</span>
            <span>•</span>
            <span>{prevLeg.durationText}</span>
            <span>•</span>
            <span className="capitalize">{prevLeg.mode}</span>
          </div>
        </div>
      )}

      {nextLeg && (
        <div className="border-t border-rule pt-2 mb-2">
          <p className="text-[9px] uppercase tracking-[0.14em] text-ink-muted mb-1">Next Stop</p>
          <p className="text-xs text-ink-light">To <span className="text-ink">{nextLeg.to}</span></p>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-ink-muted">
            <span>{formatDistance(nextLeg.distance)}</span>
            <span>•</span>
            <span>{nextLeg.durationText}</span>
            <span>•</span>
            <span className="capitalize">{nextLeg.mode}</span>
          </div>
        </div>
      )}

      <a
        href={`https://www.google.com/maps/dir/?api=1&destination=${point.coordinates.lat},${point.coordinates.lng}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] text-terra hover:text-terra-dark transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        <Navigation size={10} />
        Get Directions
      </a>
    </div>
  );
}

// ─── Transport mode icon ─────────────────────────────────────

function TransportIcon({ mode }) {
  const m = mode?.toLowerCase() || '';
  if (m.includes('walk')) return <Footprints size={13} strokeWidth={1.5} />;
  if (m.includes('bus') || m.includes('transit')) return <Bus size={13} strokeWidth={1.5} />;
  if (m.includes('train')) return <Train size={13} strokeWidth={1.5} />;
  return <Car size={13} strokeWidth={1.5} />;
}

// ─── Journey stats panel ─────────────────────────────────────

function JourneyStatsPanel({ stats, onClose, activeDay, onDayClick }) {
  if (!stats) return null;

  const filteredDayStats = activeDay
    ? stats.dayStats.filter((d) => d.day === activeDay)
    : stats.dayStats;

  return (
    <div className="absolute top-14 right-3 z-[400] w-64 bg-cream border border-rule shadow-xl max-h-[70vh] overflow-y-auto">
      <div className="flex items-center justify-between px-4 py-3 border-b border-rule">
        <div className="flex items-center gap-2">
          <BarChart3 size={14} className="text-ink-muted" strokeWidth={1.5} />
          <span className="text-xs font-medium text-ink uppercase tracking-[0.14em]">Stats</span>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-cream-dark text-ink-muted transition-colors">
          <X size={12} />
        </button>
      </div>

      <div className="px-4 py-4 space-y-4">
        <div className="grid grid-cols-2 gap-0 border-t border-rule">
          <div className="py-3 border-r border-rule">
            <MapIcon size={14} className="text-ink-muted mb-1" strokeWidth={1.5} />
            <p className="font-serif text-lg text-ink">{formatDistance(stats.totalDistance)}</p>
            <p className="text-[9px] uppercase tracking-[0.14em] text-ink-muted">Total Distance</p>
          </div>
          <div className="py-3 pl-3">
            <Clock size={14} className="text-ink-muted mb-1" strokeWidth={1.5} />
            <p className="font-serif text-lg text-ink">{stats.totalDurationText}</p>
            <p className="text-[9px] uppercase tracking-[0.14em] text-ink-muted">Travel Time</p>
          </div>
        </div>

        {stats.longestLeg.distance > 0 && (
          <div className="border-l-2 border-terra pl-3 py-2">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp size={11} className="text-terra" strokeWidth={1.5} />
              <span className="text-[9px] uppercase tracking-[0.14em] text-terra">Longest Leg</span>
            </div>
            <p className="text-xs text-ink">{stats.longestLeg.from} → {stats.longestLeg.to}</p>
            <p className="text-xs text-ink-light">{formatDistance(stats.longestLeg.distance)} • {stats.longestLeg.durationText} • Day {stats.longestLeg.day}</p>
          </div>
        )}

        {stats.transportBreakdown.length > 0 && (
          <div>
            <p className="text-[9px] uppercase tracking-[0.14em] text-ink-muted mb-2">Transport</p>
            <div className="space-y-2">
              {stats.transportBreakdown.map((t) => (
                <div key={t.mode} className="flex items-center gap-2">
                  <TransportIcon mode={t.mode} />
                  <div className="flex-1">
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="capitalize text-ink-light">{t.mode}</span>
                      <span className="text-ink-muted">{t.percentage}%</span>
                    </div>
                    <div className="h-[2px] bg-rule">
                      <div className="h-full bg-terra" style={{ width: `${t.percentage}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="text-[9px] uppercase tracking-[0.14em] text-ink-muted mb-2">By Day</p>
          <div className="space-y-1">
            {filteredDayStats.map((day) => (
              <button
                key={day.day}
                onClick={() => onDayClick(day.day === activeDay ? null : day.day)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors border-l-2 ${
                  day.day === activeDay ? 'bg-cream-dark border-terra' : 'border-transparent hover:bg-cream-dark/50'
                }`}
              >
                <span className="text-xs font-medium text-ink-muted w-6">D{day.day}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-ink">{day.activityCount} activities{day.mealCount > 0 ? `, ${day.mealCount} meals` : ''}</p>
                  {day.distance > 0 && (
                    <p className="text-[10px] text-ink-muted">{formatDistance(day.distance)} • {day.durationText}</p>
                  )}
                </div>
                <ChevronRight size={11} className="text-ink-muted shrink-0" />
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
              { color: '#F5F0E8', weight: 6, opacity: 0.8 },
              { color: routeColor, weight: 3, opacity: 0.9 }
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
      <div className="h-full w-full flex items-center justify-center bg-cream-dark">
        <div className="text-center p-6">
          <MapPin size={32} className="mx-auto text-ink-muted mb-3" strokeWidth={1.5} />
          <p className="text-ink-light text-sm">Generate an itinerary to see the map</p>
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
      <div className="absolute top-3 left-3 right-16 z-[400] flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
        <button
          onClick={() => setActiveDay(null)}
          className={`shrink-0 px-3 py-1.5 text-xs font-medium border transition-colors ${
            activeDay === null
              ? 'bg-ink text-cream border-ink'
              : 'bg-cream text-ink-light border-rule hover:border-ink'
          }`}
        >
          All Days
        </button>
        {Array.from({ length: dayCount }, (_, i) => i + 1).map((day) => (
          <button
            key={day}
            onClick={() => setActiveDay(activeDay === day ? null : day)}
            className={`shrink-0 px-3 py-1.5 text-xs font-medium border transition-colors ${
              activeDay === day
                ? 'text-cream'
                : 'bg-cream text-ink-light border-rule hover:border-ink'
            }`}
            style={
              activeDay === day
                ? {
                    backgroundColor: allPoints.find((p) => p.dayNumber === day)?.dayColor || '#C9593A',
                    borderColor: allPoints.find((p) => p.dayNumber === day)?.dayColor || '#C9593A'
                  }
                : {}
            }
          >
            Day {day}
          </button>
        ))}
      </div>

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
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />
        {visiblePoints.map((point) => {
          const prevLeg = toMap.get(point.name);
          const nextLeg = fromMap.get(point.name);

          return (
            <Marker
              key={`${point.dayNumber}-${point.sequenceIndex}-${point.name}`}
              position={[point.coordinates.lat, point.coordinates.lng]}
              icon={createCustomIcon(point.dayNumber)}
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
