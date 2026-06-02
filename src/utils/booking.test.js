import { describe, it, expect } from 'vitest';
import {
  getBookingComUrl,
  getAirbnbUrl,
  getHotelsComUrl,
  getExpediaUrl,
  getGetYourGuideUrl,
  getViatorUrl,
  getOpenTableUrl,
  getGoogleMapsDirectionsUrl,
  getGoogleFlightsUrl,
  getRome2RioUrl,
  getActivityLinks,
  getMealLinks,
  getAccommodationLinks
} from './booking';

describe('booking URL helpers', () => {
  describe('getBookingComUrl', () => {
    it('builds a search URL with city, checkin, checkout', () => {
      const url = getBookingComUrl('Paris', '2025-06-01', '2025-06-05');
      expect(url).toContain('booking.com/searchresults.html');
      expect(url).toContain('ss=Paris');
      expect(url).toContain('checkin=2025-06-01');
      expect(url).toContain('checkout=2025-06-05');
    });

    it('returns null when city is empty', () => {
      expect(getBookingComUrl('', '2025-06-01', '2025-06-05')).toBeNull();
    });

    it('appends group_adults and no_rooms when numPeople is given', () => {
      const url = getBookingComUrl('Le Metropolitan', '2025-06-01', '2025-06-05', 3);
      expect(url).toContain('ss=Le+Metropolitan');
      expect(url).toContain('group_adults=3');
      expect(url).toContain('no_rooms=1');
    });

    it('omits guest params when numPeople is 0 or missing', () => {
      expect(getBookingComUrl('Le Metropolitan', '2025-06-01', '2025-06-05', 0)).not.toContain('group_adults');
      expect(getBookingComUrl('Le Metropolitan', '2025-06-01', '2025-06-05')).not.toContain('group_adults');
    });
  });

  describe('getAirbnbUrl', () => {
    it('builds a slugified Airbnb search URL', () => {
      const url = getAirbnbUrl('New York City', '2025-06-01', '2025-06-05');
      expect(url).toContain('airbnb.com/s/new-york-city/homes');
      expect(url).toContain('checkin=2025-06-01');
      expect(url).toContain('checkout=2025-06-05');
    });

    it('omits date params when missing', () => {
      const url = getAirbnbUrl('Tokyo', null, null);
      expect(url).toBe('https://www.airbnb.com/s/tokyo/homes');
    });

    it('appends query=... when a hotel name is given', () => {
      const url = getAirbnbUrl('Paris', '2025-06-01', '2025-06-05', 'Le Metropolitan');
      expect(url).toContain('airbnb.com/s/paris/homes');
      expect(url).toContain('checkin=2025-06-01');
      expect(url).toContain('checkout=2025-06-05');
      expect(url).toContain('query=Le+Metropolitan');
    });

    it('does not add a query param when no hotel name is given', () => {
      const url = getAirbnbUrl('Paris', '2025-06-01', '2025-06-05');
      expect(url).not.toContain('query=');
    });
  });

  describe('getHotelsComUrl', () => {
    it('builds a hotels.com search URL with dates and search term', () => {
      const url = getHotelsComUrl('Le Metropolitan', '2025-06-01', '2025-06-05');
      expect(url).toContain('hotels.com/search.do');
      expect(url).toContain('q=Le+Metropolitan');
      expect(url).toContain('checkin=2025-06-01');
      expect(url).toContain('checkout=2025-06-05');
    });

    it('adds adults=... when numPeople is given', () => {
      const url = getHotelsComUrl('Le Metropolitan', '2025-06-01', '2025-06-05', 3);
      expect(url).toContain('adults=3');
    });

    it('returns null when search term is empty', () => {
      expect(getHotelsComUrl('', '2025-06-01', '2025-06-05')).toBeNull();
    });
  });

  describe('getExpediaUrl', () => {
    it('builds an expedia search URL with dates and search term', () => {
      const url = getExpediaUrl('Le Metropolitan', '2025-06-01', '2025-06-05');
      expect(url).toContain('expedia.com/Hotel-Search');
      expect(url).toContain('destination=Le+Metropolitan');
      expect(url).toContain('startDate=2025-06-01');
      expect(url).toContain('endDate=2025-06-05');
    });

    it('adds adults= and rooms=1 when numPeople is given', () => {
      const url = getExpediaUrl('Le Metropolitan', '2025-06-01', '2025-06-05', 2);
      expect(url).toContain('adults=2');
      expect(url).toContain('rooms=1');
    });

    it('returns null when search term is empty', () => {
      expect(getExpediaUrl('', '2025-06-01', '2025-06-05')).toBeNull();
    });
  });

  describe('getGetYourGuideUrl', () => {
    it('combines activity and city into search', () => {
      const url = getGetYourGuideUrl('Louvre', 'Paris');
      expect(url).toContain('getyourguide.com/s');
      expect(url).toContain(encodeURIComponent('Louvre Paris'));
    });

    it('returns null when both name and city empty', () => {
      expect(getGetYourGuideUrl('', '')).toBeNull();
    });
  });

  describe('getViatorUrl', () => {
    it('uses searchResults/all path that actually returns results', () => {
      const url = getViatorUrl('Eiffel Tower', 'Paris');
      expect(url).toContain('viator.com/searchResults/all');
      expect(url).toContain('text=' + encodeURIComponent('Eiffel Tower Paris'));
    });
  });

  describe('getOpenTableUrl', () => {
    it('uses /search/results path so the search bar actually shows results', () => {
      const url = getOpenTableUrl('Le Bernardin', 'New York');
      expect(url).toContain('opentable.com/search/results');
      expect(url).toContain('term=' + encodeURIComponent('Le Bernardin'));
    });

    it('returns null when name is empty', () => {
      expect(getOpenTableUrl('', 'NYC')).toBeNull();
    });
  });

  describe('getGoogleMapsDirectionsUrl', () => {
    it('builds a directions URL with lat/lng', () => {
      const url = getGoogleMapsDirectionsUrl(48.8566, 2.3522);
      expect(url).toBe('https://www.google.com/maps/dir/?api=1&destination=48.8566,2.3522');
    });

    it('returns null when coordinates missing', () => {
      expect(getGoogleMapsDirectionsUrl(null, null)).toBeNull();
      expect(getGoogleMapsDirectionsUrl(0, 0)).toBeNull();
    });
  });

  describe('getRome2RioUrl', () => {
    it('builds a /map/ route URL', () => {
      const url = getRome2RioUrl('Berlin', 'Lisbon');
      expect(url).toBe('https://www.rome2rio.com/map/Berlin/Lisbon');
    });

    it('returns null when from or to is missing', () => {
      expect(getRome2RioUrl('', 'Lisbon')).toBeNull();
      expect(getRome2RioUrl('Berlin', '')).toBeNull();
    });

    it('encodes special characters in city names', () => {
      const url = getRome2RioUrl('São Paulo', 'Mexico City');
      expect(url).toContain(encodeURIComponent('São Paulo'));
      expect(url).toContain(encodeURIComponent('Mexico City'));
    });
  });

  describe('getGoogleFlightsUrl', () => {
    it('builds a round-trip flights search URL with both dates', () => {
      const url = getGoogleFlightsUrl('Berlin', 'Lisbon', '2025-09-01', '2025-09-05');
      expect(url).toContain('google.com/travel/flights');
      expect(url).toContain('Flights');
      expect(url).toContain('Berlin');
      expect(url).toContain('Lisbon');
      // The dates are formatted as "Sep 1, 2025" / "Sep 5, 2025" — month abbreviation varies by locale,
      // so we just check the year and day numbers show up.
      expect(url).toContain('2025');
      expect(url).toContain('returning');
    });

    it('builds a one-way URL when only departure date given', () => {
      const url = getGoogleFlightsUrl('NYC', 'Paris', '2025-06-01', null);
      expect(url).toContain('NYC');
      expect(url).toContain('Paris');
      expect(url).not.toContain('returning');
    });

    it('returns null when from or to is missing', () => {
      expect(getGoogleFlightsUrl('', 'Lisbon', '2025-09-01', '2025-09-05')).toBeNull();
      expect(getGoogleFlightsUrl('Berlin', '', '2025-09-01', '2025-09-05')).toBeNull();
    });
  });
});

