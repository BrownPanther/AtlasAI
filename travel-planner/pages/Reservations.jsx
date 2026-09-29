import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plane, Train, Bus, Hotel, Car, CheckCircle2, ArrowUpRight, SlidersHorizontal, AlertTriangle, Search } from 'lucide-react'
import { flights, trains, buses, hotels, rentals } from '../data/mockData'
import { useBookings } from '../context/BookingContext'
import { useAuth } from '../context/AuthContext'
import { api, ApiError } from '../services/api'

const tabs = [
  { key: 'Flight', label: 'Flights', icon: Plane, data: flights },
  { key: 'Train', label: 'Trains', icon: Train, data: trains },
  { key: 'Bus', label: 'Buses', icon: Bus, data: buses },
  { key: 'Hotel', label: 'Hotels', icon: Hotel, data: hotels },
  { key: 'Rental', label: 'Rentals', icon: Car, data: rentals },
]

import { SOURCE_LABEL, toFlightListItem, toListItem } from '../services/reservationMappers'

// Maps a normalized backend train (see trainNormalizer.js) into the same
// list-row shape. RailRadar's search never returns a fare, so price is
// "on request" for live trains; status only reflects what the provider
// actually reported (never inferred from the scheduled time).
function toTrainListItem(t) {
  const name = [t.trainNumber, t.trainName].filter(Boolean).join(' ') || t.provider
  const delay = t.delayMinutes ? ` · ${t.delayMinutes} min late` : ''
  return {
    id: t.id,
    provider: name,
    route: `${t.from || '—'} → ${t.to || '—'}`,
    time: t.departure && t.arrival ? `${t.departure} → ${t.arrival}${t.stops != null ? ` · ${t.stops} halts` : ''}` : 'schedule not listed',
    price: t.price ?? 0,
    status: t.dataSource === 'sample' ? 'Sample' : `${t.status ? t.status.charAt(0).toUpperCase() + t.status.slice(1) : 'Scheduled'}${delay}`,
    dataSource: t.dataSource,
    priceKnown: t.price != null,
  }
}

function defaultDepartureDate() {
  const d = new Date()
  d.setDate(d.getDate() + 30)
  return d.toISOString().slice(0, 10)
}

