const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
};

const formatDateShort = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export function getBookingComUrl(city, checkin, checkout) {
  if (!city) return null;
  const params = new URLSearchParams({
    ss: city,
    checkin: formatDate(checkin),
    checkout: formatDate(checkout),
  });
  return `https://www.booking.com/searchresults.html?${params.toString()}`;
}

export function getAirbnbUrl(city, checkin, checkout) {
  if (!city) return null;
  const slug = city.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-');
  const ci = formatDate(checkin);
  const co = formatDate(checkout);
  const base = `https://www.airbnb.com/s/${encodeURIComponent(slug)}/homes`;
  const params = new URLSearchParams();
  if (ci) params.set('checkin', ci);
  if (co) params.set('checkout', co);
  return params.toString() ? `${base}?${params.toString()}` : base;
}

export function getGetYourGuideUrl(name, city) {
  const q = [name, city].filter(Boolean).join(' ');
  if (!q) return null;
  return `https://www.getyourguide.com/s?q=${encodeURIComponent(q)}`;
}

export function getViatorUrl(name, city) {
  const q = [name, city].filter(Boolean).join(' ');
  if (!q) return null;
  return `https://www.viator.com/searchResults/all?text=${encodeURIComponent(q)}`;
}

export function getOpenTableUrl(name, city) {
  if (!name) return null;
  return `https://www.opentable.com/s?term=${encodeURIComponent(name)}`;
}

export function getGoogleMapsDirectionsUrl(lat, lng) {
  if (!lat || !lng) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

export function getGoogleFlightsUrl(origin, destination, dateStart, dateEnd) {
  if (!origin || !destination) return null;
  const q = `Flights from ${origin} to ${destination} on ${formatDateShort(dateStart)} through ${formatDateShort(dateEnd)}`;
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(q)}`;
}

export function getRome2RioUrl(from, to) {
  if (!from || !to) return null;
  return `https://www.rome2rio.com/map/${encodeURIComponent(from)}/${encodeURIComponent(to)}`;
}

export function getActivityLinks(activity, city) {
  const links = [];
  const gyg = getGetYourGuideUrl(activity.name, city);
  if (gyg) links.push({ label: 'GetYourGuide', url: gyg });
  const viator = getViatorUrl(activity.name, city);
  if (viator) links.push({ label: 'Viator', url: viator });
  const maps = getGoogleMapsDirectionsUrl(activity.coordinates?.lat, activity.coordinates?.lng);
  if (maps) links.push({ label: 'Directions', url: maps });
  return links;
}

export function getMealLinks(meal, city) {
  const links = [];
  const ot = getOpenTableUrl(meal.name, city);
  if (ot) links.push({ label: 'OpenTable', url: ot });
  const gmaps = `https://www.google.com/maps/search/${encodeURIComponent(meal.name)}`;
  links.push({ label: 'Discover', url: gmaps });
  return links;
}

export function getAccommodationLinks(accommodation, city, checkin, checkout) {
  const links = [];
  const booking = getBookingComUrl(city || accommodation.name, checkin, checkout);
  if (booking) links.push({ label: 'Booking.com', url: booking });
  const airbnb = getAirbnbUrl(city || accommodation.name, checkin, checkout);
  if (airbnb) links.push({ label: 'Airbnb', url: airbnb });
  if (accommodation.coordinates?.lat && accommodation.coordinates?.lng) {
    const maps = getGoogleMapsDirectionsUrl(accommodation.coordinates.lat, accommodation.coordinates.lng);
    if (maps) links.push({ label: 'Directions', url: maps });
  }
  return links;
}

export function getTransportLinks(from, to) {
  const links = [];
  const rome = getRome2RioUrl(from, to);
  if (rome) links.push({ label: 'Rome2Rio', url: rome });
  return links;
}