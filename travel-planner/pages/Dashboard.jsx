import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Sparkles,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Calendar,
  Wallet,
  Compass,
  Users,
  Route,
  Cpu,
  Radio,
  ShieldCheck,
  Star,
  Sun,
  CloudSun,
  Moon,
} from 'lucide-react'
import { api } from '../services/api'
import { useAuth } from '../context/AuthContext'

const FEATURED_DESTINATIONS = [
  {
    id: 'manali',
    name: 'Manali Himalayan Valley',
    shortName: 'Manali Valley',
    region: 'Himachal Pradesh',
    badge: 'Featured Curation',
    rating: 4.96,
    weather: '18°C · Alpine Serene',
    weatherIcon: CloudSun,
    tagline: 'Autonomous Node',
    description: 'Snowcapped Himalayan serenity, cedar forests & boutique alpine retreats with private hydrothermal springs.',
    tags: ['Mountains', 'Adventure', 'Wellness'],
    image: '/images/manali.jpeg',
    planDestination: 'Manali',
  },
  {
    id: 'goa',
    name: 'Goa Coastal Sanctuary',
    shortName: 'Goa Coast',
    region: 'Goa',
    badge: 'Coastal Bliss',
    rating: 4.92,
    weather: '29°C · Sunset Gold',
    weatherIcon: Sun,
    tagline: 'Shoreline Haven',
    description: 'Palm-fringed private coves, heritage Portuguese villas & tranquil beachfront sunset architecture.',
    tags: ['Coastal', 'Relaxation', 'Culinary'],
    image: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=1200&auto=format&fit=crop&q=80',
    planDestination: 'Goa',
  },
  {
    id: 'jaipur',
    name: 'Jaipur Royal Heritage',
    shortName: 'Jaipur Palace',
    region: 'Rajasthan',
    badge: 'Imperial Grandeur',
    rating: 4.95,
    weather: '24°C · Royal Dusk',
    weatherIcon: Moon,
    tagline: 'Heritage Matrix',
    description: 'Centuries of royalty, astronomical observatories, illuminated red sandstone arches & culinary artistry.',
    tags: ['Culture', 'Heritage', 'Architecture'],
    image: '/images/jaipur.jpg',
    planDestination: 'Jaipur',
  },
  {
    id: 'kerala',
    name: 'Kerala Emerald Backwaters',
    shortName: 'Kerala Waters',
    region: 'Kerala',
    badge: 'Verdant Haven',
    rating: 4.98,
    weather: '27°C · Emerald Mist',
    weatherIcon: CloudSun,
    tagline: 'Eco Sanctuaries',
    description: 'Private handcrafted houseboats drifting through calm coconut-canopied canals with Ayurvedic wellness spas.',
    tags: ['Nature', 'Houseboats', 'Wellness'],
    image: 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=1200&auto=format&fit=crop&q=80',
    planDestination: 'Kerala',
  },
]