export default function Reservations() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const [active, setActive] = useState('Flight')
  const [selected, setSelected] = useState({})
  const [error, setError] = useState(null)
  const { addBooking } = useBookings()
  const current = tabs.find((t) => t.key === active)

  const [hotelQuery, setHotelQuery] = useState('Manali')
  const [hotelDraft, setHotelDraft] = useState('Manali')
  const [hotelItems, setHotelItems] = useState(hotels)
  const [hotelStatus, setHotelStatus] = useState('idle') // idle | loading | error
  const [hotelMeta, setHotelMeta] = useState(null)

  const [flightQuery, setFlightQuery] = useState({ destination: 'Manali', departureDate: defaultDepartureDate() })
  const [flightDraft, setFlightDraft] = useState({ destination: 'Manali', departureDate: defaultDepartureDate() })
  const [flightItems, setFlightItems] = useState(flights)
  const [flightStatus, setFlightStatus] = useState('idle') // idle | loading | error
  const [flightMeta, setFlightMeta] = useState(null)

  const [trainQuery, setTrainQuery] = useState({ destination: 'Jaipur', date: defaultDepartureDate() })
  const [trainDraft, setTrainDraft] = useState({ destination: 'Jaipur', date: defaultDepartureDate() })
  const [trainItems, setTrainItems] = useState(trains)
  const [trainStatus, setTrainStatus] = useState('idle') // idle | loading | error
  const [trainMeta, setTrainMeta] = useState(null)

  useEffect(() => {
    if (active !== 'Train') return
    let cancelled = false
    setTrainStatus('loading')
    api.searchTrains(trainQuery.destination, { date: trainQuery.date, limit: 10 })
      .then((res) => {
        if (cancelled) return
        setTrainItems(res.trains.map(toTrainListItem))
        setTrainMeta({ dataSource: res.dataSource, fallbackReason: res.fallbackReason, stale: res.stale })
        setTrainStatus('idle')
      })
      .catch(() => {
        if (cancelled) return
        setTrainItems(trains)
        setTrainMeta(null)
        setTrainStatus('error')
      })
    return () => { cancelled = true }
  }, [active, trainQuery])

  const handleTrainSearch = (e) => {
    e.preventDefault()
    setTrainQuery({
      destination: trainDraft.destination.trim() || 'Jaipur',
      date: trainDraft.date || defaultDepartureDate(),
    })
  }

  useEffect(() => {
    if (active !== 'Flight') return
    let cancelled = false
    setFlightStatus('loading')
    api.searchFlights(flightQuery.destination, { departureDate: flightQuery.departureDate, limit: 10 })
      .then((res) => {
        if (cancelled) return
        setFlightItems(res.flights.map(toFlightListItem))
        setFlightMeta({ dataSource: res.dataSource, fallbackReason: res.fallbackReason, stale: res.stale })
        setFlightStatus('idle')
      })
      .catch((err) => {
        if (cancelled) return
        // Backend already falls back to sample data on provider/validation
        // failure, so reaching here means the request itself failed
        // (network/auth) — fall back to the bundled mock catalog rather
        // than an empty page.
        setFlightItems(flights)
        setFlightMeta(null)
        setFlightStatus(err instanceof ApiError ? 'error' : 'error')
      })
    return () => { cancelled = true }
  }, [active, flightQuery])

  const handleFlightSearch = (e) => {
    e.preventDefault()
    setFlightQuery({
      destination: flightDraft.destination.trim() || 'Manali',
      departureDate: flightDraft.departureDate || defaultDepartureDate(),
    })
  }

  useEffect(() => {
    if (active !== 'Hotel') return
    let cancelled = false
    setHotelStatus('loading')
    api.searchHotels(hotelQuery, { limit: 10 })
      .then((res) => {
        if (cancelled) return
        setHotelItems(res.hotels.map(toListItem))
        setHotelMeta({ dataSource: res.dataSource, fallbackReason: res.fallbackReason, stale: res.stale })
        setHotelStatus('idle')
      })
      .catch((err) => {
        if (cancelled) return
        // Backend already falls back to sample data on provider failure, so
        // reaching here means the request itself failed (network/auth) —
        // fall back to the bundled mock catalog rather than an empty page.
        setHotelItems(hotels)
        setHotelMeta(null)
        setHotelStatus(err instanceof ApiError ? 'error' : 'error')
      })
    return () => { cancelled = true }
  }, [active, hotelQuery])

  const handleHotelSearch = (e) => {
    e.preventDefault()
    setHotelQuery(hotelDraft.trim() || 'Manali')
  }

  const handleSelect = async (item) => {
    if (!isAuthenticated) { navigate('/login', { state: { from: '/reservations' } }); return }
    setError(null)
    try {
      await addBooking(item, active)
      setSelected((s) => ({ ...s, [item.id]: true }))
    } catch (err) {
      setError(err.message)
    }
  }

  const listData = active === 'Hotel' ? hotelItems : active === 'Flight' ? flightItems : active === 'Train' ? trainItems : current.data

  return (
    <div>
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="atlas-eyebrow">Travel marketplace</p><h1 className="atlas-page-title">Find the right way there.</h1><p className="atlas-page-copy">Compare transport and stays, then save the best match to your trip.</p></div><button className="atlas-ghost-button"><SlidersHorizontal size={14} /> Filters</button></section>
      {error && <div className="atlas-error-text"><AlertTriangle size={14} /> {error}</div>}
      <div className="atlas-tabs">{tabs.map(({ key, label, icon: Icon }) => <button key={key} onClick={() => setActive(key)} className={`atlas-tab ${active === key ? 'active' : ''}`}><Icon size={14} />{label}</button>)}</div>
      {active === 'Hotel' && (
        <form onSubmit={handleHotelSearch} className="flex items-center gap-2">
          <input value={hotelDraft} onChange={(e) => setHotelDraft(e.target.value)} placeholder="Destination (e.g. Manali, Goa, Jaipur)" style={{ flex: 1, minWidth: 0, border: '1px solid var(--border)', borderRadius: 10, padding: '8px 10px', fontSize: 11, background: 'var(--surface)', color: 'var(--text)' }} />
          <button type="submit" className="atlas-ghost-button"><Search size={14} /> Search</button>
          {hotelMeta?.dataSource && <span className={hotelMeta.dataSource === 'estimated' ? 'atlas-pill is-estimated' : hotelMeta.dataSource === 'sample' ? 'atlas-pill is-sample' : 'badge-success'}>{SOURCE_LABEL[hotelMeta.dataSource] || hotelMeta.dataSource}{hotelMeta.stale ? ' (last known)' : ''}</span>}
        </form>
      )}
      {active === 'Hotel' && hotelStatus === 'loading' && <div className="atlas-list-surface">{[1, 2, 3].map(i => <div key={i} className="atlas-list-row atlas-attraction-skeleton" style={{ padding: 25 }}><div className="atlas-list-icon" style={{ background: "rgba(124,58,237,0.05)" }}></div><div className="atlas-list-main"><div className="line short" style={{ margin: "0 0 5px", background: "rgba(124,58,237,0.1)" }}></div><div className="line" style={{ margin: 0, width: "30%", background: "rgba(124,58,237,0.1)" }}></div></div></div>)}</div>}
      {active === 'Hotel' && hotelStatus === 'error' && <div className="atlas-error-text"><AlertTriangle size={14} /> Hotel provider temporarily unavailable — showing sample listings.</div>}
      {active === 'Hotel' && hotelStatus === 'idle' && hotelItems.length === 0 && <p className="atlas-page-copy">No hotels found for this destination.</p>}
      {active === 'Train' && (
        <form onSubmit={handleTrainSearch} className="flex items-center gap-2">
          <input value={trainDraft.destination} onChange={(e) => setTrainDraft((d) => ({ ...d, destination: e.target.value }))} placeholder="Destination (e.g. Jaipur, Goa)" style={{ flex: 1, minWidth: 0, border: '1px solid var(--border)', borderRadius: 10, padding: '8px 10px', fontSize: 11, background: 'var(--surface)', color: 'var(--text)' }} />
          <input type="date" value={trainDraft.date} onChange={(e) => setTrainDraft((d) => ({ ...d, date: e.target.value }))} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '8px 10px', fontSize: 11, background: 'var(--surface)', color: 'var(--text)' }} />
          <button type="submit" className="atlas-ghost-button"><Search size={14} /> Search</button>
          {trainMeta?.dataSource && <span className="badge-success">{SOURCE_LABEL[trainMeta.dataSource] || trainMeta.dataSource}{trainMeta.stale ? ' (last known)' : ''}</span>}
        </form>
      )}
      {active === 'Train' && trainStatus === 'loading' && <div className="atlas-list-surface">{[1, 2, 3].map(i => <div key={i} className="atlas-list-row atlas-attraction-skeleton" style={{ padding: 25 }}><div className="atlas-list-icon" style={{ background: "rgba(124,58,237,0.05)" }}></div><div className="atlas-list-main"><div className="line short" style={{ margin: "0 0 5px", background: "rgba(124,58,237,0.1)" }}></div><div className="line" style={{ margin: 0, width: "30%", background: "rgba(124,58,237,0.1)" }}></div></div></div>)}</div>}
      {active === 'Train' && trainStatus === 'error' && <div className="atlas-error-text"><AlertTriangle size={14} /> Train provider temporarily unavailable — showing sample listings.</div>}
      {active === 'Train' && trainStatus === 'idle' && trainMeta?.dataSource === 'cached' && <p className="atlas-page-copy">Showing cached train data.</p>}
      {active === 'Train' && trainStatus === 'idle' && trainItems.length === 0 && <p className="atlas-page-copy">No trains found.</p>}
      {active === 'Flight' && (
        <form onSubmit={handleFlightSearch} className="flex items-center gap-2">
          <input value={flightDraft.destination} onChange={(e) => setFlightDraft((d) => ({ ...d, destination: e.target.value }))} placeholder="Destination (e.g. Manali, Goa, Jaipur)" style={{ flex: 1, minWidth: 0, border: '1px solid var(--border)', borderRadius: 10, padding: '8px 10px', fontSize: 11, background: 'var(--surface)', color: 'var(--text)' }} />
          <input type="date" value={flightDraft.departureDate} onChange={(e) => setFlightDraft((d) => ({ ...d, departureDate: e.target.value }))} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '8px 10px', fontSize: 11, background: 'var(--surface)', color: 'var(--text)' }} />
          <button type="submit" className="atlas-ghost-button"><Search size={14} /> Search</button>
          {flightMeta?.dataSource && <span className={flightMeta.dataSource === 'estimated' ? 'atlas-pill is-estimated' : flightMeta.dataSource === 'sample' ? 'atlas-pill is-sample' : 'badge-success'}>{SOURCE_LABEL[flightMeta.dataSource] || flightMeta.dataSource}{flightMeta.stale ? ' (last known)' : ''}</span>}
        </form>
      )}
      {active === 'Flight' && flightStatus === 'loading' && <div className="atlas-list-surface">{[1, 2, 3].map(i => <div key={i} className="atlas-list-row atlas-attraction-skeleton" style={{ padding: 25 }}><div className="atlas-list-icon" style={{ background: "rgba(124,58,237,0.05)" }}></div><div className="atlas-list-main"><div className="line short" style={{ margin: "0 0 5px", background: "rgba(124,58,237,0.1)" }}></div><div className="line" style={{ margin: 0, width: "30%", background: "rgba(124,58,237,0.1)" }}></div></div></div>)}</div>}
      {active === 'Flight' && flightStatus === 'error' && <div className="atlas-error-text"><AlertTriangle size={14} /> Flight provider temporarily unavailable — showing sample listings.</div>}
      {active === 'Flight' && flightStatus === 'idle' && flightMeta?.fallbackReason === 'no_results' && <p className="atlas-page-copy">No flights found for these criteria.</p>}
      {active === 'Flight' && flightStatus === 'idle' && flightItems.length === 0 && <p className="atlas-page-copy">No flights found for this destination.</p>}
      {(active === 'Bus' || active === 'Rental') && <div style={{ fontSize: 11, color: 'var(--muted)', padding: '8px 0', display: 'flex', alignItems: 'center', gap: 6 }}><span className="atlas-pill is-sample">Sample data</span> No live provider is connected for {active === 'Bus' ? 'buses' : 'vehicle rentals'}. These are demo listings.</div>}
      <div className="atlas-list-surface">
        {listData.map((item) => {
          const Icon = current.icon
          const isEstimate = item.isEstimate || item.sourceType === 'estimated' || item.dataSource === 'estimated'
          return (
            <div key={item.id} className="atlas-list-row">
              <span className="atlas-list-icon"><Icon size={17} /></span>
              <div className="atlas-list-main">
                <b>{item.provider}</b>
                <small>{item.route} · {item.time}</small>
                {item.statusDetail && (
                  <small style={{ color: 'var(--muted)', display: 'block', fontSize: 10, marginTop: 2 }}>{item.statusDetail}</small>
                )}
              </div>
              <span className={isEstimate ? 'atlas-pill is-estimated' : item.status === 'Sample' ? 'atlas-pill is-sample' : 'badge-success'}>
                {item.status}
              </span>
              <div className="atlas-list-end">
                <span className="atlas-price">
                  {item.priceFormatted || (item.priceKnown === false ? 'Price on request' : `₹${item.price.toLocaleString()}`)}
                </span>
                {item.searchUrl ? (
                  <a
                    href={item.searchUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="atlas-ghost-button"
                    style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '6px 10px' }}
                  >
                    {item.actionText || 'Search live availability'} <ArrowUpRight size={13} />
                  </a>
                ) : (
                  <button onClick={() => handleSelect(item)} className={selected[item.id] ? 'badge-success' : 'btn-primary'}>
                    {selected[item.id] ? <><CheckCircle2 size={13} /> Selected</> : <>Select <ArrowUpRight size={13} /></>}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}



