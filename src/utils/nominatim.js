/**
 * Nominatim (OpenStreetMap) autocomplete utilities
 * Free, no API key required
 */

let lastNominatimCall = 0;
const MIN_INTERVAL = 1100; // 1.1s to be safe under 1 req/sec

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Search for places using Nominatim
 * @param {string} query - Search query
 * @returns {Promise<Array>} Array of place results
 */
export async function searchPlaces(query) {
  if (!query || query.length < 2) return [];

  const now = Date.now();
  const timeSinceLast = now - lastNominatimCall;
  if (timeSinceLast < MIN_INTERVAL) {
    await wait(MIN_INTERVAL - timeSinceLast);
  }
  lastNominatimCall = Date.now();

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`;
    const response = await fetch(url, {
      headers: {
        'Accept-Language': 'en-US,en'
      }
    });

    if (!response.ok) {
      console.error('Nominatim error:', response.status);
      return [];
    }

    const data = await response.json();
    return data.map((item) => ({
      id: item.place_id,
      name: item.display_name.split(',')[0],
      fullName: item.display_name,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      type: item.type,
      class: item.class,
      country: item.address?.country || ''
    }));
  } catch (error) {
    console.error('Nominatim search error:', error);
    return [];
  }
}

/**
 * Get Lucide icon name for a place type
 * @param {string} type - Nominatim place type
 * @param {string} className - Nominatim place class
 * @returns {string} Icon name
 */
export function getPlaceIcon(type, className) {
  if (type === 'country') return 'Globe';
  if (type === 'city' || type === 'town' || type === 'village') return 'Building2';
  if (type === 'administrative') return 'MapPin';
  if (className === 'tourism') return 'Camera';
  if (className === 'natural' || type === 'park') return 'Trees';
  if (className === 'leisure') return 'Palmtree';
  if (type === 'island') return 'MountainSnow';
  if (type === 'lake' || type === 'river') return 'Waves';
  return 'MapPin';
}

/**
 * Get hemisphere from latitude
 * @param {number} lat
 * @returns {string} 'northern' | 'southern' | 'equatorial'
 */
export function getHemisphere(lat) {
  if (lat > 23.5) return 'northern';
  if (lat < -23.5) return 'southern';
  return 'equatorial';
}
