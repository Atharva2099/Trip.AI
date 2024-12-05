// Function to calculate distance between two points using Haversine formula
const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in km
  };
  
  // Rate limiting helper
  const rateLimiter = {
    lastCall: 0,
    minInterval: 1000, // 1 second between calls
    async wait() {
      const now = Date.now();
      const timeSinceLastCall = now - this.lastCall;
      if (timeSinceLastCall < this.minInterval) {
        await new Promise(resolve => setTimeout(resolve, this.minInterval - timeSinceLastCall));
      }
      this.lastCall = Date.now();
    }
  };
  
  const factChecker = {
    // Cache for API responses
    cache: new Map(),
  
    // Validate location and check distance
    async validateLocation(location, centerPoint) {
      try {
        await rateLimiter.wait();
  
        // Check cache first
        const cacheKey = `location:${location.name}`;
        if (this.cache.has(cacheKey)) {
          return this.cache.get(cacheKey);
        }
  
        const nominatimResponse = await fetch(
          `https://nominatim.openstreetmap.org/search?` +
          `q=${encodeURIComponent(location.name)}&` +
          `format=json&limit=1&addressdetails=1&extratags=1`
        );
        const nominatimData = await nominatimResponse.json();
  
        if (nominatimData.length > 0) {
          const coords = {
            lat: parseFloat(nominatimData[0].lat),
            lng: parseFloat(nominatimData[0].lon)
          };
  
          // Calculate distance from center point
          const distance = calculateDistance(
            centerPoint.lat,
            centerPoint.lng,
            coords.lat,
            coords.lng
          );
  
          // Get additional details
          const details = await this.getLocationDetails(location.name, coords);
          
          const result = {
            exists: true,
            tooFar: distance > 50, // More than 50km away
            distance: distance,
            coordinates: coords,
            ...details,
            verified: true
          };
  
          // Cache the result
          this.cache.set(cacheKey, result);
          return result;
        }
  
        return {
          exists: false,
          verified: false
        };
      } catch (error) {
        console.error('Error validating location:', error);
        return { verified: false };
      }
    },
  
    // Validate prices
    async validatePrice(activity) {
      try {
        await rateLimiter.wait();
  
        // Check cache
        const cacheKey = `price:${activity.name}`;
        if (this.cache.has(cacheKey)) {
          return this.cache.get(cacheKey);
        }
  
        // Get price information from multiple sources
        const [osmData, wikiData] = await Promise.all([
          this.getOSMPriceInfo(activity),
          this.getWikiPriceInfo(activity.name)
        ]);
  
        const priceEstimates = {
          provided: activity.cost,
          osm: osmData.price,
          wiki: wikiData.price
        };
  
        const result = {
          verified: true,
          suggestedPrice: this.calculateAveragePrice(priceEstimates),
          priceConfidence: this.calculatePriceConfidence(priceEstimates)
        };
  
        // Cache the result
        this.cache.set(cacheKey, result);
        return result;
      } catch (error) {
        console.error('Error validating price:', error);
        return { verified: false };
      }
    },
  
    // Get location details
    async getLocationDetails(name, coords) {
      try {
        await rateLimiter.wait();
  
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?` +
          `lat=${coords.lat}&lon=${coords.lng}&format=json&extratags=1`
        );
        const data = await response.json();
  
        return {
          type: data.type,
          category: data.category,
          opening_hours: data.extratags?.opening_hours,
          website: data.extratags?.website,
          phone: data.extratags?.phone,
          wheelchair: data.extratags?.wheelchair,
          description: await this.getWikiDescription(name)
        };
      } catch (error) {
        console.error('Error getting location details:', error);
        return {};
      }
    },
  
    // Get Wikipedia description
    async getWikiDescription(name) {
      try {
        await rateLimiter.wait();
  
        const response = await fetch(
          `https://en.wikipedia.org/w/api.php?` +
          `action=query&format=json&prop=extracts&exintro&explaintext&` +
          `titles=${encodeURIComponent(name)}&origin=*`
        );
        const data = await response.json();
        const pages = data.query.pages;
        const pageId = Object.keys(pages)[0];
        return pages[pageId].extract || null;
      } catch (error) {
        console.error('Error getting Wikipedia description:', error);
        return null;
      }
    },
  
    // Get price information from OpenStreetMap
    async getOSMPriceInfo(activity) {
      try {
        await rateLimiter.wait();
  
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?` +
          `q=${encodeURIComponent(activity.name)}&format=json&extratags=1`
        );
        const data = await response.json();
        
        return {
          price: data[0]?.extratags?.fee || null
        };
      } catch (error) {
        console.error('Error getting OSM price info:', error);
        return { price: null };
      }
    },
  
    // Get price information from Wikipedia
    async getWikiPriceInfo(name) {
      try {
        await rateLimiter.wait();
  
        const response = await fetch(
          `https://en.wikipedia.org/w/api.php?` +
          `action=query&format=json&prop=revisions&rvprop=content&` +
          `titles=${encodeURIComponent(name)}&origin=*`
        );
        const data = await response.json();
        
        // This is a simplified version - actual Wikipedia parsing would be more complex
        return { price: null };
      } catch (error) {
        console.error('Error getting Wikipedia price info:', error);
        return { price: null };
      }
    },
  
    // Calculate average price from different sources
  calculateAveragePrice(estimates) {
    const prices = Object.values(estimates).filter(price => price && !isNaN(price));
    if (prices.length === 0) {
      return estimates.provided || 0;
    }
    return Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
  },

  // Calculate confidence in price estimate
  calculatePriceConfidence(estimates) {
    const prices = Object.values(estimates).filter(price => price && !isNaN(price));
    
    if (prices.length < 2) {
      return 'low';
    }

    const avg = this.calculateAveragePrice(estimates);
    const variance = prices.reduce((acc, price) => {
      return acc + Math.pow(price - avg, 2);
    }, 0) / prices.length;

    // Standard deviation as a percentage of average
    const variationCoefficient = (Math.sqrt(variance) / avg) * 100;

    if (variationCoefficient < 15) {
      return 'high';
    } else if (variationCoefficient < 30) {
      return 'medium';
    } else {
      return 'low';
    }
  },

  // Clear cache method
  clearCache() {
    this.cache.clear();
  },

  // Cache management - remove old entries
  cleanCache() {
    const cacheAge = 3600000; // 1 hour
    const now = Date.now();
    
    for (const [key, value] of this.cache.entries()) {
      if (value.timestamp && (now - value.timestamp > cacheAge)) {
        this.cache.delete(key);
      }
    }
  }
};

// Clean cache periodically
setInterval(() => factChecker.cleanCache(), 3600000); // Every hour

export default factChecker;