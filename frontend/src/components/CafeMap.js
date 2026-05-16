import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useNavigate } from 'react-router-dom';
import { LocateFixed } from 'lucide-react';
import api from '../api/axios';
import { getApiBaseUrl } from '../api/apiBase';

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

/** Prefer device GPS center; otherwise fit all cafe markers (or city default). */
function MapInitialView({ boundsPoints, userGeo }) {
  const map = useMap();

  useEffect(() => {
    if (userGeo === undefined) return;

    if (userGeo !== null) {
      const { lat, lng } = userGeo;
      if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
        map.flyTo([lat, lng], 14, { duration: 0.75 });
      }
      return;
    }

    if (boundsPoints.length > 0) {
      try {
        const bounds = L.latLngBounds(boundsPoints);
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [52, 52], maxZoom: 14, animate: false });
        }
      } catch (e) {
        console.error('Map fitBounds:', e);
      }
    } else {
      map.setView(UB_CENTER, 13, { animate: false });
    }
  }, [map, userGeo, boundsPoints]);

  return null;
}

function LocateMeControl({ onLocated }) {
  const map = useMap();
  const [busy, setBusy] = useState(false);
  const supported = typeof navigator !== 'undefined' && !!navigator.geolocation;

  const handleClick = () => {
    if (!supported || busy) return;
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
          onLocated({ lat, lng });
          map.flyTo([lat, lng], 15, { duration: 0.65 });
        }
        setBusy(false);
      },
      () => setBusy(false),
      { enableHighAccuracy: true, timeout: 22000, maximumAge: 0 }
    );
  };

  return (
    <div className="leaflet-top leaflet-right map-locate-control leaflet-bar leaflet-control">
      <button
        type="button"
        className="map-locate-control__btn"
        onClick={handleClick}
        disabled={!supported || busy}
        aria-label="Миний байршил руу төвлөрүүлэх"
        title={supported ? 'GPS: миний байршил (дахин)' : 'Энэ төхөөрөмжид байршил унших боломжгүй'}
      >
        <LocateFixed size={18} strokeWidth={2.35} aria-hidden />
      </button>
    </div>
  );
}

export default function CafeMap({ fullscreen = false }) {
  const navigate = useNavigate();
  const [cafes, setCafes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userGeo, setUserGeo] = useState(undefined);

  useEffect(() => {
    if (!navigator.geolocation) {
      setUserGeo(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
          setUserGeo({ lat, lng });
        } else {
          setUserGeo(null);
        }
      },
      () => setUserGeo(null),
      { enableHighAccuracy: true, timeout: 14000, maximumAge: 120000 }
    );
  }, []);

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
    return <div className="skeleton" style={{ height: fullscreen ? '100vh' : 520 }} />;
  }

  const containerClass = `map-container map-container--has-overlay map-container--dark ${fullscreen ? 'map-container--fullscreen' : ''}`;

  return (
    <div className={containerClass}>
      <MapContainer
        center={UB_CENTER}
        zoom={13}
        minZoom={11}
        maxZoom={19}
        scrollWheelZoom
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          key="carto-dark"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png"
          subdomains="abcd"
        />
        <LocateMeControl onLocated={setUserGeo} />
        <MapInitialView boundsPoints={boundsPoints} userGeo={userGeo} />
        {userGeo != null ? (
          <CircleMarker
            center={[userGeo.lat, userGeo.lng]}
            radius={11}
            pathOptions={{
              color: '#dc2626',
              weight: 3,
              fillColor: '#ff0000',
              fillOpacity: 0.22,
            }}
          />
        ) : null}
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
                  onClick={() => navigate(`/cafe/${cafe.id}/book`)}
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: 12, padding: '12px', fontSize: '11px', letterSpacing: '0.15em' }}
                >
                  ЗАХИАЛАХ
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
            Backend: {getApiBaseUrl()} — npm run dev (backend) + DATABASE_URL
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
