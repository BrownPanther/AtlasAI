import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Sparkles,
  MapPin,
  Calendar,
  Wallet,
  Users,
  Plane,
  Train,
  Bus,
  Check,
  AlertTriangle,
  ArrowRight,
  Crosshair,
  Sliders,
  CheckCircle2,
  Clock,
  Layers,
  ShieldCheck,
} from 'lucide-react'
import GenerateTripLoader from '../components/GenerateTripLoader'
import { useAuth } from '../context/AuthContext'

const TRENDING_DESTINATIONS = ['Manali, India', 'Goa', 'Jaipur', 'Kyoto', 'Swiss Alps']

const STYLE_OPTIONS = [
  { id: 'Adventure', emoji: '🏔️', label: 'Adventure' },
  { id: 'Relaxation', emoji: '🌿', label: 'Relaxation' },
  { id: 'Culture', emoji: '🏛️', label: 'Culture' },
  { id: 'Food & Wine', emoji: '🍷', label: 'Food & Wine' },
  { id: 'Luxury', emoji: '✨', label: 'Luxury' },
  { id: 'Budget', emoji: '🎒', label: 'Budget' },
]

export default function PlanTrip() {
  const navigate = useNavigate()
  const { isAuthenticated, loading } = useAuth()
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState(null)

  const [destination, setDestination] = useState('Manali, Himachal Pradesh, India')
  const [origin, setOrigin] = useState('New Delhi')
  const [startDate, setStartDate] = useState('2026-10-10')
  const [endDate, setEndDate] = useState('2026-10-14')
  const [travellers, setTravellers] = useState(2)
  const [budget, setBudget] = useState(35000)
  const [comfort, setComfort] = useState('Standard')
  const [travelMode, setTravelMode] = useState('Bus')
  const [selectedStyles, setSelectedStyles] = useState(['Adventure', 'Relaxation'])

  const toggleStyle = (styleId) => {
    setSelectedStyles((prev) =>
      prev.includes(styleId) ? prev.filter((s) => s !== styleId) : [...prev, styleId]
    )
  }

  // Calculate duration in days
  const durationDays = useMemo(() => {
    try {
      const d1 = new Date(startDate)
      const d2 = new Date(endDate)
      const diff = Math.round((d2 - d1) / (1000 * 60 * 60 * 24))
      return diff > 0 ? diff : 1
    } catch {
      return 5
    }
  }, [startDate, endDate])

  const perDayCost = Math.round(budget / durationDays)

  // Traveler sublabel
  const travelerSublabel = useMemo(() => {
    if (travellers === 1) return 'Solo Explorer'
    if (travellers === 2) return 'Couple / Pair'
    if (travellers <= 4) return 'Small Travel Group'
    return 'Private Delegation'
  }, [travellers])

  const handleGenerate = (e) => {
    e.preventDefault()
    if (!isAuthenticated) {
      navigate('/login', { state: { from: '/plan' } })
      return
    }
    setGenError(null)
    setGenerating(true)
  }

  const tripRequest = {
    destination: destination.split(',')[0].trim(),
    origin: origin.trim(),
    startDate,
    endDate,
    travellers: Number(travellers) || 1,
    budget: Number(budget) || undefined,
    hotelPreference: comfort,
    transportPreference: travelMode.toLowerCase(),
    interests: selectedStyles,
    saveAsTrip: true,
  }

  if (generating) {
    return (
      <div className="mx-auto max-w-3xl py-12 px-4">
        <GenerateTripLoader
          tripRequest={tripRequest}
          onDone={(result) => {
            const planData = result?.state?.finalPlan || result?.finalPlan || result
            const tripData = {
              finalPlan: planData,
              tripId: result?.tripId,
              runId: result?.runId,
            }
            try {
              sessionStorage.setItem('atlasai_active_trip', JSON.stringify(tripData))
            } catch {}
            navigate('/itinerary', { state: tripData })
          }}
          onError={(msg) => {
            setGenerating(false)
            setGenError(msg)
          }}
        />
      </div>
    )
  }

  if (loading) return null

  return (
    <div className="atlas-stitch-plan-wrap w-full max-w-5xl mx-auto px-4 py-8">
      {/* Header Section */}
      <header className="relative z-10 flex flex-col items-center text-center max-w-3xl mx-auto mb-10">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/10 dark:bg-[#2d2739]/80 backdrop-blur-xl border border-purple-200 dark:border-white/20 mb-4 shadow-sm">
          <Sparkles size={16} className="text-purple-600 dark:text-[#d0bcff]" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-purple-900 dark:text-purple-600 dark:text-[#d0bcff]">
            Autonomous Travel Synthesis
          </span>
        </div>
        <h1 className="text-4xl md:text-5xl lg:text-[48px] lg:leading-[56px] text-slate-900 dark:text-white tracking-tight font-bold mb-3 text-balance">
          Where do you want to go?
        </h1>
        <p className="text-base md:text-lg text-slate-600 dark:text-slate-500 dark:text-[#cbc3d7] max-w-2xl text-balance">
          Tell AtlasAI your vision. Our multi-agent system plans stays, transport, routes and activities in seconds.
        </p>
      </header>

      {genError && (
        <div className="p-4 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 mb-6 flex items-center gap-3">
          <AlertTriangle size={18} className="text-red-400 shrink-0" />
          <span className="text-xs">{genError}</span>
        </div>
      )}

      {/* Main Planner Glass Console */}
      <form
        onSubmit={handleGenerate}
        className="relative z-10 w-full rounded-[28px] bg-white/90 dark:bg-[#231d2e]/70 backdrop-blur-2xl border border-purple-200 dark:border-white/25 p-6 md:p-10 shadow-[0_24px_60px_-15px_rgba(11,6,22,0.8),0_0_35px_rgba(160,120,255,0.12)]"
      >
        {/* Primary Destination Input Bar */}
        <div className="flex flex-col gap-2 mb-8">
          <label className="text-[11px] uppercase tracking-widest text-purple-700 dark:text-purple-600 dark:text-[#d0bcff] font-bold flex items-center gap-1.5">
            <MapPin size={15} />
            <span>Target Destination</span>
          </label>
          <div className="relative flex items-center">
            <span className="absolute left-4 text-purple-400 dark:text-slate-500 dark:text-[#cbc3d7] pointer-events-none">
              <MapPin size={22} className="text-purple-600 dark:text-[#d0bcff]" />
            </span>
            <input
              aria-label="Target Destination"
              className="w-full pl-12 pr-28 py-4 rounded-2xl bg-purple-50/70 dark:bg-[#110b1c]/80 border border-purple-200 dark:border-white/15 text-slate-900 dark:text-white text-lg md:text-xl font-medium placeholder:text-slate-400 dark:placeholder:text-[#958ea0] focus:outline-none focus:border-[#a078ff] focus:ring-1 focus:ring-[#a078ff] shadow-inner transition-all duration-300"
              placeholder="Search country, secret valley, or metropolis..."
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              required
            />
            <button
              onClick={() => setDestination('Manali, Himachal Pradesh, India')}
              aria-label="Reset to default location"
              className="absolute right-3 px-3 py-1.5 rounded-full bg-purple-100 hover:bg-purple-200 dark:bg-[#2d2739] dark:hover:bg-[#383244] border border-purple-200 dark:border-white/15 text-purple-800 dark:text-slate-500 dark:text-[#cbc3d7] hover:text-purple-900 dark:hover:text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              type="button"
            >
              <Crosshair size={14} className="text-purple-600 dark:text-[#d0bcff]" />
              <span className="hidden sm:inline">Featured</span>
            </button>
          </div>

          {/* Quick Select Pills */}
          <div className="flex items-center gap-2 flex-wrap pt-2">
            <span className="text-[11px] text-slate-500 dark:text-[#958ea0] uppercase tracking-wider font-semibold mr-1">Trending:</span>
            {TRENDING_DESTINATIONS.map((dest) => (
              <button
                key={dest}
                type="button"
                onClick={() => setDestination(dest)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 cursor-pointer border ${
                  destination.toLowerCase().includes(dest.toLowerCase().split(',')[0])
                    ? 'bg-[#a078ff]/30 text-purple-900 dark:text-white border-[#a078ff]'
                    : 'bg-purple-100/70 dark:bg-[#2d2739]/70 text-purple-900 dark:text-slate-500 dark:text-[#cbc3d7] hover:bg-purple-200 dark:hover:text-white dark:hover:bg-[#383244] border-purple-200 dark:border-white/10'
                }`}
              >
                {dest}
              </button>
            ))}
          </div>
        </div>

        {/* Two-Column Parameters Matrix */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
          {/* Field 1: Starting Point */}
          <div className="flex flex-col gap-1.5 p-4 rounded-2xl bg-purple-50/70 dark:bg-[#1e192a]/80 border border-purple-200 dark:border-white/15">
            <span className="text-[11px] uppercase text-purple-700 dark:text-[#958ea0] font-bold tracking-wider flex items-center gap-1.5">
              <Plane size={14} className="text-purple-600 dark:text-[#d0bcff]" />
              <span>Starting Point</span>
            </span>
            <div className="flex items-center justify-between mt-1">
              <input
                className="w-full bg-transparent text-slate-900 dark:text-white font-semibold text-lg focus:outline-none border-b border-transparent focus:border-[#a078ff]"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                placeholder="City or Airport (e.g. New Delhi)"
                required
              />
              <span className="px-2 py-0.5 rounded bg-purple-200 dark:bg-[#383244] text-purple-900 dark:text-purple-600 dark:text-[#d0bcff] text-[10px] font-bold shrink-0 ml-2">
                ORIGIN
              </span>
            </div>
            <span className="text-xs text-slate-500 dark:text-[#cbc3d7]">Direct flights & express rail routing enabled</span>
          </div>

          {/* Field 2: Dates */}
          <div className="flex flex-col gap-1.5 p-4 rounded-2xl bg-purple-50/70 dark:bg-[#1e192a]/80 border border-purple-200 dark:border-white/15">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase text-purple-700 dark:text-[#958ea0] font-bold tracking-wider flex items-center gap-1.5">
                <Calendar size={14} className="text-pink-600 dark:text-[#ffb0cd]" />
                <span>Travel Dates</span>
              </span>
              <span className="text-[11px] font-bold text-pink-600 dark:text-[#ffb0cd] uppercase tracking-wider">
                {durationDays} Days
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-1/2 p-1.5 rounded-lg bg-white dark:bg-[#110b1c] border border-purple-200 dark:border-white/10 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none focus:border-[#a078ff]"
                required
              />
              <span className="text-slate-400 dark:text-slate-500 dark:text-[#cbc3d7] text-xs">→</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-1/2 p-1.5 rounded-lg bg-white dark:bg-[#110b1c] border border-purple-200 dark:border-white/10 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none focus:border-[#a078ff]"
                required
              />
            </div>
            <span className="text-xs text-slate-500 dark:text-[#cbc3d7]">High atmospheric clarity window</span>
          </div>

          {/* Field 3: Travelers Stepper */}
          <div className="flex flex-col justify-between p-4 rounded-2xl bg-purple-50/70 dark:bg-[#1e192a]/80 border border-purple-200 dark:border-white/15">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] uppercase text-purple-700 dark:text-[#958ea0] font-bold tracking-wider flex items-center gap-1.5">
                <Users size={14} className="text-purple-600 dark:text-[#cebdff]" />
                <span>Travelers</span>
              </span>
              <span className="text-xs font-semibold text-purple-700 dark:text-purple-600 dark:text-[#d0bcff]">{travelerSublabel}</span>
            </div>
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900 dark:text-white">{travellers}</span>
                <span className="text-xs text-slate-500 dark:text-[#cbc3d7] font-medium">{travellers === 1 ? 'Adult' : 'Adults'}</span>
              </div>
              <div className="flex items-center gap-2 bg-purple-100 dark:bg-[#2d2739] p-1 rounded-full border border-purple-200 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setTravellers((t) => Math.max(1, t - 1))}
                  className="w-8 h-8 rounded-full flex items-center justify-center bg-white dark:bg-[#1e192a] text-slate-800 dark:text-white hover:bg-purple-50 dark:hover:bg-[#383244] transition-colors cursor-pointer border-none shadow-sm"
                  aria-label="Decrease travelers"
                >
                  -
                </button>
                <button
                  type="button"
                  onClick={() => setTravellers((t) => Math.min(12, t + 1))}
                  className="w-8 h-8 rounded-full flex items-center justify-center bg-[#a078ff] text-white hover:bg-[#b08aff] transition-colors cursor-pointer border-none shadow-sm"
                  aria-label="Increase travelers"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Field 4: Budget with Slider */}
          <div className="flex flex-col justify-between p-4 rounded-2xl bg-purple-50/70 dark:bg-[#1e192a]/80 border border-purple-200 dark:border-white/15">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] uppercase text-purple-700 dark:text-[#958ea0] font-bold tracking-wider flex items-center gap-1.5">
                <Wallet size={14} className="text-pink-600 dark:text-[#ffb0cd]" />
                <span>Total Budget</span>
              </span>
              <span className="px-2 py-0.5 rounded bg-pink-100 text-pink-700 dark:bg-[#aa0266]/30 dark:text-[#ffb0cd] text-[10px] font-bold uppercase tracking-wider">
                {budget > 80000 ? 'PREMIUM LUXE' : budget > 30000 ? 'BALANCED LUXE' : 'MODERATE'}
              </span>
            </div>
            <div className="flex items-baseline justify-between mt-1 mb-2">
              <span className="text-2xl font-bold text-slate-900 dark:text-white">₹{budget.toLocaleString('en-IN')}</span>
              <span className="text-xs text-slate-500 dark:text-[#cbc3d7]">Approx. ₹{perDayCost.toLocaleString('en-IN')} / day</span>
            </div>
            <div className="w-full flex items-center gap-3">
              <span className="text-[10px] text-slate-500 dark:text-[#958ea0] font-bold">₹10k</span>
              <input
                aria-label="Total Travel Budget"
                className="w-full h-1.5 bg-purple-200 dark:bg-[#383244] rounded-lg appearance-none cursor-pointer accent-[#a078ff]"
                max="150000"
                min="10000"
                step="2500"
                type="range"
                value={budget}
                onChange={(e) => setBudget(Number(e.target.value))}
              />
              <span className="text-[10px] text-slate-500 dark:text-[#958ea0] font-bold">₹150k+</span>
            </div>
          </div>
        </div>

        {/* Travel Style Selector */}
        <div className="flex flex-col gap-2.5 mb-8">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase text-purple-600 dark:text-[#d0bcff] font-bold tracking-widest flex items-center gap-1.5">
              <Sliders size={14} />
              <span>Select Atmospheric Tone & Style</span>
            </span>
            <span className="text-xs text-slate-500 dark:text-[#cbc3d7]">Multi-selection active</span>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {STYLE_OPTIONS.map((style) => {
              const active = selectedStyles.includes(style.id)
              return (
                <button
                  key={style.id}
                  type="button"
                  onClick={() => toggleStyle(style.id)}
                  className={`px-4 py-2.5 rounded-full text-xs font-semibold flex items-center gap-2 transition-all duration-300 cursor-pointer border ${
                    active
                      ? 'bg-[#a078ff] text-white border-white/40 shadow-[0_0_18px_rgba(160,120,255,0.4)]'
                      : 'bg-purple-100 dark:bg-[#2d2739]/60 text-purple-900 dark:text-slate-500 dark:text-[#cbc3d7] border-purple-200 dark:border-white/10 hover:bg-purple-200 dark:hover:bg-[#383244] dark:hover:text-white'
                  }`}
                >
                  <span>{style.emoji}</span>
                  <span>{style.label}</span>
                  {active && <Check size={14} />}
                </button>
              )
            })}
          </div>
        </div>

        {/* Preferences: Mode and Comfort Matrix */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <div className="flex flex-col gap-1.5 p-3.5 rounded-xl bg-purple-50/70 dark:bg-[#1e192a]/60 border border-purple-200 dark:border-white/10">
            <label className="text-[11px] uppercase font-bold text-purple-700 dark:text-[#958ea0] tracking-wider">
              Transit Preference
            </label>
            <div className="flex items-center gap-2">
              {['Flight', 'Train', 'Bus'].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setTravelMode(mode)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                    travelMode === mode
                      ? 'bg-[#a078ff] text-white border-white/30'
                      : 'bg-purple-100 dark:bg-[#2d2739] text-purple-900 dark:text-slate-500 dark:text-[#cbc3d7] border-purple-200 dark:border-white/5 hover:bg-purple-200 dark:hover:text-white'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5 p-3.5 rounded-xl bg-purple-50/70 dark:bg-[#1e192a]/60 border border-purple-200 dark:border-white/10">
            <label className="text-[11px] uppercase font-bold text-purple-700 dark:text-[#958ea0] tracking-wider">
              Stay Comfort Tier
            </label>
            <div className="flex items-center gap-2">
              {['Budget', 'Standard', 'Premium'].map((tier) => (
                <button
                  key={tier}
                  type="button"
                  onClick={() => setComfort(tier)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                    comfort === tier
                      ? 'bg-[#a078ff] text-white border-white/30'
                      : 'bg-purple-100 dark:bg-[#2d2739] text-purple-900 dark:text-slate-500 dark:text-[#cbc3d7] border-purple-200 dark:border-white/5 hover:bg-purple-200 dark:hover:text-white'
                  }`}
                >
                  {tier}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Grand Action Button */}
        <div className="relative pt-2">
          <button
            type="submit"
            className="group relative w-full py-4 px-8 rounded-full bg-gradient-to-r from-[#a078ff] via-[#9b7fed] to-[#aa0266] text-white font-bold text-lg md:text-xl tracking-tight shadow-[0_10px_30px_rgba(160,120,255,0.45),0_0_40px_rgba(255,176,205,0.2)] hover:scale-[1.01] active:scale-[0.99] transition-all duration-300 flex items-center justify-center gap-3 border border-white/30 cursor-pointer overflow-hidden"
          >
            <Sparkles size={22} className="group-hover:rotate-45 transition-transform duration-500" />
            <span>Build my trip with AI</span>
            <ArrowRight size={20} className="group-hover:translate-x-1.5 transition-transform duration-300" />
          </button>

        </div>
      </form>
    </div>
  )
}
