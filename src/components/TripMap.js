import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';
import 'leaflet-routing-machine';

// Fix for default markers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png')
});

const TripMap = ({ points = [] }) => {
  const [map, setMap] = useState(null);
  const defaultCenter = [18.5204, 73.8567]; // Default to Pune
  const center = points.length > 0 
    ? [points[0].coordinates.lat, points[0].coordinates.lng] 
    : defaultCenter;

  useEffect(() => {
    if (map && points.length > 0) {
      const bounds = L.latLngBounds(points.map(p => [p.coordinates.lat, p.coordinates.lng]));
      map.fitBounds(bounds);
    }
  }, [map, points]);

  useEffect(() => {
    if (map && points.length > 1) {
      // Clear existing routing control
      map.eachLayer((layer) => {
        if (layer instanceof L.Routing.Control) {
          map.removeLayer(layer);
        }
      });

      const waypoints = points.map(point => 
        L.latLng(point.coordinates.lat, point.coordinates.lng)
      );

      L.Routing.control({
        waypoints,
        routeWhileDragging: true,
        show: false,
        lineOptions: {
          styles: [{ color: '#6366F1', weight: 3 }]
        }
      }).addTo(map);
    }
  }, [map, points]);

  return (
    <MapContainer 
      center={center} 
      zoom={12} 
      style={{ height: '100%', width: '100%' }}
      ref={setMap}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; OpenStreetMap contributors'
      />
      {points.map((point, index) => (
        <Marker 
          key={index} 
          position={[point.coordinates.lat, point.coordinates.lng]}
        >
          <Popup>
            <div>
              <h3 className="font-bold">{point.name}</h3>
              <p>{point.description}</p>
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${point.coordinates.lat},${point.coordinates.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:text-blue-700"
              >
                Get Directions
              </a>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
};

export default TripMap;