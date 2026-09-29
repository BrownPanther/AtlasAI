import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  Plane,
  Train,
  Bus,
  Hotel,
  Car,
  FileText,
  X,
  Eye,
  Star,
  CheckCircle2,
  Calendar,
  Clock,
  Sparkles,
  ArrowRight,
  Info,
  Users,
  Wallet,
  Compass,
} from 'lucide-react'
import { useBookings } from '../context/BookingContext'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'

const iconFor = { Flight: Plane, Train, Bus, Hotel, Rental: Car }
const statusStyle = {
  pending: 'badge-warn',
  confirmed: 'badge-success',
  completed: 'badge-success',
  cancelled: 'badge-danger',
  reviewed: 'badge-success',
  selected: 'badge-warn',
}
const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '')

const NEXT_STATUS = { pending: 'confirmed', confirmed: 'completed' }
const NEXT_LABEL = { pending: 'Confirm booking', confirmed: 'Mark completed' }
const DESTINATION_IMAGES = {
  manali: '/images/manali.jpeg',
  jaipur: '/images/jaipur.jpg',
  goa: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=800&auto=format&fit=crop&q=80',
  kerala: 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=800&auto=format&fit=crop&q=80',
  delhi: 'https://images.unsplash.com/photo-1587474260584-136574528ed5?w=800&auto=format&fit=crop&q=80',
  mumbai: 'https://images.unsplash.com/photo-1570168007204-dfb528c6958f?w=800&auto=format&fit=crop&q=80',
  agra: 'https://images.unsplash.com/photo-1564507592333-c60657eea523?w=800&auto=format&fit=crop&q=80',
  bhopal: 'https://images.unsplash.com/photo-1627894483216-2138af692e32?w=800&auto=format&fit=crop&q=80',
  bengaluru: 'https://images.unsplash.com/photo-1596176530529-78163a4f7af2?w=800&auto=format&fit=crop&q=80',
  bangalore: 'https://images.unsplash.com/photo-1596176530529-78163a4f7af2?w=800&auto=format&fit=crop&q=80',
  kolkata: 'https://images.unsplash.com/photo-1558431382-27e303142255?w=800&auto=format&fit=crop&q=80',
  varanasi: 'https://images.unsplash.com/photo-1561361513-2d000a50f0dc?w=800&auto=format&fit=crop&q=80',
  udaipur: 'https://images.unsplash.com/photo-1615836245337-f5b9b2303f10?w=800&auto=format&fit=crop&q=80',
  shimla: 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=800&auto=format&fit=crop&q=80',
  ladakh: 'https://images.unsplash.com/photo-1581793745862-99fde7fa73d2?w=800&auto=format&fit=crop&q=80',
  rishikesh: 'https://images.unsplash.com/photo-1604608672516-f1b9b3e7c1d4?w=800&auto=format&fit=crop&q=80',
  amritsar: 'https://images.unsplash.com/photo-1593811167562-9cef47bfc4d7?w=800&auto=format&fit=crop&q=80',
  jodhpur: 'https://images.unsplash.com/photo-1551776235-dde6d5e56af4?w=800&auto=format&fit=crop&q=80',
  mysuru: 'https://images.unsplash.com/photo-1580289046162-1d6e7e32a62d?w=800&auto=format&fit=crop&q=80',
  mysore: 'https://images.unsplash.com/photo-1580289046162-1d6e7e32a62d?w=800&auto=format&fit=crop&q=80',
  paris: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800&auto=format&fit=crop&q=80',
  london: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=800&auto=format&fit=crop&q=80',
  tokyo: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=800&auto=format&fit=crop&q=80',
  dubai: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=800&auto=format&fit=crop&q=80',
  singapore: 'https://images.unsplash.com/photo-1565967511849-76a60a516170?w=800&auto=format&fit=crop&q=80',
  bangkok: 'https://images.unsplash.com/photo-1563492065599-3520f775eeed?w=800&auto=format&fit=crop&q=80',
  bali: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=800&auto=format&fit=crop&q=80',
}

