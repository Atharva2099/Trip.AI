import { describe, it, expect } from 'vitest';
import {
  calculateDistance,
  formatDistance,
  formatDuration,
  estimateDuration,
  parseDurationMinutes,
  computeJourneyStats,
  buildLegLookup
} from './map';

describe('map utilities', () => {
  describe('calculateDistance', () => {
    it('returns 0 for identical points', () => {
      expect(calculateDistance(48.8566, 2.3522, 48.8566, 2.3522)).toBeCloseTo(0, 5);
    });

    it('Paris to London is roughly 343 km', () => {
      const d = calculateDistance(48.8566, 2.3522, 51.5074, -0.1278);
      expect(d).toBeGreaterThan(330);
      expect(d).toBeLessThan(360);
    });

    it('handles negative coordinates (southern/western hemispheres)', () => {
      const d = calculateDistance(-33.8688, 151.2093, -37.8136, 144.9631);
      expect(d).toBeGreaterThan(700);
      expect(d).toBeLessThan(720);
    });
  });

  describe('formatDistance', () => {
    it('formats sub-100m distances in metres', () => {
      expect(formatDistance(0.05)).toBe('50 m');
    });

    it('formats sub-10km distances to 1 decimal', () => {
      expect(formatDistance(3.45)).toBe('3.5 km');
    });

    it('rounds distances over 10km to integer km', () => {
      expect(formatDistance(15.7)).toBe('16 km');
    });

    it('returns — for null/undefined', () => {
      expect(formatDistance(null)).toBe('—');
      expect(formatDistance(undefined)).toBe('—');
    });
  });

  describe('formatDuration', () => {
    it('formats minutes-only numbers', () => {
      expect(formatDuration(45)).toBe('45 min');
    });

    it('formats hours+minutes', () => {
      expect(formatDuration(75)).toBe('1h 15m');
    });

    it('formats even hours without trailing 0m', () => {
      expect(formatDuration(120)).toBe('2h');
    });

    it('passes through pre-formatted strings', () => {
      expect(formatDuration('20 min')).toBe('20 min');
    });
  });

  describe('estimateDuration', () => {
    it('walking is 5 km/h', () => {
      const min = estimateDuration(1, 'walk');
      expect(min).toBeCloseTo(12, 0);
    });

    it('driving is 40 km/h', () => {
      const min = estimateDuration(10, 'drive');
      expect(min).toBeCloseTo(15, 0);
    });

    it('falls back to 35 km/h for unknown modes', () => {
      const min = estimateDuration(10, 'teleport');
      expect(min).toBeCloseTo(17.14, 1);
    });
  });

  describe('parseDurationMinutes', () => {
    it('parses "20 min"', () => {
      expect(parseDurationMinutes('20 min')).toBe(20);
    });

    it('parses "1h 30m"', () => {
      expect(parseDurationMinutes('1h 30m')).toBe(90);
    });

    it('returns 0 for null/empty', () => {
      expect(parseDurationMinutes(null)).toBe(0);
      expect(parseDurationMinutes('')).toBe(0);
    });
  });

  describe('computeJourneyStats', () => {
    const sample = {
      days: [
        {
          date: '2025-06-01',
          activities: [
            { name: 'Louvre',  coordinates: { lat: 48.8606, lng: 2.3376 }, cost: 20, transport: { method: 'walk', duration: '15 min' } },
            { name: 'Notre-Dame', coordinates: { lat: 48.8530, lng: 2.3499 }, cost: 0,  transport: { method: 'walk', duration: '20 min' } }
          ],
          meals: [],
          accommodation_options: [
            { name: 'Hotel A', coordinates: { lat: 48.8566, lng: 2.3522 } }
          ]
        },
        {
          date: '2025-06-02',
          activities: [
            { name: 'Eiffel Tower', coordinates: { lat: 48.8584, lng: 2.2945 }, cost: 28, transport: { method: 'taxi', duration: '10 min' } }
          ],
          meals: [],
          accommodation_options: [
            { name: 'Hotel B', coordinates: { lat: 45.7640, lng: 4.8357 } } // Lyon
          ]
        }
      ]
    };

    it('returns null for empty input', () => {
      expect(computeJourneyStats(null)).toBeNull();
      expect(computeJourneyStats({})).toBeNull();
    });

    it('computes totals across all days', () => {
      const stats = computeJourneyStats(sample);
      expect(stats.dayStats).toHaveLength(2);
      expect(stats.totalDistance).toBeGreaterThan(0);
      expect(stats.totalLegs).toBeGreaterThan(0);
    });

    it('counts activities per day', () => {
      const stats = computeJourneyStats(sample);
      expect(stats.dayStats[0].activityCount).toBe(2);
      expect(stats.dayStats[1].activityCount).toBe(1);
    });

    it('flags longest leg correctly', () => {
      const stats = computeJourneyStats(sample);
      expect(stats.longestLeg.distance).toBeGreaterThan(0);
    });

    it('includes inter-city leg for days with hotel changes', () => {
      const stats = computeJourneyStats(sample);
      const intercity = stats.dayStats[1].legs.find(l => l.isInterCity);
      expect(intercity).toBeDefined();
      expect(intercity.from).toBe('Hotel A');
      expect(intercity.to).toBe('Hotel B');
    });

    it('skips activities without valid coordinates', () => {
      const stats = computeJourneyStats({
        days: [{ activities: [{ name: 'X' }, { name: 'Y', coordinates: { lat: 0, lng: 0 } }], meals: [] }]
      });
      expect(stats.totalActivities).toBe(0);
    });
  });

  describe('buildLegLookup', () => {
    it('builds toMap and fromMap by name', () => {
      const dayStats = [{
        legs: [
          { from: 'A', to: 'B', distance: 1 },
          { from: 'B', to: 'C', distance: 2 }
        ]
      }];
      const { toMap, fromMap } = buildLegLookup(dayStats);
      expect(toMap.get('B').distance).toBe(1);
      expect(toMap.get('C').distance).toBe(2);
      expect(fromMap.get('A').distance).toBe(1);
      expect(fromMap.get('B').distance).toBe(2);
    });

    it('handles null dayStats', () => {
      const { toMap, fromMap } = buildLegLookup(null);
      expect(toMap.size).toBe(0);
      expect(fromMap.size).toBe(0);
    });
  });
});
