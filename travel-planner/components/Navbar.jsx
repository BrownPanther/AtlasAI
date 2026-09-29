import { useCallback, useEffect, useRef, useState } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { Bell, Search, Menu, MapPin, Compass, Briefcase, UserRound, Loader2 } from 'lucide-react'
import ThemeToggle from './ThemeToggle'
import NotificationPanel from './NotificationPanel'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationContext'
import { api } from '../services/api'
import Logo from './Logo'

const navItems = [
  { to: '/', label: 'Home', end: true },
  { to: '/plan', label: 'Plan' },
  { to: '/attractions', label: 'Explore' },
  { to: '/trips', label: 'Trips' },
  { to: '/group', label: 'Group' },
  { to: '/expenses', label: 'Expenses' },
]

export default function Navbar({ mobileOpen, onMenuClick, onCloseMenu }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, isAuthenticated } = useAuth()
  const { unreadCount } = useNotifications()
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef(null)
  const navRef = useRef(null)
  const [pillStyle, setPillStyle] = useState({ left: 0, width: 0, opacity: 0 })

  const updatePill = useCallback(() => {
    if (!navRef.current) return
    const activeLink = navRef.current.querySelector('.atlas-nav-link.is-active')
    if (activeLink) {
      const navRect = navRef.current.getBoundingClientRect()
      const linkRect = activeLink.getBoundingClientRect()
      setPillStyle({
        left: linkRect.left - navRect.left,
        width: linkRect.width,
        opacity: 1,
      })
    } else {
      setPillStyle((prev) => ({ ...prev, opacity: 0 }))
    }
  }, [])

  useEffect(() => {
    updatePill()
    const timer = setTimeout(updatePill, 60)
    window.addEventListener('resize', updatePill)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', updatePill)
    }
  }, [location.pathname, updatePill])

  // Search user's real trips and bookings locally, and optionally hit the
  // backend destination search — replaces the old hardcoded mockData filter.
  const runSearch = useCallback(async (q) => {
    if (!q) { setResults([]); setSearching(false); return }
    setSearching(true)
    const out = []
    try {
      // Search user's trips (already fetched by the backend)
      if (isAuthenticated) {
        const { trips } = await api.listTrips()
        const q2 = q.toLowerCase()
        for (const t of trips) {
          if (`${t.destination} ${t.origin || ''}`.toLowerCase().includes(q2)) {
            out.push({ id: t.id, title: `${t.destination} trip`, subtitle: `${t.origin || '—'} · ${t.startDate || '—'}`, type: 'Trip', icon: MapPin, path: '/itinerary', state: { tripId: t.id } })
          }
        }
        // Search user's bookings
        const { bookings } = await api.listBookings()
        for (const b of bookings) {
          if (`${b.name} ${b.type}`.toLowerCase().includes(q2)) {
            out.push({ id: b.id, title: b.name, subtitle: `${b.type} · ${b.dateLabel || ''}`, type: 'Booking', icon: Briefcase, path: '/trips' })
          }
        }
      }
      // Backend destination/attraction search
      try {
        const destRes = await api.searchDestinations(q)
        if (destRes?.destinations) {
          for (const d of destRes.destinations.slice(0, 3)) {
            out.push({ id: d.id || d.name, title: d.name, subtitle: d.region || d.country || 'Destination', type: 'Place', icon: Compass, path: `/attractions?destination=${encodeURIComponent(d.name)}` })
          }
        }
      } catch {
        // Destination search is optional; ignore failures
      }
    } catch {
      // If APIs fail, show no results rather than crashing
    }
    setResults(out.slice(0, 6))
    setSearching(false)
  }, [isAuthenticated])

  useEffect(() => {
    const q = query.trim()
    if (!q) { setResults([]); setSearching(false); return }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => runSearch(q), 300)
    return () => clearTimeout(debounceRef.current)
  }, [query, runSearch])

  const showResults = focused && query.trim()

  const selectResult = (result) => {
    navigate(result.path, result.state ? { state: result.state } : undefined)
    setQuery('')
    setFocused(false)
    onCloseMenu?.()
  }

  return (
    <header className="atlas-header">
      <div className="atlas-header-inner">
        <button className="atlas-mobile-menu" onClick={onMenuClick} aria-label="Open navigation">
          <Menu size={20} />
        </button>

        <button className="atlas-brand" onClick={() => navigate('/')} aria-label="AtlasAI home" style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}>
          <Logo height={38} />
        </button>

        <nav ref={navRef} className={`atlas-nav ${mobileOpen ? 'is-open' : ''}`} aria-label="Primary navigation">
          <span
            className="atlas-nav-pill"
            style={{
              transform: `translateX(${pillStyle.left}px)`,
              width: `${pillStyle.width}px`,
              opacity: pillStyle.opacity,
            }}
            aria-hidden="true"
          />
          {navItems.map(({ to, label, end }) => {
            const isAliasActive =
              (to === '/trips' && (location.pathname === '/trips' || location.pathname === '/bookings')) ||
              (to === '/attractions' && location.pathname.startsWith('/attractions'))
            return (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={onCloseMenu}
                className={({ isActive }) => `atlas-nav-link ${isActive || isAliasActive ? 'is-active' : ''}`}
              >
                {label}
              </NavLink>
            )
          })}
        </nav>

        <div className="atlas-header-actions">
          <div className="atlas-search-wrap">
            {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setFocused(true)}
              placeholder="Search trips, places..."
              aria-label="Search trips and places"
            />

            {showResults && (
              <>
                <button className="atlas-search-backdrop" aria-label="Close search" onClick={() => setFocused(false)} />
                <div className="atlas-search-results">
                  {searching ? (
                    <div className="atlas-empty-search"><Loader2 size={18} className="animate-spin" /><b>Searching…</b></div>
                  ) : results.length ? results.map((result) => {
                    const Icon = result.icon
                    return (
                      <button key={`${result.type}-${result.id}`} onClick={() => selectResult(result)}>
                        <span className="atlas-result-icon"><Icon size={15} /></span>
                        <span><b>{result.title}</b><small>{result.subtitle}</small></span>
                        <em>{result.type}</em>
                      </button>
                    )
                  }) : <div className="atlas-empty-search"><Search size={18} /><b>No matches found</b><small>Try a destination, booking or attraction.</small></div>}
                </div>
              </>
            )}
          </div>

          <ThemeToggle />

          <button
            className="atlas-icon-button atlas-notification"
            aria-label="Notifications"
            onClick={() => setShowNotifications((s) => !s)}
          >
            <Bell size={18} />
            {unreadCount > 0 && <span />}
          </button>
          {showNotifications && <NotificationPanel onClose={() => setShowNotifications(false)} />}

          <button
            className="atlas-profile-button"
            onClick={() => navigate(isAuthenticated ? '/profile' : '/login')}
            aria-label={isAuthenticated ? 'Open profile' : 'Sign in'}
          >
            <span className="atlas-avatar">
              {isAuthenticated ? user.username[0].toUpperCase() : <UserRound size={15} />}
            </span>
            <span className="atlas-profile-copy">
              <b>{isAuthenticated ? user.username : 'Sign in'}</b>
              <small className="atlas-profile-sub">
                {isAuthenticated ? (user.role === 'admin' ? 'Admin' : 'Traveler') : 'Not signed in'}
              </small>
            </span>
          </button>
        </div>
      </div>

      {mobileOpen && <div className="atlas-mobile-nav-overlay" onClick={onCloseMenu} />}
    </header>
  )
}
