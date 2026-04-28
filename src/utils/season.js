/**
 * Season and theme utilities for Trip.AI - Vanta Punk Editorial
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
    bg: 'bg-cream',
    accent: 'text-terra',
    accentBg: 'bg-terra',
    accentBgHover: 'hover:bg-terra-dark',
    border: 'border-rule',
    ring: 'focus:ring-terra',
    chipActive: 'bg-terra text-cream border-terra',
    chipInactive: 'bg-cream-dark text-ink-light border-rule hover:border-terra',
    icon: 'Flower2'
  },
  [SEASONS.SUMMER]: {
    name: 'Summer',
    bg: 'bg-cream',
    accent: 'text-terra',
    accentBg: 'bg-terra',
    accentBgHover: 'hover:bg-terra-dark',
    border: 'border-rule',
    ring: 'focus:ring-terra',
    chipActive: 'bg-terra text-cream border-terra',
    chipInactive: 'bg-cream-dark text-ink-light border-rule hover:border-terra',
    icon: 'Sun'
  },
  [SEASONS.AUTUMN]: {
    name: 'Autumn',
    bg: 'bg-cream',
    accent: 'text-terra',
    accentBg: 'bg-terra',
    accentBgHover: 'hover:bg-terra-dark',
    border: 'border-rule',
    ring: 'focus:ring-terra',
    chipActive: 'bg-terra text-cream border-terra',
    chipInactive: 'bg-cream-dark text-ink-light border-rule hover:border-terra',
    icon: 'Leaf'
  },
  [SEASONS.WINTER]: {
    name: 'Winter',
    bg: 'bg-cream',
    accent: 'text-terra',
    accentBg: 'bg-terra',
    accentBgHover: 'hover:bg-terra-dark',
    border: 'border-rule',
    ring: 'focus:ring-terra',
    chipActive: 'bg-terra text-cream border-terra',
    chipInactive: 'bg-cream-dark text-ink-light border-rule hover:border-terra',
    icon: 'Snowflake'
  },
  [SEASONS.TROPICAL_DRY]: {
    name: 'Dry Season',
    bg: 'bg-cream',
    accent: 'text-terra',
    accentBg: 'bg-terra',
    accentBgHover: 'hover:bg-terra-dark',
    border: 'border-rule',
    ring: 'focus:ring-terra',
    chipActive: 'bg-terra text-cream border-terra',
    chipInactive: 'bg-cream-dark text-ink-light border-rule hover:border-terra',
    icon: 'Sun'
  },
  [SEASONS.TROPICAL_WET]: {
    name: 'Wet Season',
    bg: 'bg-cream',
    accent: 'text-terra',
    accentBg: 'bg-terra',
    accentBgHover: 'hover:bg-terra-dark',
    border: 'border-rule',
    ring: 'focus:ring-terra',
    chipActive: 'bg-terra text-cream border-terra',
    chipInactive: 'bg-cream-dark text-ink-light border-rule hover:border-terra',
    icon: 'CloudRain'
  }
};

export function getSeason(lat, date) {
  const month = date.getMonth() + 1;
  if (Math.abs(lat) <= 23.5) {
    return month >= 5 && month <= 10 ? SEASONS.TROPICAL_WET : SEASONS.TROPICAL_DRY;
  }
  const isNorthern = lat > 0;
  if (isNorthern) {
    if (month >= 3 && month <= 5) return SEASONS.SPRING;
    if (month >= 6 && month <= 8) return SEASONS.SUMMER;
    if (month >= 9 && month <= 11) return SEASONS.AUTUMN;
    return SEASONS.WINTER;
  } else {
    if (month >= 3 && month <= 5) return SEASONS.AUTUMN;
    if (month >= 6 && month <= 8) return SEASONS.WINTER;
    if (month >= 9 && month <= 11) return SEASONS.SPRING;
    return SEASONS.SUMMER;
  }
}

export function getTheme(season) {
  return THEMES[season] || THEMES[SEASONS.SPRING];
}
