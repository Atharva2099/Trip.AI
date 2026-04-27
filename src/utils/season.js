/**
 * Season and theme utilities for Trip.AI
 * Determines season based on latitude and month
 */

export const SEASONS = {
  SPRING: 'spring',
  SUMMER: 'summer',
  AUTUMN: 'autumn',
  WINTER: 'winter',
  TROPICAL_DRY: 'tropical-dry',
  TROPICAL_WET: 'tropical-wet'
};

export const THEMES = {
  [SEASONS.SPRING]: {
    name: 'Spring',
    bg: 'bg-gradient-to-br from-emerald-50 via-white to-rose-50',
    accent: 'text-emerald-700',
    accentBg: 'bg-emerald-600',
    accentBgHover: 'hover:bg-emerald-700',
    border: 'border-emerald-200',
    ring: 'focus:ring-emerald-500',
    chipActive: 'bg-emerald-600 text-white border-emerald-600',
    chipInactive: 'bg-white text-gray-600 border-gray-200 hover:border-emerald-300',
    icon: 'Flower2'
  },
  [SEASONS.SUMMER]: {
    name: 'Summer',
    bg: 'bg-gradient-to-br from-sky-50 via-white to-amber-50',
    accent: 'text-sky-700',
    accentBg: 'bg-sky-600',
    accentBgHover: 'hover:bg-sky-700',
    border: 'border-sky-200',
    ring: 'focus:ring-sky-500',
    chipActive: 'bg-sky-600 text-white border-sky-600',
    chipInactive: 'bg-white text-gray-600 border-gray-200 hover:border-sky-300',
    icon: 'Sun'
  },
  [SEASONS.AUTUMN]: {
    name: 'Autumn',
    bg: 'bg-gradient-to-br from-orange-50 via-white to-amber-100',
    accent: 'text-orange-700',
    accentBg: 'bg-orange-600',
    accentBgHover: 'hover:bg-orange-700',
    border: 'border-orange-200',
    ring: 'focus:ring-orange-500',
    chipActive: 'bg-orange-600 text-white border-orange-600',
    chipInactive: 'bg-white text-gray-600 border-gray-200 hover:border-orange-300',
    icon: 'Leaf'
  },
  [SEASONS.WINTER]: {
    name: 'Winter',
    bg: 'bg-gradient-to-br from-slate-100 via-white to-blue-100',
    accent: 'text-slate-700',
    accentBg: 'bg-slate-700',
    accentBgHover: 'hover:bg-slate-800',
    border: 'border-slate-300',
    ring: 'focus:ring-slate-500',
    chipActive: 'bg-slate-700 text-white border-slate-700',
    chipInactive: 'bg-white text-gray-600 border-gray-200 hover:border-slate-400',
    icon: 'Snowflake'
  },
  [SEASONS.TROPICAL_DRY]: {
    name: 'Dry Season',
    bg: 'bg-gradient-to-br from-yellow-50 via-white to-orange-50',
    accent: 'text-yellow-700',
    accentBg: 'bg-yellow-600',
    accentBgHover: 'hover:bg-yellow-700',
    border: 'border-yellow-200',
    ring: 'focus:ring-yellow-500',
    chipActive: 'bg-yellow-600 text-white border-yellow-600',
    chipInactive: 'bg-white text-gray-600 border-gray-200 hover:border-yellow-300',
    icon: 'Sun'
  },
  [SEASONS.TROPICAL_WET]: {
    name: 'Wet Season',
    bg: 'bg-gradient-to-br from-teal-50 via-white to-cyan-50',
    accent: 'text-teal-700',
    accentBg: 'bg-teal-600',
    accentBgHover: 'hover:bg-teal-700',
    border: 'border-teal-200',
    ring: 'focus:ring-teal-500',
    chipActive: 'bg-teal-600 text-white border-teal-600',
    chipInactive: 'bg-white text-gray-600 border-gray-200 hover:border-teal-300',
    icon: 'CloudRain'
  }
};

/**
 * Determine season based on latitude and date
 * @param {number} lat - Latitude (-90 to 90)
 * @param {Date} date - Date to check
 * @returns {string} Season key from SEASONS
 */
export function getSeason(lat, date) {
  const month = date.getMonth() + 1; // 1-12

  // Tropical zone (between Tropic of Cancer and Capricorn)
  if (Math.abs(lat) <= 23.5) {
    // Simple wet/dry split - varies by region but this is a reasonable default
    // Many tropical regions: wet season roughly May-Oct, dry Nov-Apr
    return month >= 5 && month <= 10 ? SEASONS.TROPICAL_WET : SEASONS.TROPICAL_DRY;
  }

  const isNorthern = lat > 0;

  if (isNorthern) {
    if (month >= 3 && month <= 5) return SEASONS.SPRING;
    if (month >= 6 && month <= 8) return SEASONS.SUMMER;
    if (month >= 9 && month <= 11) return SEASONS.AUTUMN;
    return SEASONS.WINTER;
  } else {
    // Southern hemisphere: reversed
    if (month >= 3 && month <= 5) return SEASONS.AUTUMN;
    if (month >= 6 && month <= 8) return SEASONS.WINTER;
    if (month >= 9 && month <= 11) return SEASONS.SPRING;
    return SEASONS.SUMMER;
  }
}

/**
 * Get theme object for a season
 * @param {string} season - Season key
 * @returns {Object} Theme configuration
 */
export function getTheme(season) {
  return THEMES[season] || THEMES[SEASONS.SPRING];
}
