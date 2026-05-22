import { useEffect, useRef, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';

// Fix default marker icon (Webpack/Vite breaks Leaflet's default asset path)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Orange pin marker
const orangeIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-orange.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Nominatim reverse geocode
async function reverseGeocode(lat, lng) {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
    { headers: { 'Accept-Language': 'en' } }
  );
  const data = await res.json();
  return data.display_name || '';
}

// Nominatim forward search
async function searchAddress(query) {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=5&countrycodes=in`,
    { headers: { 'Accept-Language': 'en' } }
  );
  return res.json();
}

// Inner component: moves map when position changes from outside
function MapController({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.flyTo(position, 16, { duration: 0.8 });
  }, [position, map]);
  return null;
}

// Inner component: draggable marker + click-to-place
function DraggableMarker({ position, onMove }) {
  useMapEvents({
    click(e) {
      onMove([e.latlng.lat, e.latlng.lng]);
    },
  });

  if (!position) return null;

  return (
    <Marker
      position={position}
      icon={orangeIcon}
      draggable
      eventHandlers={{
        dragend(e) {
          const { lat, lng } = e.target.getLatLng();
          onMove([lat, lng]);
        },
      }}
    />
  );
}

// ─── Main export ────────────────────────────────────────────────────────────
// Props:
//   value    : { address, lat, lng }
//   onChange : ({ address, lat, lng }) => void
export default function LocationPicker({ value, onChange }) {
  const DEFAULT_CENTER = [16.5062, 80.6480]; // Vijayawada

  const [position, setPosition]     = useState(
    value?.lat && value?.lng ? [value.lat, value.lng] : null
  );
  const [searchQuery, setSearchQuery]   = useState(value?.address || '');
  const [suggestions, setSuggestions]   = useState([]);
  const [searching, setSearching]       = useState(false);
  const [locating, setLocating]         = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef(null);
  const suggestionRef = useRef(null);

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e) => {
      if (suggestionRef.current && !suggestionRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleMove = useCallback(async (latLng) => {
    setPosition(latLng);
    try {
      const addr = await reverseGeocode(latLng[0], latLng[1]);
      setSearchQuery(addr);
      onChange({ address: addr, lat: latLng[0], lng: latLng[1] });
    } catch {
      onChange({ address: searchQuery, lat: latLng[0], lng: latLng[1] });
    }
  }, [onChange, searchQuery]);

  const handleSearchInput = (e) => {
    const q = e.target.value;
    setSearchQuery(q);
    setSuggestions([]);
    setShowSuggestions(false);
    if (!q.trim()) return;

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchAddress(q);
        setSuggestions(results);
        setShowSuggestions(true);
      } finally {
        setSearching(false);
      }
    }, 400);
  };

  const handleSuggestionClick = (item) => {
    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lon);
    const addr = item.display_name;
    setPosition([lat, lng]);
    setSearchQuery(addr);
    setSuggestions([]);
    setShowSuggestions(false);
    onChange({ address: addr, lat, lng });
  };

  const detectLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setPosition([lat, lng]);
        try {
          const addr = await reverseGeocode(lat, lng);
          setSearchQuery(addr);
          onChange({ address: addr, lat, lng });
        } catch {
          onChange({ address: '', lat, lng });
        } finally {
          setLocating(false);
        }
      },
      () => setLocating(false)
    );
  };

  return (
    <div className="space-y-2">
      {/* Search bar */}
      <div className="relative" ref={suggestionRef}>
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchInput}
            placeholder="Search area, street or landmark…"
            className="w-full border border-gray-300 rounded-lg pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          {searching && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">searching…</span>
          )}
        </div>

        {/* Suggestions dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <ul className="absolute z-[9999] w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-52 overflow-y-auto">
            {suggestions.map((item) => (
              <li
                key={item.place_id}
                onMouseDown={() => handleSuggestionClick(item)}
                className="px-4 py-2.5 text-sm text-gray-700 hover:bg-orange-50 cursor-pointer border-b border-gray-100 last:border-0"
              >
                <span className="font-medium">{item.name || item.display_name.split(',')[0]}</span>
                <span className="text-gray-400 text-xs block truncate">{item.display_name}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Use my location */}
      <button
        type="button"
        onClick={detectLocation}
        disabled={locating}
        className="flex items-center gap-1.5 text-sm text-orange-500 hover:text-orange-600 disabled:opacity-50 transition-colors"
      >
        <span>📍</span>
        {locating ? 'Detecting your location…' : 'Use my current location'}
      </button>

      {/* Map */}
      <div className="rounded-xl overflow-hidden border border-gray-200 h-56">
        <MapContainer
          center={position || DEFAULT_CENTER}
          zoom={position ? 16 : 13}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapController position={position} />
          <DraggableMarker position={position} onMove={handleMove} />
        </MapContainer>
      </div>

      <p className="text-xs text-gray-400">
        {position
          ? `📌 ${position[0].toFixed(5)}, ${position[1].toFixed(5)} — Drag pin or click map to adjust`
          : 'Search above or click on the map to drop a pin'}
      </p>
    </div>
  );
}