// Diverse pool of generic travel photos — used when destination is unrecognized
const TRIP_DEFAULT_IMAGES = [
  'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1503220317375-aaad61436b1b?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500835556837-99ac94a94552?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1454372182658-c712e4c5a1db?w=800&auto=format&fit=crop&q=80'
]

function hashPick(list, key) {
  if (!list || !list.length) return ''
  let hash = 0
  const s = String(key || '')
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0
  return list[hash % list.length]
}

function getTripImage(dest) {
  const d = String(dest || '').toLowerCase().trim()
  if (!d) return TRIP_DEFAULT_IMAGES[0]
  // 1. Exact key match
  if (DESTINATION_IMAGES[d]) return DESTINATION_IMAGES[d]
  // 2. Destination string contains a known key (e.g. "New Delhi" → matches "delhi")
  for (const [k, v] of Object.entries(DESTINATION_IMAGES)) {
    if (d.includes(k)) return v
  }
  return hashPick(TRIP_DEFAULT_IMAGES, d)
}


function ReviewModal({ booking, onClose, onSubmitted }) {
  const [rating, setRating] = useState(5)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [error, setError] = useState(null)
  const [sending, setSending] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setSending(true)
    setError(null)
    try {
      await api.createServiceReview(booking.serviceId, { bookingId: booking.id, rating, title, body })
      onSubmitted()
    } catch (err) {
      setError(err.message)
      setSending(false)
    }
  }

  return (
    <div className="atlas-modal-backdrop" onClick={onClose}>
      <div className="atlas-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <p className="atlas-eyebrow">Rate & review</p>
        <h4>{booking.name}</h4>
        <form onSubmit={submit} className="atlas-field-grid" style={{ gridTemplateColumns: '1fr', marginTop: 14 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                type="button"
                key={n}
                onClick={() => setRating(n)}
                aria-label={`${n} stars`}
                style={{ border: 0, background: 'transparent', cursor: 'pointer' }}
              >
                <Star size={22} fill={n <= rating ? '#f59e0b' : 'none'} color={n <= rating ? '#f59e0b' : 'var(--border)'} />
              </button>
            ))}
          </div>
          <div className="atlas-field">
            <label>Title (optional)</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Sum it up in a few words" />
          </div>
          <div className="atlas-field">
            <label>Review (optional)</label>
            <input value={body} onChange={(e) => setBody(e.target.value)} placeholder="What stood out?" />
          </div>
          {error && <p className="atlas-error-text">{error}</p>}
          <button type="submit" className="btn-primary atlas-plan-submit" disabled={sending}>
            {sending ? 'Submitting…' : 'Submit review'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function BookingManager() {
  const navigate = useNavigate()
  const { isAuthenticated, loading: authLoading } = useAuth()
  const { bookingList, updateStatus, cancelBooking, refresh } = useBookings()
  const [trips, setTrips] = useState([])
  const [tripsLoading, setTripsLoading] = useState(true)
  const [viewing, setViewing] = useState(null)
  const [reviewing, setReviewing] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) {
      setTripsLoading(false)
      return
    }
    let cancelled = false
    setTripsLoading(true)
    api.listTrips()
      .then((res) => {
        if (!cancelled) setTrips(res?.trips || [])
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || 'Failed to load trips')
      })
      .finally(() => {
        if (!cancelled) setTripsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [isAuthenticated, authLoading])

  const advance = async (b) => {
    try {
      await updateStatus(b.id, NEXT_STATUS[b.status])
    } catch (err) {
      setError(err.message)
    }
  }

  const cancel = async (b) => {
    try {
      await cancelBooking(b.id)
    } catch (err) {
      setError(err.message)
    }
  }

  const openTrip = (trip) => {
    navigate('/itinerary', {
      state: {
        tripId: trip.id,
        finalPlan: trip.finalPlan,
      },
    })
  }

  return (
    <div className="atlas-trips-page">
      {/* Page Header */}
      <section className="atlas-trips-header">
        <p className="atlas-eyebrow">Your Travel Hub</p>
        <h1 className="atlas-page-title">Trips & Reservations</h1>
        <p className="atlas-page-copy">
          Access your AI-planned multi-day trips and track your transport and lodging bookings.
        </p>
      </section>

      {error && <p className="atlas-error-text">{error}</p>}

      {/* SECTION 1: PLANNED TRIPS */}
      <section className="atlas-trips-section">
        <div className="atlas-trips-section-header">
          <div>
            <h2 className="atlas-section-title">Planned Trips</h2>
            <p className="atlas-section-sub">
              Full multi-day itineraries crafted by AtlasAI agent orchestration.
            </p>
          </div>
          <Link to="/plan" className="btn-primary" style={{ fontSize: 13, padding: '8px 16px' }}>
            <Sparkles size={14} /> Plan New Trip
          </Link>
        </div>

        {tripsLoading ? (
          <div className="atlas-trips-loading">
            <Sparkles className="animate-spin text-accent" size={24} />
            <p>Loading your trips…</p>
          </div>
        ) : trips.length === 0 ? (
          <div className="atlas-empty-trips-box">
            <Compass size={36} className="text-purple-400" />
            <p className="atlas-eyebrow">YOUR TRIPS</p>
            <h3 style={{ fontSize: 20, fontWeight: 800, margin: '6px 0' }}>No trips yet</h3>
            <p style={{ color: 'var(--muted)', fontSize: 13, margin: '0 0 16px 0' }}>Create your first AI-planned journey.</p>
            <Link to="/plan" className="btn-primary">
              <Sparkles size={14} /> Plan a Trip
            </Link>
          </div>
        ) : (
          <div className="atlas-trips-grid">
            {trips.map((trip) => {
              const plan = trip.finalPlan || {}
              const dayCount = plan.days?.length || 1
              const stopCount = plan.days?.reduce((sum, d) => sum + (d.stops?.length || 0), 0) || 0
              const totalCost = plan.budget?.total || trip.budget

              return (
                <article key={trip.id} className="atlas-trip-card">
                  <div className="atlas-trip-card-banner">
                    <img
                      src={getTripImage(trip.destination)}
                      alt={trip.destination}
                      className="atlas-trip-card-banner-img"
                      loading="lazy"
                    />
                  </div>

                  <div className="atlas-trip-card-content">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <h3 className="atlas-trip-title" style={{ margin: 0 }}>
                        {trip.destination} Getaway
                      </h3>
                      {plan.dataSource && (
                        <span className={`atlas-trip-source-pill ${plan.dataSource === 'live' || plan.dataSource === 'cached' ? 'is-live' : 'is-sample'}`}>
                          {plan.dataSource === 'live' ? 'Live data' : plan.dataSource === 'cached' ? 'Cached' : 'Sample'}
                        </span>
                      )}
                    </div>

                  <div className="atlas-trip-meta-list">
                    <div className="atlas-trip-meta-row">
                      <Calendar size={13} />
                      <span>{trip.startDate || '—'} → {trip.endDate || '—'} ({dayCount} days)</span>
                    </div>
                    {trip.origin && (
                      <div className="atlas-trip-meta-row">
                        <Compass size={13} />
                        <span>Origin: {trip.origin}</span>
                      </div>
                    )}
                    <div className="atlas-trip-meta-row">
                      <Clock size={13} />
                      <span>{stopCount} scheduled {stopCount === 1 ? 'stop' : 'stops'}</span>
                    </div>
                    {totalCost != null && (
                      <div className="atlas-trip-meta-row">
                        <Wallet size={13} />
                        <span>₹{Number(totalCost).toLocaleString()} estimated budget</span>
                      </div>
                    )}
                  </div>

                  <div className="atlas-trip-card-footer">
                    <button
                      type="button"
                      className="btn-primary atlas-open-trip-btn"
                      onClick={() => openTrip(trip)}
                    >
                      Open Trip <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
              </article>
              )
            })}
          </div>
        )}
      </section>

      {/* SECTION 2: CONFIRMED RESERVATIONS */}
      <section className="atlas-trips-section mt-10">
        <div className="atlas-trips-section-header">
          <div>
            <h2 className="atlas-section-title">Confirmed Bookings & Reservations</h2>
            <p className="atlas-section-sub">
              Saved flights, hotels and transport reservations.
            </p>
          </div>
        </div>

        {/* Honest Disclaimer Banner */}
        <div className="atlas-booking-honest-banner" role="note">
          <Info size={16} className="text-amber-400 flex-shrink-0" />
          <p>
            <strong>AtlasAI has not charged or booked tickets directly.</strong> AtlasAI provides intelligent travel planning and reservation tracking. Actual tickets, room confirmations, and payments are completed directly with airline and hotel providers.
          </p>
        </div>

        <div className="atlas-list-surface">
          {bookingList.length === 0 ? (
            <div className="p-8 text-center text-sm atlas-muted">
              No reservations tracked yet. When you confirm bookings with transport or hotel providers, save them here.
            </div>
          ) : (
            bookingList.map((b) => {
              const Icon = iconFor[b.type] || FileText
              return (
                <div key={b.id} className="atlas-list-row">
                  <span className="atlas-list-icon">
                    <Icon size={17} />
                  </span>
                  <div className="atlas-list-main">
                    <b>{b.name}</b>
                    <small>{b.type} · {b.dateLabel || '—'}</small>
                  </div>
                  <span className={statusStyle[b.status] || 'badge-warn'}>{capitalize(b.status)}</span>
                  <span className="atlas-price">₹{b.price.toLocaleString()}</span>
                  <button onClick={() => setViewing(b)} className="atlas-action" aria-label="View booking">
                    <Eye size={16} />
                  </button>
                  {NEXT_STATUS[b.status] && (
                    <button
                      onClick={() => advance(b)}
                      className="atlas-action"
                      aria-label={NEXT_LABEL[b.status]}
                      title={NEXT_LABEL[b.status]}
                    >
                      <CheckCircle2 size={16} />
                    </button>
                  )}
                  {b.status === 'completed' && (
                    <button
                      onClick={() => setReviewing(b)}
                      className="atlas-action"
                      aria-label="Rate and review"
                      title="Rate & review"
                    >
                      <Star size={16} />
                    </button>
                  )}
                  {(b.status === 'pending' || b.status === 'confirmed') && (
                    <button
                      onClick={() => cancel(b)}
                      className="atlas-action"
                      aria-label="Cancel booking"
                      title="Cancel"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              )
            })
          )}
        </div>
      </section>

      {/* Booking Details Modal */}
      {viewing && (
        <div className="atlas-modal-backdrop" onClick={() => setViewing(null)}>
          <div className="atlas-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <p className="atlas-eyebrow">Booking details</p>
            <h3 className="mt-2 text-lg font-bold">{viewing.name}</h3>
            <div className="mt-5 grid gap-3 text-sm atlas-muted">
              <div>Type <strong className="float-right text-[var(--text)]">{viewing.type}</strong></div>
              <div>Date <strong className="float-right text-[var(--text)]">{viewing.dateLabel || '—'}</strong></div>
              <div>Price <strong className="float-right text-[var(--text)]">₹{viewing.price.toLocaleString()}</strong></div>
              <div>Status <strong className="float-right text-[var(--text)]">{capitalize(viewing.status)}</strong></div>
            </div>
            <button className="btn-primary mt-6 w-full" onClick={() => setViewing(null)}>Close</button>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {reviewing && (
        <ReviewModal
          booking={reviewing}
          onClose={() => setReviewing(null)}
          onSubmitted={() => {
            setReviewing(null)
            refresh()
          }}
        />
      )}
    </div>
  )
}
