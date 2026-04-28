/**
 * Map utilities for distance calculations, journey stats, and formatting
 */

const EARTH_RADIUS_KM = 6371;

/**
 * Calculate distance between two points using Haversine formula
 */
export function calculateDistance(lat1, lng1, lat2, lng2) {
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * Format distance for display
 */
export function formatDistance(km) {
  if (km === undefined || km === null) return '—';
  if (km < 0.1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

/**
 * Format duration string for display
 * Accepts strings like "20 min", "1h 30m", or numbers (minutes)
 */
export function formatDuration(input) {
  if (!input) return '—';
  if (typeof input === 'number') {
    if (input < 60) return `${Math.round(input)} min`;
    const h = Math.floor(input / 60);
    const m = Math.round(input % 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  // Already a string, return as-is if it looks formatted
  return String(input);
}

/**
 * Estimate travel duration in minutes based on distance and mode
 */
export function estimateDuration(distanceKm, mode = 'drive') {
  const speeds = {
    walk: 5,
    drive: 40,
    car: 40,
    taxi: 35,
    transit: 25,
    bus: 25,
    train: 60,
    bike: 15,
    bicycle: 15
  };
  const speed = speeds[mode?.toLowerCase()] || 35;
  return (distanceKm / speed) * 60;
}

/**
 * Extract a number of minutes from a duration string like "20 min" or "1h 30m"
 */
export function parseDurationMinutes(durationStr) {
  if (!durationStr) return 0;
  if (typeof durationStr === 'number') return durationStr;

  const str = String(durationStr).toLowerCase().replace(/\s/g, '');
  let minutes = 0;

  const hourMatch = str.match(/(\d+(?:\.\d+)?)h/);
  if (hourMatch) minutes += parseFloat(hourMatch[1]) * 60;

  const minMatch = str.match(/(\d+(?:\.\d+)?)m/);
  if (minMatch) minutes += parseFloat(minMatch[1]);

  // "20 min" style
  const simpleMatch = str.match(/^(\d+(?:\.\d+)?)$/);
  if (simpleMatch && minutes === 0) minutes = parseFloat(simpleMatch[1]);

  return Math.round(minutes);
}

/**
 * Compute comprehensive journey statistics from an itinerary
 */
export function computeJourneyStats(itinerary) {
  if (!itinerary || !itinerary.days) {
    return null;
  }

  const dayStats = [];
  let totalDistance = 0;
  let totalDurationMinutes = 0;
  let longestLeg = { distance: 0, from: '', to: '', day: 0 };
  const transportModes = {};
  let totalLegs = 0;

  itinerary.days.forEach((day, dayIndex) => {
    const activities = (day.activities || []).filter(
      (a) => a.coordinates?.lat && a.coordinates?.lng && !isNaN(a.coordinates.lat)
    );

    let dayDistance = 0;
    let dayDuration = 0;
    const legs = [];

    for (let i = 1; i < activities.length; i++) {
      const prev = activities[i - 1];
      const curr = activities[i];

      const dist = calculateDistance(
        prev.coordinates.lat, prev.coordinates.lng,
        curr.coordinates.lat, curr.coordinates.lng
      );

      const mode = curr.transport?.method || 'drive';
      const parsedDuration = parseDurationMinutes(curr.transport?.duration);
      const estimatedDuration = estimateDuration(dist, mode);
      const durationMinutes = parsedDuration > 0 ? parsedDuration : estimatedDuration;

      dayDistance += dist;
      dayDuration += durationMinutes;
      totalDistance += dist;
      totalDurationMinutes += durationMinutes;
      totalLegs++;

      transportModes[mode] = (transportModes[mode] || 0) + dist;

      const leg = {
        from: prev.name,
        to: curr.name,
        fromCoords: prev.coordinates,
        toCoords: curr.coordinates,
        distance: dist,
        duration: durationMinutes,
        durationText: formatDuration(durationMinutes),
        mode,
        day: dayIndex + 1
      };
      legs.push(leg);

      if (dist > longestLeg.distance) {
        longestLeg = leg;
      }
    }

    dayStats.push({
      day: dayIndex + 1,
      date: day.date,
      distance: dayDistance,
      duration: dayDuration,
      durationText: formatDuration(dayDuration),
      legs,
      activityCount: activities.length,
      mealCount: (day.meals || []).length
    });
  });

  // Transport mode percentages
  const transportBreakdown = Object.entries(transportModes)
    .map(([mode, distance]) => ({
      mode,
      distance,
      percentage: totalDistance > 0 ? Math.round((distance / totalDistance) * 100) : 0
    }))
    .sort((a, b) => b.distance - a.distance);

  return {
    totalDistance,
    totalDuration: totalDurationMinutes,
    totalDurationText: formatDuration(totalDurationMinutes),
    totalLegs,
    dayStats,
    longestLeg,
    transportBreakdown,
    totalActivities: itinerary.days.reduce((sum, d) => sum + (d.activities || []).length, 0)
  };
}

/**
 * Build a lookup map for legs by activity name
 * Returns maps for "getting here" (leg.to = activity) and "next stop" (leg.from = activity)
 */
export function buildLegLookup(dayStats) {
  const toMap = new Map();   // leg.to -> leg (getting here)
  const fromMap = new Map(); // leg.from -> leg (next stop)

  if (!dayStats) return { toMap, fromMap };

  dayStats.forEach((day) => {
    day.legs.forEach((leg) => {
      toMap.set(leg.to, leg);
      fromMap.set(leg.from, leg);
    });
  });

  return { toMap, fromMap };
}