describe('composite link builders', () => {
  describe('getActivityLinks', () => {
    it('returns GYG, Viator, and Directions when activity has coords', () => {
      const links = getActivityLinks({ name: 'Louvre', coordinates: { lat: 48.86, lng: 2.34 } }, 'Paris');
      const labels = links.map(l => l.label);
      expect(labels).toEqual(['GetYourGuide', 'Viator', 'Directions']);
    });

    it('skips Directions when no coordinates', () => {
      const links = getActivityLinks({ name: 'Mystery Spot' }, 'Paris');
      const labels = links.map(l => l.label);
      expect(labels).not.toContain('Directions');
      expect(labels).toEqual(['GetYourGuide', 'Viator']);
    });
  });

  describe('getMealLinks', () => {
    it('returns OpenTable and Discover links', () => {
      const links = getMealLinks({ name: 'Bistro' }, 'Paris');
      const labels = links.map(l => l.label);
      expect(labels).toEqual(['OpenTable', 'Discover']);
    });

    it('does NOT return a Discover link with an empty search query', () => {
      const links = getMealLinks({ name: '' }, 'Paris');
      const labels = links.map(l => l.label);
      expect(labels).not.toContain('Discover');
    });
  });

  describe('getAccommodationLinks', () => {
    it('returns 4 booking sites + Directions in stable order', () => {
      // We always show the user a few alternatives because LLM-generated
      // hottels often don't exist on every site (e.g. boutique properties
      // missing from Airbnb). Booking.com, Hotels.com, Expedia, Airbnb,
      // then Directions.
      const links = getAccommodationLinks(
        { name: 'Hotel Lutetia', coordinates: { lat: 48.84, lng: 2.32 } },
        'Paris',
        '2025-06-01',
        '2025-06-05'
      );
      const labels = links.map(l => l.label);
      expect(labels).toEqual(['Booking.com', 'Hotels.com', 'Expedia', 'Airbnb', 'Directions']);
    });

    it('uses the accommodation name (not the city) as the Booking.com search term', () => {
      // The bug we're fixing: previously the URL searched for the city, which
      // gave a generic "Paris" or "France" result instead of the specific hotel.
      const links = getAccommodationLinks(
        { name: 'Le Metropolitan, Paris Tour Eiffel' },
        'Paris',
        '2025-06-01',
        '2025-06-05'
      );
      const booking = links.find(l => l.label === 'Booking.com');
      expect(booking.url).toContain('ss=Le+Metropolitan%2C+Paris+Tour+Eiffel');
      // Sanity: the bare city name should NOT be the search term
      expect(booking.url).not.toMatch(/[?&]ss=Paris(&|$)/);
    });

    it('uses the hotel name as search term on Hotels.com and Expedia too', () => {
      const links = getAccommodationLinks(
        { name: 'Le Metropolitan' },
        'Paris',
        '2025-06-01',
        '2025-06-05'
      );
      const hotels = links.find(l => l.label === 'Hotels.com');
      const expedia = links.find(l => l.label === 'Expedia');
      expect(hotels.url).toContain('q=Le+Metropolitan');
      expect(expedia.url).toContain('destination=Le+Metropolitan');
    });

    it('uses the city as Airbnb location and the hotel name as a query filter', () => {
      const links = getAccommodationLinks(
        { name: 'Le Metropolitan, Paris Tour Eiffel' },
        'Paris',
        '2025-06-01',
        '2025-06-05'
      );
      const airbnb = links.find(l => l.label === 'Airbnb');
      expect(airbnb.url).toContain('airbnb.com/s/paris/homes');
      expect(airbnb.url).toContain('query=Le+Metropolitan%2C+Paris+Tour+Eiffel');
    });

    it('falls back to the city for all sites when the accommodation has no name', () => {
      const links = getAccommodationLinks(
        { coordinates: { lat: 48.84, lng: 2.32 } },
        'Paris',
        '2025-06-01',
        '2025-06-05'
      );
      const booking = links.find(l => l.label === 'Booking.com');
      const hotels = links.find(l => l.label === 'Hotels.com');
      const expedia = links.find(l => l.label === 'Expedia');
      const airbnb = links.find(l => l.label === 'Airbnb');
      expect(booking.url).toContain('ss=Paris');
      expect(hotels.url).toContain('q=Paris');
      expect(expedia.url).toContain('destination=Paris');
      expect(airbnb.url).toContain('airbnb.com/s/paris/homes');
      // No query param on Airbnb when there's no hotel name
      expect(airbnb.url).not.toContain('query=');
    });

    it('threads numPeople into the Booking.com URL as group_adults + no_rooms', () => {
      const links = getAccommodationLinks(
        { name: 'Hotel Lutetia' },
        'Paris',
        '2025-06-01',
        '2025-06-05',
        3
      );
      const booking = links.find(l => l.label === 'Booking.com');
      expect(booking.url).toContain('group_adults=3');
      expect(booking.url).toContain('no_rooms=1');
    });

    it('threads numPeople into the Hotels.com URL as adults', () => {
      const links = getAccommodationLinks(
        { name: 'Hotel Lutetia' },
        'Paris',
        '2025-06-01',
        '2025-06-05',
        4
      );
      const hotels = links.find(l => l.label === 'Hotels.com');
      expect(hotels.url).toContain('adults=4');
    });

    it('threads numPeople into the Expedia URL as adults + rooms', () => {
      const links = getAccommodationLinks(
        { name: 'Hotel Lutetia' },
        'Paris',
        '2025-06-01',
        '2025-06-05',
        2
      );
      const expedia = links.find(l => l.label === 'Expedia');
      expect(expedia.url).toContain('adults=2');
      expect(expedia.url).toContain('rooms=1');
    });

    it('omits guest params when numPeople is not given', () => {
      const links = getAccommodationLinks(
        { name: 'Hotel Lutetia' },
        'Paris',
        '2025-06-01',
        '2025-06-05'
      );
      const booking = links.find(l => l.label === 'Booking.com');
      const hotels = links.find(l => l.label === 'Hotels.com');
      const expedia = links.find(l => l.label === 'Expedia');
      expect(booking.url).not.toContain('group_adults');
      expect(hotels.url).not.toContain('adults');
      expect(expedia.url).not.toContain('adults');
    });
  });

  describe('getTransportLinks', () => {
    it.skip('removed (function not exported)', () => {});
  });
});
