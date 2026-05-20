import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Phone, Monitor, ArrowRight, Star } from 'lucide-react';
import api from '../api/axios';
import toast from 'react-hot-toast';

export default function CafesPage() {
  const [cafes, setCafes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCafes();
  }, []);

  const fetchCafes = async () => {
    try {
      const res = await api.get('/cafes');
      setCafes(res.data);
    } catch (err) {
      toast.error(err.userMessage || 'Салбаруудын мэдээлэл татаж чадсангүй');
    } finally {
      setLoading(false);
    }
  };

  const handleImageError = (e) => {
    e.target.src = 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80&w=320&h=180';
    e.target.onerror = null; // Prevent infinite loop
  };

  if (loading) {
    return (
      <div className="container" style={{ padding: '40px 20px', textAlign: 'center' }}>
        <div className="spin-square" style={{ margin: '0 auto', width: 32, height: 32 }} />
        <p className="mono" style={{ marginTop: 20, color: 'var(--text-dim)' }}>Салбаруудын жагсаалтыг ачаалж байна...</p>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '40px 20px' }}>
      <header style={{ marginBottom: 40 }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: 12 }}>
          САЛБАРУУД <span style={{ color: 'var(--red)' }}>//</span> CAFES
        </h1>
        <p className="mono" style={{ color: 'var(--text-dim)', fontSize: 14 }}>
          Манай сүлжээний бүх салбарууд болон бодит хугацааны суудлын мэдээлэл
        </p>
      </header>

      <div className="cafe-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 24 }}>
        {cafes.map((cafe) => (
          <div key={cafe.id} className="card cafe-card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--border)', transition: 'transform 0.2s ease, border-color 0.2s ease' }}>
            <div className="cafe-image" style={{ height: 180, overflow: 'hidden', background: 'var(--bg-muted)', position: 'relative' }}>
              <img 
                src={cafe.image_url ? `${cafe.image_url}?v=3` : 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80&w=320&h=180'} 
                alt={cafe.name} 
                onError={handleImageError}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
              />
              <div style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', padding: '4px 10px', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Star size={12} color="#FFD700" fill="#FFD700" />
                <span className="mono" style={{ fontSize: 12, color: '#fff', fontWeight: 'bold' }}>4.9</span>
              </div>
            </div>

            <div style={{ padding: 24, flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>{cafe.name}</h3>
                <div className="mono" style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4, background: 'var(--bg-muted)', color: 'var(--green)' }}>
                  OPEN
                </div>
              </div>

              <div className="mono" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-dim)', marginBottom: 8 }}>
                <MapPin size={14} />
                <span>{cafe.address}</span>
              </div>

              <div className="mono" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-dim)', marginBottom: 8 }}>
                <Monitor size={14} />
                <span>{cafe.vip_gpu} / {cafe.zaal_gpu}</span>
              </div>

              {cafe.phone && (
                <div className="mono" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-dim)', marginBottom: 20 }}>
                  <Phone size={14} />
                  <span>{cafe.phone}</span>
                </div>
              )}

              <div style={{ marginTop: 'auto' }}>
                <div style={{ display: 'flex', gap: 12, marginBottom: 24, padding: '16px 0', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ flex: 1 }}>
                    <div className="mono" style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>СУЛ СУУДАЛ</div>
                    <div className="mono" style={{ fontSize: 18, fontWeight: 'bold', color: cafe.available_pcs > 0 ? 'var(--green)' : 'var(--red)' }}>
                      {cafe.available_pcs} <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>/ {cafe.total_pcs}</span>
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="mono" style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>VIP СУУДАЛ</div>
                    <div className="mono" style={{ fontSize: 18, fontWeight: 'bold' }}>{cafe.vip_pcs} <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>ШИРХЭГ</span></div>
                  </div>
                </div>

                <Link to={`/cafe/${cafe.id}/book`} className="btn btn-primary btn-block" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  ЗАХИАЛГА ӨГӨХ <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
