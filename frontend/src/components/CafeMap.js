import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const cafeIcon = L.divIcon({
  className: 'cafe-marker',
  html: '<div class="cafe-marker-dot" aria-hidden="true"></div>',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

const UB_CENTER = [47.9184676, 106.9177016];

function getCafeLatLng(c) {
  const lat = Number(c.latitude ?? c.lat);
  const lng = Number(c.longitude ?? c.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return [lat, lng];
}

function MapBoundsFitter({ points }) {
  const map = useMap();
  useEffect(() => {
    if (!points || points.length === 0) return;
    try {
      const bounds = L.latLngBounds(points);
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [52, 52], maxZoom: 14, animate: false });
      }
    } catch (e) {
      console.error('Map fitBounds:', e);
    }
  }, [map, points]);
  return null;
}

export default function CafeMap() {
  const [cafes, setCafes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const loadCafes = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .get('/cafes')
      .then(({ data }) => {
        if (Array.isArray(data)) setCafes(data);
        else setCafes([]);
      })
      .catch((err) => {
        console.error(err);
        setCafes([]);
        setError(err.response?.data?.error || err.message || 'API алдаа');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadCafes();
  }, [loadCafes]);

  const cafesWithCoords = useMemo(
    () =>
      cafes
        .map((c) => {
          const pos = getCafeLatLng(c);
          return pos ? { ...c, _pos: pos } : null;
        })
        .filter(Boolean),
    [cafes]
  );

  const boundsPoints = useMemo(() => cafesWithCoords.map((c) => c._pos), [cafesWithCoords]);

  if (loading) {
    return <div className="skeleton" style={{ height: 520 }} />;
  }

  return (
    <div className="map-container map-container--has-overlay">
      <MapContainer
        center={UB_CENTER}
        zoom={13}
        minZoom={11}
        maxZoom={19}
        scrollWheelZoom
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"
          subdomains="abcd"
          detectRetina
        />
        {boundsPoints.length > 0 ? <MapBoundsFitter points={boundsPoints} /> : null}
        {cafesWithCoords.map((cafe) => (
          <Marker key={cafe.id} position={cafe._pos} icon={cafeIcon}>
            <Popup>
              <div style={{ minWidth: 200, fontFamily: 'Inter, sans-serif' }}>
                <div
                  style={{
                    fontFamily: 'Space Grotesk, sans-serif',
                    fontSize: 16,
                    fontStyle: 'italic',
                    fontWeight: 700,
                    letterSpacing: '-0.02em',
                    textTransform: 'uppercase',
                    color: '#fff',
                    marginBottom: 6,
                  }}
                >
                  {cafe.name}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: '#71717a',
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    fontWeight: 700,
                    marginBottom: 8,
                  }}
                >
                  {cafe.address}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: '#10b981',
                    fontWeight: 900,
                    letterSpacing: '0.25em',
                    marginBottom: 10,
                  }}
                >
                  ◆ {cafe.available_pcs}/{cafe.total_pcs} СУЛ КОМПЬЮТЕР
                </div>
                <button
                  type="button"
                  onClick={() => navigate(`/cafe/${cafe.id}`)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    background: '#ff0000',
                    color: '#000',
                    border: '1px solid #ff0000',
                    cursor: 'pointer',
                    fontFamily: 'Inter, sans-serif',
                    fontSize: 10,
                    fontWeight: 900,
                    letterSpacing: '0.25em',
                    textTransform: 'uppercase',
                    boxShadow: '0 0 16px rgba(255,0,0,0.4)',
                  }}
                >
                  ◢ ЗАХИАЛАХ
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {error ? (
        <div className="map-overlay map-overlay--error">
          <div className="map-overlay__title">Салбар ачаалагдаагүй</div>
          <div className="map-overlay__msg">{error}</div>
          <div className="map-overlay__hint mono">
            Backend: {process.env.REACT_APP_API_URL || 'http://localhost:4000/api'} — npm run dev (backend) + DATABASE_URL
          </div>
          <button type="button" className="map-overlay__btn" onClick={loadCafes}>
            Дахин оролдох
          </button>
        </div>
      ) : cafes.length > 0 && cafesWithCoords.length === 0 ? (
        <div className="map-overlay map-overlay--warn">
          <div className="map-overlay__title">Газрын байршилгүй өгөгдөл</div>
          <div className="map-overlay__msg">
            {cafes.length} салбар ирсэн ч latitude/longitude хоосон эсвэл буруу байна. Seed дахин ажиллуулна уу.
          </div>
          <button type="button" className="map-overlay__btn" onClick={loadCafes}>
            Дахин шалгах
          </button>
        </div>
      ) : !error && cafes.length === 0 ? (
        <div className="map-overlay map-overlay--warn">
          <div className="map-overlay__title">Салбар олдсонгүй</div>
          <div className="map-overlay__msg">
            Хоосон жагсаалт буцаасан. Backend суурь өгөгдөл: <span className="mono">cd backend && npm run db:seed</span>
          </div>
          <button type="button" className="map-overlay__btn" onClick={loadCafes}>
            Дахин ачаалах
          </button>
        </div>
      ) : null}
    </div>
  );
}
