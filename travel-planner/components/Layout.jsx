import { useState, useEffect, useRef } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import Navbar from './Navbar'
import AskAtlasAIModal from './AskAtlasAIModal'

const ROUTE_ORDER = ['/', '/plan', '/attractions', '/trips', '/bookings', '/group', '/expenses', '/itinerary', '/support', '/profile']

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isAskOpen, setIsAskOpen] = useState(false)
  const [askDestination, setAskDestination] = useState('')
  const navigate = useNavigate()
  const location = useLocation()

  const prevPathRef = useRef(location.pathname)
  const [slideDir, setSlideDir] = useState('forward')

  useEffect(() => {
    const prevIdx = ROUTE_ORDER.indexOf(prevPathRef.current)
    const currentIdx = ROUTE_ORDER.indexOf(location.pathname)
    setSlideDir(currentIdx >= prevIdx ? 'forward' : 'backward')
    prevPathRef.current = location.pathname
  }, [location.pathname])

  // Global event listener to allow any component to open the AI Concierge modal
  useEffect(() => {
    const handleOpenAsk = (e) => {
      if (e?.detail?.destination) {
        setAskDestination(e.detail.destination)
      }
      setIsAskOpen(true)
    }
    window.addEventListener('open-ask-atlasai', handleOpenAsk)
    return () => window.removeEventListener('open-ask-atlasai', handleOpenAsk)
  }, [])

  return (
    <div className="atlas-backdrop">
      {/* Stitch Ambient Motion Floating Radial Orbs Underlay */}
      <div className="atlas-ambient-motion-layer atlas-no-print" aria-hidden="true">
        <div className="atlas-ambient-orb atlas-ambient-orb-1" />
        <div className="atlas-ambient-orb atlas-ambient-orb-2" />
        <div className="atlas-ambient-orb atlas-ambient-orb-3" />
        <div className="atlas-ambient-orb atlas-ambient-orb-4" />
      </div>

      <div className="atlas-shell" style={{ position: 'relative', zIndex: 1 }}>
        <Navbar
          mobileOpen={mobileOpen}
          onMenuClick={() => setMobileOpen((v) => !v)}
          onCloseMenu={() => setMobileOpen(false)}
        />
        <main className="atlas-main">
          <div className="atlas-content">
            <div key={location.pathname} className={`atlas-page-view atlas-slide-${slideDir}`}>
              <Outlet />
            </div>
          </div>
        </main>

        {/* Global Stitch Luxury Studio Footer */}
        <footer className="atlas-no-print" style={{
          borderTop: '1px solid var(--border)',
          marginTop: '64px',
          padding: '32px 36px',
          background: 'var(--shell-soft)',
          backdropFilter: 'blur(20px)',
          transition: 'background-color 0.3s ease, border-color 0.3s ease',
        }}>
          <div style={{
            maxWidth: '1440px',
            margin: '0 auto',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            fontSize: '12px',
            color: 'var(--muted)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <strong style={{ color: 'var(--text)', letterSpacing: '-0.01em' }}>AtlasAI Studio</strong>
              <span>© 2025 AtlasAI Studio. Computational Haute Curation.</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
              <button
                onClick={() => navigate('/plan')}
                style={{ border: 'none', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', padding: 0, fontSize: '12px' }}
                onMouseEnter={(e) => e.target.style.color = 'var(--text)'}
                onMouseLeave={(e) => e.target.style.color = 'var(--muted)'}
              >
                AI Trip Synthesis
              </button>
              <button
                onClick={() => navigate('/attractions')}
                style={{ border: 'none', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', padding: 0, fontSize: '12px' }}
                onMouseEnter={(e) => e.target.style.color = 'var(--text)'}
                onMouseLeave={(e) => e.target.style.color = 'var(--muted)'}
              >
                Destinations
              </button>
              <button
                onClick={() => navigate('/trips')}
                style={{ border: 'none', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', padding: 0, fontSize: '12px' }}
                onMouseEnter={(e) => e.target.style.color = 'var(--text)'}
                onMouseLeave={(e) => e.target.style.color = 'var(--muted)'}
              >
                Trips & Bookings
              </button>
              <button
                onClick={() => setIsAskOpen(true)}
                style={{ border: 'none', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', padding: 0, fontSize: '12px' }}
                onMouseEnter={(e) => e.target.style.color = 'var(--text)'}
                onMouseLeave={(e) => e.target.style.color = 'var(--muted)'}
              >
                Private Concierge
              </button>
            </div>
          </div>
        </footer>
      </div>

      {/* Global Stitch Floating Ask AtlasAI Concierge Pill */}
      {location.pathname !== '/plan' && (
        <aside className="atlas-no-print" style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 50 }}>
          <button
            onClick={() => setIsAskOpen(true)}
            className="atlas-stitch-floating-ask-btn flex items-center gap-2.5 px-6 py-3.5 rounded-full bg-gradient-to-r from-[#7c3aed] via-[#9333ea] to-[#c026d3] text-white font-bold text-sm shadow-[0_12px_35px_-5px_rgba(124,58,237,0.7),0_0_25px_rgba(192,38,211,0.4)] hover:shadow-[0_18px_45px_-5px_rgba(124,58,237,0.9)] hover:scale-105 active:scale-95 transition-all duration-300 border border-white/40 cursor-pointer"
            type="button"
            aria-label="Ask AtlasAI"
          >
            <Sparkles size={18} style={{ color: '#ffffff' }} />
            <span style={{ color: '#ffffff', fontWeight: 700 }}>Ask AtlasAI</span>
            <div className="atlas-ask-ping-dot" />
          </button>
        </aside>
      )}

      {/* Interactive Liquid Glass Ask AtlasAI Modal */}
      <AskAtlasAIModal
        isOpen={isAskOpen}
        onClose={() => setIsAskOpen(false)}
        destinationContext={askDestination}
      />
    </div>
  )
}
