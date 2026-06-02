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

export function getRome2RioUrl(from, to) {
  if (!from || !to) return null;
  return `https://www.rome2rio.com/map/${encodeURIComponent(from)}/${encodeURIComponent(to)}`;
}

export function getGoogleFlightsUrl(from, to, dateStart, dateEnd) {
  if (!from || !to) return null;
  // One-way if no end date, round-trip otherwise.
  const parts = [`Flights from ${from} to ${to}`];
  if (dateStart) parts.push(`on ${formatDateShort(dateStart)}`);
  if (dateStart && dateEnd) parts.push(`returning ${formatDateShort(dateEnd)}`);
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(parts.join(' '))}`;
}

export function getBookingComUrl(searchTerm, checkin, checkout, numPeople) {
  if (!searchTerm) return null;
  const params = new URLSearchParams({
    ss: searchTerm,
    checkin: formatDate(checkin),
    checkout: formatDate(checkout),
  });
  if (numPeople && numPeople > 0) {
    params.set('group_adults', String(numPeople));
    params.set('no_rooms', '1');
  }
  return `https://www.booking.com/searchresults.html?${params.toString()}`;
}

export function getAirbnbUrl(location, checkin, checkout, query) {
  if (!location) return null;
  // Airbnb's URL structure is location-based (the slug in the path), so we
  // always use the city here. The hotel name goes in a `query` param that
  // Airbnb uses to filter results within the location.
  const slug = location.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-');
  const ci = formatDate(checkin);
  const co = formatDate(checkout);
  const base = `https://www.airbnb.com/s/${encodeURIComponent(slug)}/homes`;
  const params = new URLSearchParams();
  if (ci) params.set('checkin', ci);
  if (co) params.set('checkout', co);
  if (query) params.set('query', query);
  return params.toString() ? `${base}?${params.toString()}` : base;
}

export function getHotelsComUrl(searchTerm, checkin, checkout, numPeople) {
  if (!searchTerm) return null;
  const params = new URLSearchParams({
    q: searchTerm,
    checkin: formatDate(checkin),
    checkout: formatDate(checkout)
  });
  if (numPeople && numPeople > 0) {
    params.set('adults', String(numPeople));
  }
  return `https://www.hotels.com/search.do?${params.toString()}`;
}

export function getExpediaUrl(searchTerm, checkin, checkout, numPeople) {
  if (!searchTerm) return null;
  const params = new URLSearchParams({
    destination: searchTerm,
    startDate: formatDate(checkin),
    endDate: formatDate(checkout)
  });
  if (numPeople && numPeople > 0) {
    params.set('adults', String(numPeople));
    params.set('rooms', '1');
  }
  return `https://www.expedia.com/Hotel-Search?${params.toString()}`;
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
  return `https://www.opentable.com/search/results?term=${encodeURIComponent(name)}`;
}

export function getGoogleMapsDirectionsUrl(lat, lng) {
  if (!lat || !lng) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
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
  if (!meal?.name) return links;
  const ot = getOpenTableUrl(meal.name, city);
  if (ot) links.push({ label: 'OpenTable', url: ot });
  const gmaps = `https://www.google.com/maps/search/${encodeURIComponent(meal.name)}`;
  links.push({ label: 'Discover', url: gmaps });
  return links;
}

export function getAccommodationLinks(accommodation, city, checkin, checkout, numPeople) {
  const links = [];
  // Hotel name is the most specific search term — preferred over city so
  // we don't end up with generic "Paris" or "France" search results.
  const name = (accommodation?.name || '').trim();
  const cityName = (city || '').trim();

  if (name || cityName) {
    const searchTerm = name || cityName;

    // Major booking sites that all support search-by-hotel-name. We list
    // several so the user has alternatives when the LLM-generated hôtel
    // isn't on their preferred site (e.g. boutique hottels often missing
    // from Airbnb but present on Booking.com).
    const booking = getBookingComUrl(searchTerm, checkin, checkout, numPeople);
    if (booking) links.push({ label: 'Booking.com', url: booking });

    const hotels = getHotelsComUrl(searchTerm, checkin, checkout, numPeople);
    if (hotels) links.push({ label: 'Hotels.com', url: hotels });

    const expedia = getExpediaUrl(searchTerm, checkin, checkout, numPeople);
    if (expedia) links.push({ label: 'Expedia', url: expedia });

    // Airbnb is location-based: city goes in the path slug, hotel name is
    // a `query` text filter so the search is still in the right city but
    // filtered down to this specific property (when it exists there).
    const airbnb = getAirbnbUrl(cityName, checkin, checkout, name);
    if (airbnb) links.push({ label: 'Airbnb', url: airbnb });
  }

  if (accommodation?.coordinates?.lat && accommodation?.coordinates?.lng) {
    const maps = getGoogleMapsDirectionsUrl(accommodation.coordinates.lat, accommodation.coordinates.lng);
    if (maps) links.push({ label: 'Directions', url: maps });
  }
  return links;
}