export default function Dashboard() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const [trips, setTrips] = useState([])
  const [loading, setLoading] = useState(isAuthenticated)
  const [activeIdx, setActiveIdx] = useState(0)

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false)
      return
    }
    let cancelled = false
    api.listTrips()
      .then(({ trips: list }) => {
        if (!cancelled) setTrips(list || [])
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [isAuthenticated])

  const handlePrev = () => {
    setActiveIdx((prev) => (prev === 0 ? FEATURED_DESTINATIONS.length - 1 : prev - 1))
  }

  const handleNext = () => {
    setActiveIdx((prev) => (prev === FEATURED_DESTINATIONS.length - 1 ? 0 : prev + 1))
  }

  const current = trips[0]
  const plan = current?.finalPlan
  const activityCount = plan?.days?.reduce((sum, d) => sum + (d.stops?.length || 0), 0)
  const estimatedCost = plan?.budget?.total ?? current?.budget

  return (
    <div className="atlas-stitch-home-wrap" style={{ position: 'relative', width: '100%', paddingBottom: '32px' }}>
      {/* Atmospheric Caustic Underlays */}
      <div
        className="pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 w-[850px] h-[480px] bg-gradient-to-b from-[#a078ff]/20 via-[#aa0266]/10 to-transparent blur-[120px] -z-10 rounded-full"
        aria-hidden="true"
      />

      {/* Hero Section */}
      <section className="flex flex-col items-center text-center pt-8 pb-12 w-full max-w-4xl mx-auto px-4">
        {/* Eyebrow Pill */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/10 dark:bg-[#2d2739]/80 backdrop-blur-xl border border-purple-200 dark:border-white/20 shadow-lg mb-6 transition-transform hover:scale-105 duration-300">
          <Sparkles size={16} className="text-purple-600 dark:text-[#d0bcff]" />
          <span className="text-[11px] font-bold tracking-widest text-purple-900 dark:text-[#e9def7] uppercase">
            Atlas Multi-Agent Intelligence v4.2
          </span>
          <span className="inline-block w-2 h-2 rounded-full bg-[#ec4899] animate-ping ml-1" />
        </div>

        {/* Monumental Display Headline */}
        <h1 className="text-5xl sm:text-6xl md:text-[76px] md:leading-[84px] tracking-tight text-slate-900 dark:text-white font-semibold mb-4 text-balance">
          Plan less.<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-700 via-[#8b5cf6] to-[#ec4899] dark:from-white dark:via-[#d0bcff] dark:to-[#ffb0cd]">
            Travel more.
          </span>
        </h1>

        {/* Subtitle / Body Statement */}
        <p className="text-lg md:text-xl text-slate-600 dark:text-[#cbc3d7] max-w-2xl mx-auto font-normal leading-relaxed mb-8 text-balance">
          Let AtlasAI coordinate your journey — transport, stays, activities, routes and budget with refined computational intuition.
        </p>

        {/* CTAs */}
        <div className="flex flex-wrap items-center justify-center gap-4 w-full">
          <button
            onClick={() => navigate('/plan')}
            className="group flex items-center gap-2.5 px-8 py-3.5 rounded-full bg-gradient-to-r from-[#a078ff] to-[#6d3bd7] text-white font-medium text-sm shadow-[0_12px_32px_rgba(160,120,255,0.45)] hover:shadow-[0_16px_40px_rgba(160,120,255,0.65)] hover:scale-105 active:scale-95 transition-all duration-300 border border-white/30 cursor-pointer"
            type="button"
          >
            <Sparkles size={18} className="transition-transform duration-300 group-hover:rotate-45" />
            <span className="font-semibold text-white">Plan a trip with AI</span>
            <ArrowRight size={16} className="opacity-80 group-hover:translate-x-1 transition-transform" />
          </button>

          <button
            onClick={() => navigate('/attractions')}
            className="flex items-center gap-2 px-7 py-3.5 rounded-full bg-white/80 dark:bg-[#231d2e]/70 backdrop-blur-xl border border-purple-200 dark:border-white/20 hover:bg-purple-50 dark:hover:bg-[#2d2739]/90 text-slate-800 dark:text-[#e9def7] font-medium text-sm shadow-md hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer"
            type="button"
          >
            <Compass size={18} className="text-purple-600 dark:text-[#cebdff]" />
            <span>Explore destinations</span>
          </button>
        </div>
      </section>

      {/* Stitch 3D Featured Showcase Carousel with Real Physics-Based Sliding Track */}
      <section className="relative w-full py-6 flex flex-col items-center overflow-hidden select-none">
        <div className="relative w-full max-w-[1360px] h-[510px] md:h-[550px] mx-auto flex items-center justify-center overflow-hidden">
          {FEATURED_DESTINATIONS.map((dest, i) => {
            let diff = (i - activeIdx) % FEATURED_DESTINATIONS.length
            if (diff > FEATURED_DESTINATIONS.length / 2) diff -= FEATURED_DESTINATIONS.length
            if (diff < -FEATURED_DESTINATIONS.length / 2) diff += FEATURED_DESTINATIONS.length

            const isActive = diff === 0
            const isPrev = diff === -1
            const isNext = diff === 1
            const isVisible = Math.abs(diff) <= 1

            // Dynamic horizontal translation
            const translateX = `calc(-50% + ${diff * 105}%)`
            const scale = isActive ? 1 : 0.88
            const opacity = isActive ? 1 : isVisible ? 0.6 : 0
            const zIndex = isActive ? 30 : isVisible ? 10 : 0
            const pointerEvents = isVisible ? 'auto' : 'none'

            return (
              <div
                key={dest.id}
                onClick={() => {
                  if (isPrev) handlePrev()
                  else if (isNext) handleNext()
                }}
                className={`absolute top-1/2 left-1/2 rounded-3xl overflow-hidden cursor-pointer transition-all duration-700 ease-[cubic-bezier(0.2,0.9,0.3,1.2)] ${
                  isActive
                    ? 'w-[92vw] sm:w-[540px] md:w-[640px] lg:w-[720px] h-[460px] md:h-[500px] shadow-[0_24px_60px_-15px_rgba(0,0,0,0.85),0_0_45px_rgba(160,120,255,0.25)] border border-white/30 dark:border-white/30 ring-1 ring-white/20'
                    : 'w-[280px] sm:w-[320px] md:w-[380px] lg:w-[420px] h-[360px] md:h-[420px] border border-slate-200 dark:border-white/10 shadow-xl filter brightness-90 hover:brightness-100 hover:opacity-85'
                }`}
                style={{
                  transform: `translate(${translateX}, -50%) scale(${scale})`,
                  opacity,
                  zIndex,
                  pointerEvents,
                }}
              >
                <img
                  src={dest.image}
                  alt={dest.name}
                  className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
                  loading="eager"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0e071c] via-[#0e071c]/40 to-transparent pointer-events-none" />

                {/* Top Metadata Bar */}
                <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none">
                  <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/80 dark:bg-[#110b1c]/80 backdrop-blur-xl text-slate-900 dark:text-[#e9def7] text-xs font-medium border border-slate-200 dark:border-white/20 shadow-md">
                    <dest.weatherIcon size={14} className="text-[#d0bcff]" />
                    {dest.weather}
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#a078ff]/90 backdrop-blur-xl text-white text-[11px] font-bold tracking-wider uppercase shadow-md border border-white/30">
                    <Star size={12} fill="currentColor" />
                    {dest.badge}
                  </span>
                </div>

                {/* Content Console */}
                {isActive ? (
                  <div className="absolute bottom-4 left-4 right-4 p-5 rounded-2xl bg-white/95 dark:bg-[#1e172e]/90 backdrop-blur-2xl border border-slate-200 dark:border-white/25 shadow-2xl flex flex-col gap-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-[#383244] text-pink-600 dark:text-[#ffb0cd] text-[10px] uppercase tracking-wider font-bold">
                          {dest.region}
                        </span>
                        <span className="text-[#958ea0] text-xs">•</span>
                        <span className="text-[10px] text-purple-700 dark:text-[#d0bcff] uppercase tracking-wider font-bold">
                          {dest.tagline}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-pink-600 dark:text-[#ffb0cd]">
                        <Star size={15} fill="currentColor" />
                        <span className="text-xs font-bold text-slate-900 dark:text-white">{dest.rating}</span>
                      </div>
                    </div>

                    <div className="flex flex-col">
                      <h2 className="text-2xl md:text-3xl text-slate-900 dark:text-white font-bold tracking-tight">
                        {dest.name}
                      </h2>
                      <p className="text-xs md:text-sm text-slate-600 dark:text-[#cbc3d7] line-clamp-2 mt-0.5">
                        {dest.description}
                      </p>
                    </div>

                    {/* Bottom Control Bar */}
                    <div className="pt-1 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-1.5">
                        {dest.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-[#383244]/80 text-slate-700 dark:text-[#e9def7] text-[10px] uppercase tracking-wider font-semibold border border-slate-200 dark:border-white/10"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/attractions?destination=${encodeURIComponent(dest.planDestination)}`)
                          }}
                          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-[#383244]/90 dark:hover:bg-[#494454] text-slate-800 dark:text-[#e9def7] text-xs font-medium border border-slate-200 dark:border-white/20 transition-colors duration-200 cursor-pointer"
                          type="button"
                        >
                          <span>View Dossier</span>
                          <ArrowRight size={13} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate('/plan', { state: { destination: dest.planDestination } })
                          }}
                          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-purple-600 hover:bg-purple-700 text-white dark:bg-[#d0bcff] dark:hover:bg-white dark:text-[#3c0091] text-xs font-bold transition-all duration-200 shadow-md cursor-pointer"
                          type="button"
                        >
                          <span>Plan this trip</span>
                          <Sparkles size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="absolute bottom-0 left-0 right-0 p-5 flex flex-col gap-1 pointer-events-none">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-pink-600 dark:text-[#ffb0cd]">{dest.badge}</span>
                    <h3 className="text-xl font-semibold text-white leading-tight">{dest.shortName}</h3>
                    <p className="text-xs text-[#cbc3d7] line-clamp-1">{dest.description}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Carousel Nav Controls */}
        <div className="flex items-center gap-6 mt-6 z-30">
          <button
            onClick={handlePrev}
            aria-label="Previous destination"
            className="w-11 h-11 rounded-full flex items-center justify-center bg-white/80 dark:bg-[#231d2e]/80 backdrop-blur-xl border border-purple-200 dark:border-slate-200 dark:border-white/20 text-slate-800 dark:text-white hover:bg-purple-100 dark:hover:bg-[#2d2739] hover:scale-110 active:scale-95 transition-all shadow-lg cursor-pointer"
            type="button"
          >
            <ChevronLeft size={20} />
          </button>

          {/* Indicator Pips */}
          <div className="flex items-center gap-2">
            {FEATURED_DESTINATIONS.map((dest, i) => (
              <button
                key={dest.id}
                onClick={() => setActiveIdx(i)}
                aria-label={`Slide ${i + 1}`}
                className={`transition-all duration-300 rounded-full cursor-pointer border-none ${
                  i === activeIdx
                    ? 'w-8 h-2.5 bg-gradient-to-r from-[#a078ff] to-[#d0bcff] shadow-md'
                    : 'w-2.5 h-2.5 bg-purple-300/40 dark:bg-white/25 hover:bg-purple-400 dark:hover:bg-white/50'
                }`}
                type="button"
              />
            ))}
          </div>

          <button
            onClick={handleNext}
            aria-label="Next destination"
            className="w-11 h-11 rounded-full flex items-center justify-center bg-white/80 dark:bg-[#231d2e]/80 backdrop-blur-xl border border-purple-200 dark:border-slate-200 dark:border-white/20 text-slate-800 dark:text-white hover:bg-purple-100 dark:hover:bg-[#2d2739] hover:scale-110 active:scale-95 transition-all shadow-lg cursor-pointer"
            type="button"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </section>

      {/* Quick Agent Status Bar (Stitch Design Token) */}
      <section className="w-full max-w-5xl mx-auto mt-12 px-4">
        <div className="p-3 rounded-3xl md:rounded-full bg-white/80 dark:bg-[#1e192a]/80 backdrop-blur-2xl border border-purple-200 dark:border-white/15 shadow-xl flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 px-4 py-1.5">
            <div className="w-9 h-9 rounded-full bg-purple-100 dark:bg-[#2d2739] flex items-center justify-center text-purple-700 dark:text-[#d0bcff] shrink-0 border border-purple-200 dark:border-slate-200 dark:border-white/10">
              <Route size={18} />
            </div>
            <div className="flex flex-col">
              <span className="text-sm text-slate-900 dark:text-white font-bold leading-none">94,200+</span>
              <span className="text-[10px] text-slate-500 dark:text-[#cbc3d7] uppercase font-semibold mt-1">Trips Planned</span>
            </div>
          </div>

          <div className="hidden md:block w-1.5 h-1.5 rounded-full bg-purple-300 dark:bg-[#383244]" />

          <div className="flex items-center gap-3 px-4 py-1.5">
            <div className="w-9 h-9 rounded-full bg-purple-100 dark:bg-[#2d2739] flex items-center justify-center text-pink-600 dark:text-[#ffb0cd] shrink-0 border border-purple-200 dark:border-white/10">
              <Cpu size={18} />
            </div>
            <div className="flex flex-col">
              <span className="text-sm text-slate-900 dark:text-white font-bold leading-none">6 Autonomous</span>
              <span className="text-[10px] text-slate-500 dark:text-[#cbc3d7] uppercase font-semibold mt-1">Agent Clusters</span>
            </div>
          </div>

          <div className="hidden md:block w-1.5 h-1.5 rounded-full bg-purple-300 dark:bg-[#383244]" />

          <div className="flex items-center gap-3 px-4 py-1.5">
            <div className="w-9 h-9 rounded-full bg-purple-100 dark:bg-[#2d2739] flex items-center justify-center text-purple-600 dark:text-[#cebdff] shrink-0 border border-purple-200 dark:border-white/10">
              <Radio size={18} />
            </div>
            <div className="flex flex-col">
              <span className="text-sm text-slate-900 dark:text-white font-bold leading-none">Live Transit</span>
              <span className="text-[10px] text-slate-500 dark:text-[#cbc3d7] uppercase font-semibold mt-1">& Weather Sync</span>
            </div>
          </div>

          <div className="hidden md:block w-1.5 h-1.5 rounded-full bg-purple-300 dark:bg-[#383244]" />

          <div className="flex items-center gap-3 px-4 py-1.5">
            <div className="w-9 h-9 rounded-full bg-purple-100 dark:bg-[#2d2739] flex items-center justify-center text-purple-700 dark:text-[#d0bcff] shrink-0 border border-purple-200 dark:border-white/10">
              <ShieldCheck size={18} />
            </div>
            <div className="flex flex-col">
              <span className="text-sm text-slate-900 dark:text-white font-bold leading-none">0.0% Markups</span>
              <span className="text-[10px] text-slate-500 dark:text-[#cbc3d7] uppercase font-semibold mt-1">Direct Wholesale</span>
            </div>
          </div>
        </div>
      </section>

      {/* Real Trips / Journey Console */}
      <section className="w-full max-w-5xl mx-auto mt-12 px-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#a078ff] animate-pulse" />
            <h3 className="text-lg font-bold tracking-tight uppercase text-xs text-purple-700 dark:text-[#d0bcff]">
              Active Travel Dossier
            </h3>
          </div>
          {trips.length > 0 && (
            <Link to="/trips" className="text-xs text-purple-700 hover:text-purple-900 dark:text-[#d0bcff] dark:hover:text-white flex items-center gap-1 font-semibold">
              View all trips ({trips.length}) <ArrowRight size={12} />
            </Link>
          )}
        </div>

        {loading ? (
          <div className="p-8 rounded-2xl bg-white/80 dark:bg-[#1e192a]/70 backdrop-blur-xl border border-purple-200 dark:border-white/15 text-center text-slate-600 dark:text-[#cbc3d7]">
            <p className="text-sm">Retrieving your synthesized journeys…</p>
          </div>
        ) : current ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Main Current Journey Card */}
            <div className="lg:col-span-2 p-6 rounded-2xl bg-white/90 dark:bg-gradient-to-br dark:from-[#231d2e]/90 dark:to-[#1e192a]/90 backdrop-blur-xl border border-purple-200 dark:border-slate-200 dark:border-white/20 shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-3 mb-3">
                  <span className="px-3 py-1 rounded-full bg-purple-100 text-purple-800 dark:bg-[#a078ff]/20 dark:text-[#d0bcff] text-[11px] font-bold uppercase tracking-wider border border-purple-300 dark:border-[#a078ff]/30">
                    Latest Itinerary
                  </span>
                  {current.status && (
                    <span className="text-xs text-[#ec4899] dark:text-pink-600 dark:text-[#ffb0cd] font-semibold uppercase tracking-wider">
                      {current.status}
                    </span>
                  )}
                </div>
                <h4 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                  {current.destination} Escape
                </h4>
                <p className="text-xs text-slate-600 dark:text-[#cbc3d7] flex flex-wrap items-center gap-2 mb-4">
                  <span className="flex items-center gap-1">
                    <MapPin size={12} className="text-purple-600 dark:text-[#d0bcff]" />
                    {current.origin ? `${current.origin} → ` : ''}{current.destination}
                  </span>
                  {current.startDate && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Calendar size={12} className="text-pink-600 dark:text-pink-600 dark:text-[#ffb0cd]" />
                        {current.startDate} {current.endDate ? `→ ${current.endDate}` : ''}
                      </span>
                    </>
                  )}
                  {estimatedCost != null && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-1 font-semibold text-slate-900 dark:text-white">
                        <Wallet size={12} className="text-purple-600 dark:text-[#cebdff]" />
                        ₹{Number(estimatedCost).toLocaleString()}
                      </span>
                    </>
                  )}
                </p>
              </div>

              <div className="pt-4 border-t border-purple-100 dark:border-slate-200 dark:border-white/10 flex items-center justify-between">
                <span className="text-xs text-slate-500 dark:text-[#cbc3d7]">Ready to review or adjust schedule</span>
                <Link
                  to="/itinerary"
                  state={{ tripId: current.id }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#8b5cf6] hover:bg-[#7c3aed] text-white text-xs font-bold transition-all shadow-md cursor-pointer"
                >
                  <span>Open Itinerary</span>
                  <ArrowRight size={14} />
                </Link>
              </div>
            </div>

            {/* Quick Metrics Sidebar */}
            <div className="p-6 rounded-2xl bg-white/90 dark:bg-[#1e192a]/80 backdrop-blur-xl border border-purple-200 dark:border-white/15 flex flex-col justify-between gap-4 shadow-lg">
              <h5 className="text-xs uppercase font-bold text-purple-700 dark:text-[#d0bcff] tracking-wider">
                Synthesis Overview
              </h5>

              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-purple-50/70 dark:bg-[#231d2e]/80 border border-purple-100 dark:border-white/10">
                  <div className="w-8 h-8 rounded-lg bg-purple-200 dark:bg-[#383244] flex items-center justify-center text-purple-800 dark:text-[#d0bcff] shrink-0">
                    <Compass size={16} />
                  </div>
                  <div className="flex flex-col">
                    <strong className="text-sm text-slate-900 dark:text-white font-bold">{activityCount ?? 'Curated'} activities</strong>
                    <small className="text-[11px] text-slate-500 dark:text-[#cbc3d7]">Planned across your days</small>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-xl bg-purple-50/70 dark:bg-[#231d2e]/80 border border-purple-100 dark:border-white/10">
                  <div className="w-8 h-8 rounded-lg bg-pink-100 dark:bg-[#383244] flex items-center justify-center text-pink-600 dark:text-[#ffb0cd] shrink-0">
                    <Users size={16} />
                  </div>
                  <div className="flex flex-col">
                    <strong className="text-sm text-slate-900 dark:text-white font-bold">{plan?.travellers || 2} Travelers</strong>
                    <small className="text-[11px] text-slate-500 dark:text-[#cbc3d7]">Autonomous group sync</small>
                  </div>
                </div>
              </div>

              <button
                onClick={() => navigate('/plan')}
                className="w-full py-2.5 rounded-xl bg-purple-100 hover:bg-purple-200 dark:bg-[#383244] dark:hover:bg-[#494454] text-purple-900 dark:text-[#e9def7] text-xs font-semibold border border-purple-200 dark:border-white/15 transition-colors cursor-pointer"
              >
                + Plan Another Journey
              </button>
            </div>
          </div>
        ) : (
          <div className="p-8 rounded-2xl bg-white/90 dark:bg-[#1e192a]/70 backdrop-blur-xl border border-purple-200 dark:border-white/15 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl">
            <div className="text-left">
              <span className="text-[11px] uppercase tracking-wider text-purple-700 dark:text-[#d0bcff] font-bold">
                Initialize Your First Journey
              </span>
              <h4 className="text-xl font-bold text-slate-900 dark:text-white mt-1">No journeys synthesized yet</h4>
              <p className="text-xs text-slate-600 dark:text-[#cbc3d7] mt-1 max-w-md">
                Tell AtlasAI your preferred destination, budget, and travel mode to generate a bespoke, day-by-day autonomous itinerary.
              </p>
            </div>
            <button
              onClick={() => navigate('/plan')}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-[#a078ff] to-[#7c3aed] text-white text-xs font-bold shadow-lg hover:scale-105 transition-all shrink-0 cursor-pointer"
            >
              <Sparkles size={15} />
              <span>Launch Trip Planner</span>
              <ArrowRight size={14} />
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
