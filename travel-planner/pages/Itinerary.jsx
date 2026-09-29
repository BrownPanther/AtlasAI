import { useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import {
  Calendar,
  ArrowLeft,
  Sparkles,
  MapPin,
  Clock3,
  Plus,
  Copy,
  Printer,
  Check,
  Users,
  Wallet,
  Star,
  Utensils,
  Landmark,
  Trees,
  Compass,
  Bed,
  Camera,
  Car,
  Footprints,
  Navigation,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  RotateCcw,
  Zap,
} from 'lucide-react'
import OrchestratorPanel from '../components/OrchestratorPanel'
import DayTabs from '../components/itinerary/DayTabs'
import TabBar from '../components/itinerary/TabBar'
import StopDetailDrawer from '../components/itinerary/StopDetailDrawer'
import AddStopModal from '../components/itinerary/AddStopModal'
import ShareToGroupModal from '../components/itinerary/ShareToGroupModal'
import WeatherCard from '../components/itinerary/WeatherCard'
import OverviewPanel from '../components/itinerary/OverviewPanel'
import BudgetPanel from '../components/itinerary/BudgetPanel'
import InsightsPanel from '../components/itinerary/InsightsPanel'
import SafetyPanel from '../components/itinerary/SafetyPanel'
import { api } from '../services/api'

function toMinutes(hhmm) {
  if (!hhmm || !hhmm.includes(':')) return null
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

function recomputeCompletion(day) {
  const total = day.stops.length
  const done = day.stops.filter((s) => s.completed).length
  return total ? Math.round((done / total) * 100) : 0
}

function formatDayDate(dateStr) {
  if (!dateStr) return null
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  } catch {
    return dateStr
  }
}

function formatShortDate(dateStr) {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch {
    return dateStr
  }
}

function getCategoryMeta(category, label = '') {
  const cat = (category || '').toLowerCase()
  const lab = (label || '').toLowerCase()
  if (cat.includes('food') || cat.includes('meal') || lab.includes('breakfast') || lab.includes('lunch') || lab.includes('dinner') || lab.includes('cafe')) {
    return { icon: Utensils, label: category || 'Meal', badgeClass: 'is-food' }
  }
  if (cat.includes('nature') || cat.includes('park') || cat.includes('garden') || cat.includes('outdoor')) {
    return { icon: Trees, label: category || 'Nature', badgeClass: 'is-nature' }
  }
  if (cat.includes('culture') || cat.includes('historic') || cat.includes('temple') || cat.includes('museum') || cat.includes('monument')) {
    return { icon: Landmark, label: category || 'Culture', badgeClass: 'is-culture' }
  }
  if (cat.includes('stay') || cat.includes('hotel') || lab.includes('hotel') || lab.includes('resort')) {
    return { icon: Bed, label: category || 'Accommodation', badgeClass: 'is-stay' }
  }
  if (cat.includes('adventure') || cat.includes('trek') || cat.includes('sport')) {
    return { icon: Compass, label: category || 'Adventure', badgeClass: 'is-adventure' }
  }
  return { icon: Camera, label: category || 'Sightseeing', badgeClass: 'is-sightseeing' }
}

export default function Itinerary() {
  const location = useLocation()
  const navigate = useNavigate()
  const [finalPlan, setFinalPlan] = useState(() => {
    if (location.state?.finalPlan) return location.state.finalPlan
    try {
      const saved = sessionStorage.getItem('atlasai_active_trip')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed?.finalPlan) return parsed.finalPlan
      }
    } catch {}
    return null
  })
  const [tripId] = useState(() => {
    if (location.state?.tripId) return location.state.tripId
    try {
      const saved = sessionStorage.getItem('atlasai_active_trip')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed?.tripId) return parsed.tripId
      }
    } catch {}
    return null
  })
  const [loading, setLoading] = useState(!location.state?.finalPlan)
  const [dayIndex, setDayIndex] = useState(0)
  const [activeTab, setActiveTab] = useState('plan')
  const [selectedStopIndex, setSelectedStopIndex] = useState(null)
  const [showAddStop, setShowAddStop] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [shared, setShared] = useState(false)
  const [dragIndex, setDragIndex] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (finalPlan) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)

    const idToFetch = location.state?.tripId || tripId
    if (idToFetch) {
      api.getTrip(idToFetch)
        .then(({ trip }) => {
          if (!cancelled && trip?.finalPlan) {
            setFinalPlan(trip.finalPlan)
            try {
              sessionStorage.setItem('atlasai_active_trip', JSON.stringify({ finalPlan: trip.finalPlan, tripId: trip.id }))
            } catch {}
          }
        })
        .catch(() => {})
        .finally(() => { if (!cancelled) setLoading(false) })
      return () => { cancelled = true }
    }

    // Auto-load latest trip if accessed directly without state
    api.listTrips()
      .then(({ trips: list }) => {
        if (!cancelled && list && list.length > 0) {
          const latest = list[0]
          if (latest?.finalPlan) {
            setFinalPlan(latest.finalPlan)
            try {
              sessionStorage.setItem('atlasai_active_trip', JSON.stringify({ finalPlan: latest.finalPlan, tripId: latest.id }))
            } catch {}
          }
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [finalPlan, location.state, tripId])

  const persist = async (updated) => {
    if (!tripId) return
    try { await api.updateTrip(tripId, { finalPlan: updated }) } catch { /* non-blocking — local state already reflects the change */ }
  }

  const mutateDays = (mutator) => {
    setFinalPlan((prev) => {
      const prevDays = Array.isArray(prev?.days) ? prev.days : []
      const days = prevDays.map((d) => ({ ...d, stops: (d.stops || []).map((s) => ({ ...s })) }))
      mutator(days)
      days.forEach((d) => { d.completionPercent = recomputeCompletion(d) })
      const updated = { ...prev, days }
      persist(updated)
      return updated
    })
  }

  if (loading) return <div className="atlas-surface mx-auto max-w-md p-10 text-center"><Sparkles className="mx-auto text-accent animate-spin" /><p className="mt-4 text-sm atlas-muted">Loading your itinerary...</p></div>

  if (!finalPlan) return <div className="atlas-surface mx-auto max-w-md p-10 text-center"><Sparkles className="mx-auto text-accent" /><h2 className="mt-4 text-lg font-bold">No trip generated yet</h2><p className="mt-2 text-sm atlas-muted">Start with your preferences and let AtlasAI build your itinerary.</p><button className="btn-primary mt-5" onClick={() => navigate('/plan')}>Plan a trip</button></div>

  const budget = finalPlan.budget || {}
  const days = Array.isArray(finalPlan.days) ? finalPlan.days : []
  const day = days[dayIndex] || days[0] || { stops: [], date: null }
  const stops = Array.isArray(day.stops) ? day.stops : []
  const selectedStop = selectedStopIndex !== null ? stops[selectedStopIndex] : null
  const nextStop = selectedStopIndex !== null ? stops[selectedStopIndex + 1] : null
  const travelTimeToNextMinutes = selectedStop && nextStop ? Math.max(toMinutes(nextStop.startTime) - toMinutes(selectedStop.endTime), 0) : null
  const dayDateFormatted = formatDayDate(day.date)
  const breakdown = budget.breakdown || {}
  const numDays = days.length || 1
  const dailyStay = Math.round((breakdown.stay || 0) / numDays)
  const dailyFood = Math.round((breakdown.food || 0) / numDays)
  const dailyTransit = Math.round((breakdown.localTravel || 0) / numDays)
  const dayActivityCost = stops.reduce((sum, s) => sum + (s && s.costKnown !== false && typeof s.estimatedCost === 'number' ? s.estimatedCost : 0), 0)
  const dayCost = (dailyStay || dailyFood || dailyTransit)
    ? (dailyStay + dailyFood + dailyTransit + dayActivityCost)
    : dayActivityCost

  const toggleComplete = () => mutateDays((days) => { days[dayIndex].stops[selectedStopIndex].completed = !days[dayIndex].stops[selectedStopIndex].completed })
  const toggleStopCompletion = (idx, e) => {
    e.stopPropagation()
    mutateDays((days) => {
      days[dayIndex].stops[idx].completed = !days[dayIndex].stops[idx].completed
    })
  }

  const removeStop = () => { mutateDays((days) => { days[dayIndex].stops.splice(selectedStopIndex, 1) }); setSelectedStopIndex(null) }
  const moveStop = (targetDayIndex) => {
    if (targetDayIndex === dayIndex) return
    mutateDays((days) => {
      const [stop] = days[dayIndex].stops.splice(selectedStopIndex, 1)
      days[targetDayIndex].stops.push(stop)
      days[targetDayIndex].stops.sort((a, b) => (a.startTime > b.startTime ? 1 : -1))
    })
    setSelectedStopIndex(null)
    setDayIndex(targetDayIndex)
  }
  const replaceStop = (alternative) => {
    mutateDays((days) => {
      days[dayIndex].stops[selectedStopIndex] = {
        id: alternative.id,
        label: alternative.name,
        category: alternative.category,
        area: alternative.area,
        startTime: day.stops[selectedStopIndex].startTime,
        endTime: day.stops[selectedStopIndex].endTime,
        durationHours: alternative.durationHours,
        estimatedCost: alternative.estimatedCost,
        costKnown: alternative.costKnown !== false,
        durationEstimated: Boolean(alternative.durationEstimated),
        dataSource: alternative.dataSource,
        notes: null,
        completed: false,
      }
    })
    setSelectedStopIndex(null)
  }
  const addStop = (stopData) => {
    mutateDays((days) => {
      const start = toMinutes(stopData.startTime)
      const end = start + Math.round(stopData.durationHours * 60)
      const endHHMM = `${String(Math.floor(end / 60) % 24).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`
      const stop = { ...stopData, endTime: endHHMM }
      days[dayIndex].stops.push(stop)
      days[dayIndex].stops.sort((a, b) => (a.startTime > b.startTime ? 1 : -1))
    })
    setShowAddStop(false)
  }

  const onDragStart = (i) => setDragIndex(i)
  const onDropStop = (i) => {
    if (dragIndex === null || dragIndex === i) { setDragIndex(null); setDragOver(false); return }
    mutateDays((days) => {
      const stops = days[dayIndex].stops
      const [moved] = stops.splice(dragIndex, 1)
      stops.splice(i, 0, moved)
    })
    setDragIndex(null)
    setDragOver(false)
  }

  const copySummary = () => {
    const lines = [
      `${finalPlan.destination} — ${finalPlan.days.length} day(s)`,
      `${finalPlan.startDate || ''} → ${finalPlan.endDate || ''}`,
      `Estimated cost: ₹${(budget.total || 0).toLocaleString()}`,
      '',
      ...finalPlan.days.flatMap((d) => [
        `Day ${d.dayNumber} (${d.theme || ''})`,
        ...d.stops.map((s) => `  ${s.startTime} — ${s.label}`),
        '',
      ]),
    ]
    navigator.clipboard.writeText(lines.join('\n')).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  const totalStops = finalPlan.days?.reduce((sum, d) => sum + (d.stops?.length || 0), 0) || 0
  const budgetEfficiency = Math.min(Math.round(budget.percentUsed || 62.8), 100)
  const dayTraversingKm = (day.stops.reduce((sum, s) => sum + (s.travelToNext?.distanceKm || 0), 0)).toFixed(1)
  const dayBudgetCap = Math.round((budget.total || 35000) / (finalPlan.days.length || 1))
  const dayHeadroom = Math.max(dayBudgetCap - dayCost, 0)
  const transportSummary = finalPlan.transport?.provider ? `${finalPlan.transport.provider} booked` : 'Private SUV booked'

  return (
    <div className="atlas-itinerary-ambient-wrapper">

      {/* Stitch Master Scrim & Trip Header */}
      <section className="atlas-stitch-master-scrim">
        <div className="atlas-stitch-caustic-1" />
        <div className="atlas-stitch-caustic-2" />

        <div className="atlas-stitch-header-content">
          {/* Sub-meta Breadcrumb & Live Agent Badge */}
          <div className="atlas-stitch-top-bar">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <button
                onClick={() => navigate('/plan')}
                className="atlas-stitch-btn-glass"
                style={{ padding: '4px 12px', fontSize: 11 }}
              >
                <ArrowLeft size={13} /> Edit trip
              </button>
              <span className="atlas-live-pulse-badge">
                <span className="atlas-ping-dot" /> Autonomous Itinerary Studio
              </span>
              <span className="atlas-trip-id-tag">
                ID · {tripId ? tripId.slice(0, 8).toUpperCase() : 'ML-8492-EXP'}
              </span>
            </div>

            <div className="atlas-budget-efficiency-pill">
              <span>Budget Efficiency:</span>
              <strong>{budgetEfficiency}% Utilized</strong>
            </div>
          </div>

          {/* Master Title & Metas */}
          <div className="atlas-stitch-title-row">
            <div>
              <h1 className="atlas-stitch-heading">
                {finalPlan.destination} Escape
              </h1>
              <p className="atlas-stitch-subheading">
                <strong>{finalPlan.origin || 'New Delhi'}</strong>
                <span className="sep">→</span>
                <strong>{finalPlan.destination}</strong>
                <span className="sep">·</span>
                <span>{finalPlan.startDate || '—'} → {finalPlan.endDate || '—'}</span>
                <span className="sep">·</span>
                <span>{finalPlan.travelers || 2} travelers</span>
                <span className="sep">·</span>
                <span className="font-semibold text-purple-700 dark:text-[#e9def7]">₹{(budget.total || 0).toLocaleString()} budget</span>
              </p>
            </div>

            {/* Action Glass Pills */}
            <div className="atlas-stitch-actions">
              <button
                type="button"
                className="atlas-stitch-btn-primary"
                onClick={() => {
                  window.dispatchEvent(
                    new CustomEvent('open-ask-atlasai', {
                      detail: { destination: finalPlan.destination },
                    })
                  )
                }}
              >
                <Sparkles size={15} /> Ask AtlasAI
              </button>
              <button
                type="button"
                className="atlas-stitch-btn-glass"
                onClick={() => navigate('/plan')}
              >
                <RotateCcw size={14} className="text-purple-600 dark:text-[#d0bcff]" /> Re-plan with AI
              </button>
              <button
                type="button"
                className="atlas-stitch-btn-glass"
                onClick={() => setActiveTab('insights')}
              >
                <Zap size={14} className="text-pink-600 dark:text-[#ffb0cd]" /> AI Insights
              </button>
              <button
                type="button"
                className="atlas-stitch-btn-glass"
                onClick={() => window.print()}
                title="Print or export trip"
                aria-label="Print or export trip"
              >
                <Printer size={15} />
              </button>
              <button
                type="button"
                className="atlas-stitch-btn-glass"
                onClick={() => setShowShare(true)}
                disabled={!tripId}
                title="Share to group"
                aria-label="Share to group"
              >
                <Users size={15} />
              </button>
              <button
                type="button"
                className="atlas-stitch-btn-glass"
                onClick={copySummary}
                title="Copy itinerary summary"
                aria-label="Copy itinerary summary"
              >
                {copied ? <Check size={15} /> : <Copy size={15} />}
              </button>
            </div>
          </div>

          {/* Summary Glass Pill Ribbon */}
          <div className="atlas-stitch-ribbon">
            <div className="atlas-stitch-ribbon-pill">
              <Clock3 size={14} className="text-purple-600 dark:text-[#d0bcff]" />
              <span>{finalPlan.days.length} days</span>
            </div>
            <div className="atlas-stitch-ribbon-pill">
              <Users size={14} className="text-purple-600 dark:text-[#d0bcff]" />
              <span>{finalPlan.travelers || 2} travelers</span>
            </div>
            <div className="atlas-stitch-ribbon-pill is-savings">
              <Wallet size={14} className="text-rose-600 dark:text-[#ffb0cd]" />
              <span>₹{(budget.total || 0).toLocaleString()} estimated <strong className="font-semibold text-rose-700 dark:text-[#ffd9e4]">(Under budget)</strong></span>
            </div>
            <div className="atlas-stitch-ribbon-pill is-stops">
              <Compass size={14} className="text-violet-600 dark:text-[#cebdff]" />
              <span>{totalStops} curated stops</span>
            </div>
            <div className="atlas-stitch-ribbon-pill">
              <Car size={14} className="text-purple-600 dark:text-[#d0bcff]" />
              <span>{transportSummary}</span>
            </div>
          </div>
        </div>
      </section>

      <TabBar active={activeTab} onChange={setActiveTab} />

      {activeTab === 'plan' && (
        <>
          {/* Centered Liquid-Glass Day Selector Capsule */}
          <section className="atlas-liquid-day-section" aria-label="Itinerary day selector">
            <div className="atlas-liquid-day-capsule">
              <button
                type="button"
                className="atlas-liquid-day-arrow"
                onClick={() => { if (dayIndex > 0) { setDayIndex(dayIndex - 1); setSelectedStopIndex(null) } }}
                disabled={dayIndex === 0}
                aria-label="Previous day"
              >
                <ChevronLeft size={18} />
              </button>

              <div className="atlas-liquid-day-list">
                {finalPlan.days.map((d, i) => {
                  const isActive = i === dayIndex
                  return (
                    <button
                      key={d.dayNumber || i}
                      type="button"
                      className={`atlas-liquid-day-btn ${isActive ? 'is-active' : ''}`}
                      onClick={() => { setDayIndex(i); setSelectedStopIndex(null) }}
                    >
                      {isActive && <span className="atlas-active-pulse-dot" />}
                      <span>DAY {d.dayNumber}</span>
                      {d.date && <span style={{ opacity: 0.75, fontSize: 11 }}>· {formatShortDate(d.date)}</span>}
                    </button>
                  )
                })}
              </div>

              <button
                type="button"
                className="atlas-liquid-day-arrow"
                onClick={() => { if (dayIndex < finalPlan.days.length - 1) { setDayIndex(dayIndex + 1); setSelectedStopIndex(null) } }}
                disabled={dayIndex >= finalPlan.days.length - 1}
                aria-label="Next day"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </section>

          <div className="atlas-itinerary-grid">
            <div className="atlas-day-shell" style={{ width: '100%', marginBottom: '32px' }}>
              {/* Stitch Day Meta Subhead Strip */}
              <div className="atlas-day-subhead-strip">
                <div className="atlas-day-subhead-left">
                  <div className="atlas-day-subhead-icon">
                    <Compass size={18} />
                  </div>
                  <div>
                    <h3 className="atlas-day-subhead-title">
                      {day.theme || `${day.destination || finalPlan.destination} Exploration`}
                    </h3>
                    <div className="atlas-day-subhead-meta">
                      DAY {day.dayNumber} · {day.stops.length} itinerary nodes{Number(dayTraversingKm) > 0 ? ` · ${dayTraversingKm} km traversing route` : ''} · {day.completionPercent > 0 ? `${day.completionPercent}% complete` : 'Verified route'}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('overview')}
                  className="atlas-stitch-btn-glass"
                  style={{ padding: '6px 14px', fontSize: 12 }}
                >
                  <Navigation size={13} /> View Map
                </button>
              </div>

              {/* Upgraded Premium Timeline & Stop Cards (Requirements 4, 5, 6, 7) */}
              <div
                className={`atlas-timeline-v2 ${dragOver ? 'is-drag-over' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
              >
                {day.stops.map((stop, index) => {
                  const next = day.stops[index + 1]
                  const catMeta = getCategoryMeta(stop.category, stop.label)
                  const CatIcon = catMeta.icon
                  const isCompleted = Boolean(stop.completed)
                  const gapMinutes = next ? Math.max(toMinutes(next.startTime) - toMinutes(stop.endTime), 0) : null
                  const hasImage = Boolean(stop.image || stop.previewImage)

                  return (
                    <div key={`${stop.id || stop.label}-${index}`} className="atlas-timeline-segment">
                      <div
                        className={`atlas-stop-card-v2 ${isCompleted ? 'is-completed' : ''} ${dragIndex === index ? 'is-dragging' : ''}`}
                        draggable
                        onDragStart={() => onDragStart(index)}
                        onDragEnd={() => { setDragIndex(null); setDragOver(false) }}
                        onDrop={(e) => { e.preventDefault(); onDropStop(index) }}
                        onDragOver={(e) => e.preventDefault()}
                        onClick={() => setSelectedStopIndex(index)}
                      >
                        {/* Timeline Spine & Node */}
                        <div className="atlas-stop-spine-col">
                          <div className={`atlas-stop-node ${isCompleted ? 'is-done' : ''}`}>
                            {isCompleted ? <Check size={11} strokeWidth={3} /> : <CatIcon size={12} />}
                          </div>
                          {index < day.stops.length - 1 && <div className="atlas-stop-spine-line" />}
                        </div>

                        {/* Stop Content Card */}
                        <div className="atlas-stop-card-body">
                          <div className="atlas-stop-card-top">
                            <div className="atlas-stop-time-tag">
                              <Clock3 size={11} />
                              <span>{stop.startTime}{stop.endTime ? ` – ${stop.endTime}` : ''}</span>
                            </div>
                            <div className={`atlas-stop-category-pill ${catMeta.badgeClass}`}>
                              <CatIcon size={11} />
                              <span>{catMeta.label}</span>
                            </div>
                            <div className="atlas-stop-card-actions">
                              <button
                                type="button"
                                className={`atlas-stop-check-btn ${isCompleted ? 'is-checked' : ''}`}
                                title={isCompleted ? 'Mark uncompleted' : 'Mark completed'}
                                onClick={(e) => toggleStopCompletion(index, e)}
                              >
                                <Check size={12} />
                              </button>
                              <span className="atlas-stop-arrow-hint"><ChevronRight size={14} /></span>
                            </div>
                          </div>

                          <div className="atlas-stop-card-main">
                            <div className="atlas-stop-info">
                              <h4 className="atlas-stop-title">{stop.label}</h4>
                              {stop.notes && <p className="atlas-stop-notes">{stop.notes}</p>}

                              <div className="atlas-stop-pills">
                                {stop.area && (
                                  <span className="atlas-meta-pill">
                                    <MapPin size={11} /> {stop.area}
                                  </span>
                                )}
                                {stop.durationHours != null && (
                                  <span className="atlas-meta-pill">
                                    <Clock3 size={11} /> {Math.round(stop.durationHours * 60)} min{stop.durationEstimated ? ' (est)' : ''}
                                  </span>
                                )}
                                {stop.costKnown === false ? (
                                  <span className="atlas-meta-pill is-muted">
                                    <Wallet size={11} /> Price unlisted
                                  </span>
                                ) : typeof stop.estimatedCost === 'number' && stop.estimatedCost > 0 ? (
                                  <span className="atlas-meta-pill is-cost">
                                    <Wallet size={11} /> ₹{stop.estimatedCost.toLocaleString()}
                                  </span>
                                ) : stop.costKnown && stop.estimatedCost === 0 ? (
                                  <span className="atlas-meta-pill is-free">Free</span>
                                ) : null}
                                {stop.rating != null && (
                                  <span className="atlas-meta-pill is-rating">
                                    <Star size={11} fill="#eab308" color="#eab308" /> {stop.rating}/3
                                  </span>
                                )}
                              </div>
                            </div>

                            {hasImage && (
                              <div className="atlas-stop-thumb">
                                <img src={stop.image || stop.previewImage} alt={stop.label} loading="lazy" />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Travel Transition between consecutive stops (Requirement 7) */}
                      {next && (
                        <div className="atlas-travel-transition-row">
                          <div className="atlas-travel-connector-spine" />
                          {stop.travelToNext ? (
                            <div className="atlas-travel-pill is-route">
                              {stop.travelToNext.mode === 'walking' ? <Footprints size={12} /> : <Car size={12} />}
                              <span>
                                <strong>{stop.travelToNext.durationMinutes} min</strong> {stop.travelToNext.mode || 'drive'} · {stop.travelToNext.distanceKm} km
                                {stop.travelToNext.dataSource === 'live' ? ' (live)' : ''}
                              </span>
                            </div>
                          ) : typeof gapMinutes === 'number' && gapMinutes > 10 ? (
                            <div className="atlas-travel-pill is-gap">
                              <Navigation size={11} />
                              <span>~{gapMinutes} min transition (estimated)</span>
                            </div>
                          ) : (
                            <div className="atlas-travel-pill is-spacer" />
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="atlas-add-stop-row">
                <button className="atlas-add-stop-btn-premium" onClick={() => setShowAddStop(true)}>
                  <Plus size={14} /> Add a stop to this day
                </button>
              </div>

              {/* Stitch Quick Itinerary Budget Mini Breakdown */}
              <div className="atlas-day-budget-card" style={{ marginTop: '24px' }}>
                <div className="atlas-day-budget-head">
                  <span>Allocated Day Cost</span>
                  <strong>₹{dayCost.toLocaleString()} of ₹{dayBudgetCap.toLocaleString()} / day</strong>
                </div>
                <div className="atlas-day-budget-bar-track">
                  <div
                    className="atlas-day-budget-bar-fill"
                    style={{ width: `${Math.min(Math.round((dayCost / (dayBudgetCap || 1)) * 100), 100)}%` }}
                  />
                </div>
                {(dailyStay > 0 || dailyFood > 0 || dailyTransit > 0) && (
                  <div className="flex flex-wrap items-center justify-between gap-1 text-[10.5px] text-slate-500 dark:text-[#a599b5] mt-2.5 pt-2 border-t border-purple-100 dark:border-white/10 font-medium">
                    <span>Stay: ₹{dailyStay.toLocaleString()}</span>
                    <span>Meals: ₹{dailyFood.toLocaleString()}</span>
                    <span>Transit: ₹{dailyTransit.toLocaleString()}</span>
                    <span>Activities: {dayActivityCost > 0 ? `₹${dayActivityCost.toLocaleString()}` : 'Free'}</span>
                  </div>
                )}
                <div className="atlas-day-budget-footer">
                  <span>Spend target: Balanced</span>
                  <span className="headroom">₹{dayHeadroom.toLocaleString()} headroom remaining today</span>
                </div>
              </div>
            </div>

            {/* SECONDARY INFO SIDEBAR */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <WeatherCard destination={finalPlan.destination} activeDay={day} />
              <OrchestratorPanel finalPlan={finalPlan} />
            </div>
          </div>
        </>
      )}

      {activeTab === 'overview' && <OverviewPanel finalPlan={finalPlan} />}
      {activeTab === 'budget' && <BudgetPanel finalPlan={finalPlan} />}
      {activeTab === 'insights' && <InsightsPanel finalPlan={finalPlan} />}
      {activeTab === 'safety' && (tripId ? <SafetyPanel tripId={tripId} /> : <p style={{ marginTop: 20, fontSize: 12, color: 'var(--muted)' }}>Save this trip to unlock location sharing and emergency alerts.</p>)}

      {selectedStop && (
        <StopDetailDrawer
          stop={selectedStop}
          dayIndex={dayIndex}
          dayCount={finalPlan.days.length}
          travelTimeToNextMinutes={travelTimeToNextMinutes}
          alternatives={finalPlan.activityAlternatives}
          onClose={() => setSelectedStopIndex(null)}
          onToggleComplete={toggleComplete}
          onRemove={removeStop}
          onMove={moveStop}
          onReplace={replaceStop}
        />
      )}

      {showAddStop && <AddStopModal onAdd={addStop} onClose={() => setShowAddStop(false)} />}

      {showShare && tripId && (
        <ShareToGroupModal
          tripId={tripId}
          destination={finalPlan.destination}
          onClose={() => setShowShare(false)}
          onShared={() => { setShowShare(false); setShared(true); setTimeout(() => setShared(false), 3000) }}
        />
      )}
      {shared && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: 'var(--color-success)', color: '#fff', padding: '10px 18px', borderRadius: 12, fontSize: 12, fontWeight: 700, zIndex: 95 }}>
          Shared to group
        </div>
      )}

      {/* =========================================================
          DEDICATED FULL MULTI-DAY PRINT DOCUMENT (@media print)
          ========================================================= */}
      <div className="atlas-print-document" aria-hidden="true">
        <header className="atlas-print-header">
          <div className="atlas-print-brand">ATLASAI</div>
          <h1 className="atlas-print-title">{finalPlan.destination} Getaway</h1>
          <div className="atlas-print-route">
            {finalPlan.origin || 'Delhi'} → {finalPlan.destination}
          </div>
          <div className="atlas-print-meta-grid">
            <div><strong>Dates:</strong> {finalPlan.startDate || '—'} → {finalPlan.endDate || '—'}</div>
            <div><strong>Duration:</strong> {days.length} Days</div>
            <div><strong>Travelers:</strong> {finalPlan.travellers || 1} Person(s)</div>
            <div><strong>Budget:</strong> ₹{(budget.total || 0).toLocaleString()}</div>
          </div>
        </header>

        {/* ALL DAYS INCLUDED */}
        {days.map((d) => (
          <section key={d.dayNumber} className="atlas-print-day-section">
            <div className="atlas-print-day-header">
              <h2 className="atlas-print-day-title">
                DAY {d.dayNumber}: {(d.theme || d.destination || 'Exploring').toUpperCase()}
              </h2>
              <div style={{ fontSize: '9pt', color: '#555', marginTop: 2 }}>
                {d.date ? formatDayDate(d.date) : ''} · {d.stops.length} scheduled stops
                {d.weather?.tempMaxC != null && ` · Weather: ${d.weather.condition || ''} (${d.weather.tempMinC}°–${d.weather.tempMaxC}°C)`}
              </div>
            </div>

            <table className="atlas-print-stop-table">
              <thead>
                <tr>
                  <th style={{ width: '15%' }}>Time</th>
                  <th style={{ width: '42%' }}>Stop / Activity</th>
                  <th style={{ width: '25%' }}>Area & Category</th>
                  <th style={{ width: '18%', textAlign: 'right' }}>Est. Cost</th>
                </tr>
              </thead>
              <tbody>
                {d.stops.map((stop, sIdx) => {
                  const next = d.stops[sIdx + 1]
                  return (
                    <tr key={`${stop.id || stop.label}-${sIdx}`}>
                      <td>
                        <strong>{stop.startTime}</strong>{stop.endTime ? ` – ${stop.endTime}` : ''}
                      </td>
                      <td>
                        <strong>{stop.label}</strong>
                        {stop.notes && <div style={{ fontSize: '8.5pt', color: '#555', marginTop: 2 }}>{stop.notes}</div>}
                        {next?.travelToNext && (
                          <div className="atlas-print-transition">
                            ↳ Next: {next.travelToNext.durationMinutes} min {next.travelToNext.mode || 'drive'} ({next.travelToNext.distanceKm} km)
                          </div>
                        )}
                      </td>
                      <td>
                        {stop.category || 'Sightseeing'}
                        {stop.area && <div style={{ fontSize: '8.5pt', color: '#555' }}>{stop.area}</div>}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {stop.costKnown === false ? 'Unlisted' : stop.estimatedCost === 0 ? 'Free' : `₹${(stop.estimatedCost || 0).toLocaleString()}`}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </section>
        ))}

        {/* LOGISTICS & SUMMARY SECTIONS (Only if actual data exists) */}
        <div className="atlas-print-section-divider">
          {finalPlan.transport && (
            <div className="atlas-print-summary-box">
              <h3 className="atlas-print-subhead">TRANSPORT</h3>
              <div>
                <strong>{finalPlan.transport.mode?.toUpperCase()}</strong> · {finalPlan.transport.provider || 'Carrier'} · {finalPlan.transport.from} → {finalPlan.transport.to}
                {finalPlan.transport.departure && ` (Departure: ${finalPlan.transport.departure}, Arrival: ${finalPlan.transport.arrival})`}
                {finalPlan.transport.price != null && ` · ₹${finalPlan.transport.price.toLocaleString()}`}
              </div>
            </div>
          )}

          {finalPlan.stay && (
            <div className="atlas-print-summary-box">
              <h3 className="atlas-print-subhead">STAY</h3>
              <div>
                <strong>{finalPlan.stay.name}</strong> ({finalPlan.stay.category || 'Hotel'}) · {finalPlan.stay.area || finalPlan.destination}
                {finalPlan.stay.pricePerNight != null && ` · ₹${finalPlan.stay.pricePerNight.toLocaleString()}/night`}
              </div>
            </div>
          )}

          {(finalPlan.weatherAdjustments || finalPlan.days.some((d) => d.weather)) && (
            <div className="atlas-print-summary-box">
              <h3 className="atlas-print-subhead">WEATHER</h3>
              <div>
                {finalPlan.days.filter((d) => d.weather?.tempMaxC != null).map((d) => (
                  <span key={d.dayNumber} style={{ marginRight: 14, display: 'inline-block' }}>
                    Day {d.dayNumber}: {d.weather.condition || 'Clear'} ({d.weather.tempMinC}°–{d.weather.tempMaxC}°C)
                  </span>
                ))}
              </div>
            </div>
          )}

          {budget.total != null && (
            <div className="atlas-print-summary-box">
              <h3 className="atlas-print-subhead">BUDGET</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 4 }}>
                <div>Total: <strong>₹{(budget.total || 0).toLocaleString()}</strong></div>
                {budget.transport != null && <div>Transport: <strong>₹{budget.transport.toLocaleString()}</strong></div>}
                {budget.stay != null && <div>Lodging: <strong>₹{budget.stay.toLocaleString()}</strong></div>}
                {budget.activities != null && <div>Activities: <strong>₹{budget.activities.toLocaleString()}</strong></div>}
              </div>
            </div>
          )}
        </div>

        <footer className="atlas-print-footer">
          <p>Generated by AtlasAI Travel Studio · {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
          <p>Important: AtlasAI itineraries are advisory schedules. Travelers must confirm all booking schedules and terms directly with transport and hotel operators.</p>
        </footer>
      </div>
    </div>
  )
}
