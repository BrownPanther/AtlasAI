import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Star, PlusCircle, CheckCircle2, MapPin, ArrowUpRight, ChevronLeft, ChevronRight, AlertTriangle, RefreshCw, Compass, ExternalLink, Sparkles } from 'lucide-react'
import { TextField } from '../components/FormField'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'

const DEFAULT_DESTINATION = 'Manali'

// Local photos exist for known landmarks; live places use the provider's own image first.
// Comprehensive Landmark Directory for known regional and international attractions
const sampleImages = {
  // Manali & Himachal
  'Solang Valley': '/images/solang-valley.jpg',
  'Hadimba Temple': '/images/hidimba-temple.jpg',
  'Hidimba Devi Temple': '/images/hidimba-temple.jpg',
  'Gatothkach Tree Temple': '/images/hidimba-temple.jpg',
  'Rohtang Pass': '/images/rohtang-pass.jpg',
  'Old Manali Cafes': '/images/old-manali.webp',
  'Jogini Waterfall Trek': '/images/jogini-waterfall.jpg',
  'Jogini Waterfall': '/images/jogini-waterfall.jpg',
  'Vashisht Hot Springs': 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&auto=format&fit=crop&q=80',
  'Mall Road Shopping': 'https://images.unsplash.com/photo-1533900298318-6b8da08a523e?w=800&auto=format&fit=crop&q=80',
  'Himalaya Nyinmapa Buddhist Monistary': 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=800&auto=format&fit=crop&q=80',
  'Gadhen Thekcho': 'https://images.unsplash.com/photo-1519817650390-64a93db51149?w=800&auto=format&fit=crop&q=80',
  'Durga Devi Temple': 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=800&auto=format&fit=crop&q=80',
  'Brahma Temple': 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=800&auto=format&fit=crop&q=80',
  'Nehru Park': 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=800&auto=format&fit=crop&q=80',
  'Museum of Himachal Culture & Folk Arts': 'https://images.unsplash.com/photo-1565034946487-077786996e27?w=800&auto=format&fit=crop&q=80',
  'silmog garden': 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=800&auto=format&fit=crop&q=80',

  // Goa
  'Baga Beach': 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=80',
  'Fort Aguada': 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=800&auto=format&fit=crop&q=80',
  'Anjuna Flea Market': 'https://images.unsplash.com/photo-1533900298318-6b8da08a523e?w=800&auto=format&fit=crop&q=80',
  'Palolem Beach': 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=800&auto=format&fit=crop&q=80',
  'Spice Plantation Tour': 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=800&auto=format&fit=crop&q=80',
  'Tito’s Lane Nightlife': 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800&auto=format&fit=crop&q=80',

  // Jaipur
  'Hawa Mahal': 'https://images.unsplash.com/photo-1603262110263-fb010d6e59d4?w=800&auto=format&fit=crop&q=80',
  'Amer Fort': 'https://images.unsplash.com/photo-1599661046289-e31897846e41?w=800&auto=format&fit=crop&q=80',
  'Amber Fort': 'https://images.unsplash.com/photo-1599661046289-e31897846e41?w=800&auto=format&fit=crop&q=80',
  'City Palace': 'https://images.unsplash.com/photo-1599661046289-e31897846e41?w=800&auto=format&fit=crop&q=80',
  'Johari Bazaar': 'https://images.unsplash.com/photo-1533900298318-6b8da08a523e?w=800&auto=format&fit=crop&q=80',
  'Nahargarh Fort': 'https://images.unsplash.com/photo-1603262110263-fb010d6e59d4?w=800&auto=format&fit=crop&q=80',
  'Chokhi Dhani Cultural Village': 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=800&auto=format&fit=crop&q=80',

  // Agra & Delhi & Mumbai
  'Taj Mahal': 'https://images.unsplash.com/photo-1564507592333-c60657eea523?w=800&auto=format&fit=crop&q=80',
  'India Gate': 'https://images.unsplash.com/photo-1587474260584-136574528ed5?w=800&auto=format&fit=crop&q=80',
  'Qutub Minar': 'https://images.unsplash.com/photo-1592635196078-9fe3d54f2377?w=800&auto=format&fit=crop&q=80',
  'Gateway of India': 'https://images.unsplash.com/photo-1570168007204-dfb528c6958f?w=800&auto=format&fit=crop&q=80',

  // Bhopal
  'Upper Lake': 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&auto=format&fit=crop&q=80',
  'Van Vihar': 'https://images.unsplash.com/photo-1534567153574-2b12153a87f0?w=800&auto=format&fit=crop&q=80',
}

// Multi-image curated category pools so places of the same category receive distinct images
const CATEGORY_IMAGE_POOLS = {
  waterfall: [
    '/images/jogini-waterfall.jpg',
    'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1546182990-dffeafbe841d?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1518457607834-6e8d80c183c5?w=800&auto=format&fit=crop&q=80',
  ],
  temple: [
    '/images/hidimba-temple.jpg',
    'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1519817650390-64a93db51149?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1561361513-2d000a50f0dc?w=800&auto=format&fit=crop&q=80',
  ],
  mountain: [
    '/images/rohtang-pass.jpg',
    '/images/solang-valley.jpg',
    'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&auto=format&fit=crop&q=80',
  ],
  beach: [
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800&auto=format&fit=crop&q=80',
  ],
  historic: [
    'https://images.unsplash.com/photo-1599661046289-e31897846e41?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1603262110263-fb010d6e59d4?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1564507592333-c60657eea523?w=800&auto=format&fit=crop&q=80',
  ],
  culture: [
    'https://images.unsplash.com/photo-1565034946487-077786996e27?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1519817650390-64a93db51149?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=800&auto=format&fit=crop&q=80',
  ],
  food: [
    '/images/old-manali.webp',
    'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&auto=format&fit=crop&q=80',
  ],
  shopping: [
    'https://images.unsplash.com/photo-1533900298318-6b8da08a523e?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&auto=format&fit=crop&q=80',
  ],
  lake: [
    'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1439853941329-a99ce0457e8a?w=800&auto=format&fit=crop&q=80',
  ],
  park: [
    'https://images.unsplash.com/photo-1448375240586-882707db888b?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1534567153574-2b12153a87f0?w=800&auto=format&fit=crop&q=80',
  ],
  adventure: [
    '/images/solang-valley.jpg',
    'https://images.unsplash.com/photo-1533240332313-0db49b459ad6?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=800&auto=format&fit=crop&q=80',
  ],
  default: [
    'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1503220317375-aaad61436b1b?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800&auto=format&fit=crop&q=80',
  ],
}

// Deterministic rotation helper: selects different images within a pool based on the place's name or ID
function hashPick(list, key) {
  if (!list || !list.length) return ''
  let hash = 0
  const s = String(key || '')
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0
  return list[hash % list.length]
}

function detectCategoryKey(place) {
  const text = `${place.name || ''} ${place.category || ''} ${place.kinds || ''} ${place.description || ''}`.toLowerCase()
  if (text.includes('waterfall') || text.includes('cascade') || text.includes('falls')) return 'waterfall'
  if (text.includes('temple') || text.includes('monastery') || text.includes('monistary') || text.includes('church') || text.includes('shrine') || text.includes('religion') || text.includes('thekcho') || text.includes('spiritual')) return 'temple'
  if (text.includes('beach') || text.includes('coast') || text.includes('cove') || text.includes('shore')) return 'beach'
  if (text.includes('fort') || text.includes('palace') || text.includes('monument') || text.includes('castle') || text.includes('heritage') || text.includes('historic')) return 'historic'
  if (text.includes('pass') || text.includes('valley') || text.includes('peak') || text.includes('mountain') || text.includes('trek') || text.includes('snow') || text.includes('altitude')) return 'mountain'
  if (text.includes('cafe') || text.includes('food') || text.includes('restaurant') || text.includes('bakery') || text.includes('dining')) return 'food'
  if (text.includes('market') || text.includes('bazaar') || text.includes('shop') || text.includes('mall') || text.includes('shopping')) return 'shopping'
  if (text.includes('lake') || text.includes('river') || text.includes('backwater') || text.includes('water') || text.includes('dam') || text.includes('spring')) return 'lake'
  if (text.includes('museum') || text.includes('art') || text.includes('gallery') || text.includes('exhibit')) return 'culture'
  if (text.includes('park') || text.includes('garden') || text.includes('forest') || text.includes('nature') || text.includes('wildlife')) return 'park'
  if (text.includes('adventure') || text.includes('sport') || text.includes('paragliding') || text.includes('rafting')) return 'adventure'
  return 'default'
}

// Dynamic SVG generator for places that genuinely have no photo (e.g. obscure landmarks)
// This ensures we never show a misleading photo of another location.
function generateSvgPlaceholder(seedText) {
  const text = String(seedText || '').trim();
  const initial = text ? text.charAt(0).toUpperCase() : '?';
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  
  const colors = [
    ['#f43f5e', '#ec4899'], // Rose to Pink
    ['#8b5cf6', '#6366f1'], // Violet to Indigo
    ['#0ea5e9', '#06b6d4'], // Sky to Cyan
    ['#10b981', '#22c55e'], // Emerald to Green
    ['#f59e0b', '#f97316'], // Amber to Orange
    ['#64748b', '#475569'], // Slate
  ];
  const [c1, c2] = colors[Math.abs(hash) % colors.length];
  
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
    <defs>
      <linearGradient id="g${hash}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${c1}" />
        <stop offset="100%" stop-color="${c2}" />
      </linearGradient>
    </defs>
    <rect width="800" height="600" fill="url(#g${hash})" />
    <text x="50%" y="50%" font-family="system-ui, sans-serif" font-size="200" font-weight="bold" fill="rgba(255,255,255,0.4)" text-anchor="middle" dominant-baseline="middle">
      ${initial}
    </text>
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

function getFallbackImage(place, destination, allowCategoryPool) {
  const seed = place.name || place.id || destination
  if (!allowCategoryPool) return generateSvgPlaceholder(seed)
  const cat = detectCategoryKey(place)
  const pool = CATEGORY_IMAGE_POOLS[cat] || CATEGORY_IMAGE_POOLS.default
  return hashPick(pool, seed)
}

function imageFor(place, destination) {
  const isLiveOrCached = place.dataSource === 'live' || place.dataSource === 'cached'

  // 1. Provider-supplied image — use it. These images belong to the actual
  //    attraction returned by the geocode+radius+detail pipeline, so they are
  //    always geographically correct.
  if (place.images && Array.isArray(place.images) && place.images.length > 0 && typeof place.images[0] === 'string' && place.images[0].startsWith('http')) {
    return place.images[0].trim()
  }
  if (place.image && typeof place.image === 'string' && place.image.trim()) {
    return place.image.trim()
  }

  // 2. Exact curated name match (only reliable when the name is known).
  if (place.name) {
    const trimmed = place.name.trim()
    if (sampleImages[trimmed]) return sampleImages[trimmed]
    const lower = trimmed.toLowerCase()
    const matchedKey = Object.keys(sampleImages).find((k) => {
      const kl = k.toLowerCase()
      return lower === kl || lower.includes(kl) || kl.includes(lower)
    })
    if (matchedKey) return sampleImages[matchedKey]
  }

  // 3a. Live / cached attractions with no provider image and no curated name:
  //     return a neutral placeholder. We must NOT use the category pool here
  //     because the category pool images are geographically associated with
  //     Himachal Pradesh / Rajasthan / etc. and would be misleading for
  //     attractions from a different region that happen to share a category
  //     label (e.g. a temple in Tamil Nadu should NOT show hidimba-temple.jpg).
  if (isLiveOrCached) return generateSvgPlaceholder(place.name || destination)

  // 3b. Sample-data attractions: use the category pool (acceptable because
  //     sample data is already region-generic and is labeled as "Sample").
  return getFallbackImage(place, destination, true)
}


const SAMPLE_NOTES = {
  not_configured: 'Live place data is not set up on this server, so these are sample places.',
  timeout: 'Live place data took too long to respond, so these are sample places.',
  rate_limited: 'Live place data is temporarily limited, so these are sample places.',
  default: 'Live place data is unavailable right now, so these are sample places.',
}

const EMPTY_NOTES = {
  no_results: 'We could not find places for this destination. Try another spelling or a nearby city.',
  destination_not_found: 'We could not find that destination. Try another spelling or a nearby city.',
  not_configured: 'Live place data is not set up on this server, and we have no sample places for this destination.',
  default: 'Place data is unavailable right now and we have no sample places for this destination.',
}

function SourceBadge({ data }) {
  if (data.dataSource === 'live') return <span className="atlas-pill is-live" title="Fetched from OpenTripMap just now">Live data · OpenTripMap</span>
  if (data.dataSource === 'cached') {
    return <span className="atlas-pill is-live" title="A saved copy of an earlier OpenTripMap response">Cached data · OpenTripMap{data.stale ? ' (may be out of date)' : ''}</span>
  }
  return <span className="atlas-pill is-sample" title="Bundled demo places, not from a live provider">Sample data</span>
}

function LoadingGrid() {
  return (
    <div className="atlas-3d-carousel-loading" role="status" aria-label="Loading places">
      {[0, 1, 2].map((i) => (
        <div className="atlas-attraction-skeleton" key={i}>
          <div className="art" />
          <div className="line" />
          <div className="line short" />
        </div>
      ))}
    </div>
  )
}

export default function Attractions() {
  const { isAuthenticated, loading: authLoading } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const initial = searchParams.get('destination')?.trim() || DEFAULT_DESTINATION
  const [input, setInput] = useState(initial)
  const [active, setActive] = useState(initial)
  const [attempt, setAttempt] = useState(0) // bumped by Retry / re-submitting the same destination
  const [result, setResult] = useState(null) // { key, data } | { key, errorKind }
  const [added, setAdded] = useState({})
  const [activeIdx, setActiveIdx] = useState(0)
  const carouselRef = useRef(null)
  const touchStartX = useRef(null)

  // Loading is derived: a request is "in flight" until a result exists for the current key.
  const requestKey = `${active}|${attempt}`
  const current = result?.key === requestKey ? result : null
  const status = !current ? 'loading' : current.errorKind ? 'error' : 'ready'
  const data = current?.data || null
  const errorKind = current?.errorKind || null
  const retry = () => setAttempt((n) => n + 1)

  useEffect(() => {
    if (authLoading || !isAuthenticated) return undefined
    let cancelled = false
    api.listAttractions(active)
      .then((res) => { if (!cancelled) setResult({ key: requestKey, data: res }) })
      .catch((err) => { if (!cancelled) setResult({ key: requestKey, errorKind: err?.status === 401 ? 'auth' : 'generic' }) })
    return () => { cancelled = true }
  }, [active, requestKey, authLoading, isAuthenticated])

  const submit = (e) => {
    e.preventDefault()
    const next = input.trim()
    if (!next) return
    setSearchParams({ destination: next }, { replace: true })
    setActiveIdx(0)
    if (next === active) retry()
    else setActive(next)
  }

  const [selectedLens, setSelectedLens] = useState('All Paradigms')

  const PRESET_DESTINATIONS = [
    { name: 'Manali', label: '🏔️ Manali', vibe: 'Alpine Haven' },
    { name: 'Goa', label: '🌴 Goa', vibe: 'Coastal Haven' },
    { name: 'Jaipur', label: '🏰 Jaipur', vibe: 'Royal Heritage' },
    { name: 'Kerala', label: '🚤 Kerala', vibe: 'Emerald Waterways' },
  ]

  const LENS_FILTERS = [
    'All Paradigms',
    'High Altitude',
    'Coastal Haven',
    'Architectural Splendor',
    'Gastronomy & Culture',
  ]

  const rawPlaces = data?.attractions || []
  const destinationName = data?.destination?.name || active

  const places = rawPlaces.filter((p) => {
    if (selectedLens === 'All Paradigms') return true
    const text = `${p.name || ''} ${p.category || ''} ${p.kinds || ''} ${p.description || ''}`.toLowerCase()
    if (selectedLens === 'High Altitude') return text.includes('mountain') || text.includes('hill') || text.includes('pass') || text.includes('snow') || text.includes('valley') || text.includes('trek')
    if (selectedLens === 'Coastal Haven') return text.includes('beach') || text.includes('coast') || text.includes('sea') || text.includes('water') || text.includes('lake') || text.includes('backwater')
    if (selectedLens === 'Architectural Splendor') return text.includes('fort') || text.includes('palace') || text.includes('temple') || text.includes('historic') || text.includes('heritage') || text.includes('monument')
    if (selectedLens === 'Gastronomy & Culture') return text.includes('food') || text.includes('cafe') || text.includes('culture') || text.includes('market') || text.includes('tea') || text.includes('bazaar')
    return true
  })

  const selectDestination = (destName) => {
    setInput(destName)
    setActive(destName)
    setSearchParams({ destination: destName }, { replace: true })
    setActiveIdx(0)
  }

  // Center active card in carousel view
  useEffect(() => {
    if (!carouselRef.current) return
    const activeEl = carouselRef.current.querySelector(`[data-place-index="${activeIdx}"]`)
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    }
  }, [activeIdx])

  const handlePrev = () => {
    if (activeIdx > 0) setActiveIdx(activeIdx - 1)
  }

  const handleNext = () => {
    if (activeIdx < places.length - 1) setActiveIdx(activeIdx + 1)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      handlePrev()
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      handleNext()
    }
  }

  const onTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX
  }

  const onTouchEnd = (e) => {
    if (touchStartX.current === null) return
    const diff = touchStartX.current - e.changedTouches[0].clientX
    if (Math.abs(diff) > 40) {
      if (diff > 0) handleNext()
      else handlePrev()
    }
    touchStartX.current = null
  }

  const activePlace = places[activeIdx] || places[0]

  return (
    <div className="atlas-explore-wrapper">
      {/* Stitch Autonomous Sensing Header */}
      <section className="atlas-explore-head">
        <div className="atlas-explore-head-main">
          <div className="atlas-live-pulse-badge" style={{ marginBottom: 12 }}>
            <span className="atlas-ping-dot" /> Autonomous Global Sensing
          </div>
          <h1 className="atlas-page-title" style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, letterSpacing: '-0.03em' }}>
            Explore the world.
          </h1>
          <p className="atlas-page-copy" style={{ maxWidth: 640 }}>
            Discover places AtlasAI thinks you'll love around <strong style={{ color: 'var(--accent)' }}>{destinationName}</strong> — autonomously curated with live microclimates, boutique stays, and seasonal clarity scores.
          </p>
        </div>

        {/* Quick AI Metric Strip */}
        <div className="atlas-explore-metrics-strip">
          <div className="atlas-metric-col">
            <span className="atlas-metric-label">Clarity Engine</span>
            <div className="atlas-metric-val">
              <span className="atlas-pulse-mini" />
              <strong>99.4% Latent Match</strong>
            </div>
          </div>
          <div className="atlas-metric-divider" />
          <div className="atlas-metric-col">
            <span className="atlas-metric-label">Active Sensors</span>
            <strong className="atlas-metric-val" style={{ color: 'var(--accent)' }}>14,208 Nodes</strong>
          </div>
          <div className="atlas-explore-head-action">
            <Link to="/plan" className="btn-ai-liquid" style={{ padding: '8px 16px', fontSize: 13 }}>
              <Sparkles size={14} className="text-accent" /> Plan with AI
            </Link>
          </div>
        </div>
      </section>

      {/* Preset Destinations Quick Switch */}
      <div className="atlas-preset-dest-row">
        <span className="atlas-preset-label">Curated Studios:</span>
        <div className="atlas-preset-pills">
          {PRESET_DESTINATIONS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              className={`atlas-preset-pill ${active.toLowerCase() === preset.name.toLowerCase() ? 'is-active' : ''}`}
              onClick={() => selectDestination(preset.name)}
            >
              <span>{preset.label}</span>
              <small className="atlas-preset-vibe">{preset.vibe}</small>
            </button>
          ))}
        </div>
      </div>

      {/* Search Input Bar */}
      <form className="atlas-explore-search" onSubmit={submit}>
        <TextField label="Custom Destination" value={input} onChange={setInput} placeholder="e.g. Manali, Jaipur, Goa, Kerala" />
        <button type="submit" className="atlas-ghost-button"><Compass size={15} /> Explore</button>
      </form>

      {/* Filter by Lens Bar */}
      <div className="atlas-lens-filter-bar">
        <span className="atlas-lens-label">Filter By Lens:</span>
        <div className="atlas-lens-pills">
          {LENS_FILTERS.map((lens) => (
            <button
              key={lens}
              type="button"
              className={`atlas-lens-btn ${selectedLens === lens ? 'is-active' : ''}`}
              onClick={() => { setSelectedLens(lens); setActiveIdx(0) }}
            >
              {lens}
            </button>
          ))}
        </div>
      </div>

      {!authLoading && !isAuthenticated ? (
        <div className="atlas-state-box">
          <b>Sign in to explore places</b>
          <p>Place search is available to signed-in travellers.</p>
          <Link to="/login" state={{ from: '/attractions' }} className="atlas-ghost-button">Sign in</Link>
        </div>
      ) : status === 'loading' ? (
        <LoadingGrid />
      ) : status === 'error' ? (
        <div className="atlas-state-box" role="alert">
          <div className="atlas-error-text"><AlertTriangle size={15} /> {errorKind === 'auth' ? 'Your session has expired. Please sign in again.' : 'We could not load places right now.'}</div>
          {errorKind === 'auth'
            ? <Link to="/login" state={{ from: '/attractions' }} className="atlas-ghost-button">Sign in</Link>
            : <button className="atlas-ghost-button" onClick={retry}><RefreshCw size={14} /> Try again</button>}
        </div>
      ) : places.length === 0 ? (
        <div className="atlas-state-box">
          <b>No places to show for "{active}"</b>
          <p>{EMPTY_NOTES[data.fallbackReason] || EMPTY_NOTES.default}</p>
          {data.fallbackReason !== 'no_results' && data.fallbackReason !== 'destination_not_found' && data.fallbackReason !== 'not_configured' && (
            <button className="atlas-ghost-button" onClick={retry}><RefreshCw size={14} /> Try again</button>
          )}
        </div>
      ) : (
        <>
          <div className="atlas-status-row">
            <SourceBadge data={data} />
            {data.dataSource === 'sample' && (
              <>
                <span className="atlas-status-note">{SAMPLE_NOTES[data.fallbackReason] || SAMPLE_NOTES.default}</span>
                {data.fallbackReason && data.fallbackReason !== 'not_configured' && (
                  <button className="atlas-ghost-button" style={{ padding: '7px 12px', fontSize: 11 }} onClick={retry}><RefreshCw size={12} /> Retry live data</button>
                )}
              </>
            )}
            {(data.dataSource === 'live' || data.dataSource === 'cached') && data.attribution && <span className="atlas-status-note">{data.attribution}</span>}
          </div>

          {/* ==================================================
              CENTERED 3D CARD CAROUSEL (Yojana Reference Pattern)
              ================================================== */}
          <div className="atlas-3d-carousel-section" onKeyDown={handleKeyDown}>
            {/* Header with place counter and liquid-glass arrow controls */}
            <div className="atlas-3d-carousel-header">
              <div className="atlas-3d-carousel-title-group">
                <span className="atlas-eyebrow">Featured Experience</span>
                <h3 className="atlas-3d-carousel-title">
                  {activePlace?.name || 'Explore Places'}
                </h3>
              </div>

              <div className="atlas-3d-carousel-nav-controls">
                <span className="atlas-3d-counter">
                  <strong>{activeIdx + 1}</strong> of {places.length} places
                </span>
                <div className="atlas-3d-carousel-buttons">
                  <button
                    type="button"
                    className="atlas-carousel-btn"
                    onClick={handlePrev}
                    disabled={activeIdx === 0}
                    aria-label="Previous place"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    type="button"
                    className="atlas-carousel-btn"
                    onClick={handleNext}
                    disabled={activeIdx >= places.length - 1}
                    aria-label="Next place"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Centered Perspective Track */}
            <div
              className="atlas-3d-carousel-viewport"
              ref={carouselRef}
              onTouchStart={onTouchStart}
              onTouchEnd={onTouchEnd}
              tabIndex={0}
              role="region"
              aria-label="Explore attractions carousel (use left/right arrows to navigate)"
            >
              <div className="atlas-3d-carousel-track">
                {places.map((place, i) => {
                  const isActive = i === activeIdx
                  const isPrev = i === activeIdx - 1
                  const isNext = i === activeIdx + 1
                  const isFarLeft = i < activeIdx - 1
                  const isFarRight = i > activeIdx + 1
                  const image = imageFor(place, destinationName)
                  const isSample = place.dataSource === 'sample'

                  return (
                    <article
                      key={place.id || i}
                      data-place-index={i}
                      onClick={() => setActiveIdx(i)}
                      className={`atlas-3d-card ${isActive ? 'is-active' : ''} ${isPrev ? 'is-prev' : ''} ${isNext ? 'is-next' : ''} ${isFarLeft ? 'is-far-left' : ''} ${isFarRight ? 'is-far-right' : ''}`}
                      role="button"
                      tabIndex={0}
                      aria-current={isActive ? 'true' : 'false'}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveIdx(i) } }}
                    >
                      {/* Luminous Top Glow on Active Center Card */}
                      {isActive && <div className="atlas-3d-card-glow-bar" />}

                      {/* Header with Category and Location Badges */}
                      <div className="atlas-3d-card-badges">
                        <span className="atlas-3d-badge-category">{place.category || 'Sightseeing'}</span>
                        <span className="atlas-3d-badge-location"><MapPin size={11} /> {place.area || destinationName}</span>
                      </div>

                      {/* High-res Image Art with Gradient Vignette */}
                      <div className="atlas-3d-card-art">
                        <img
                          src={image}
                          alt={place.name}
                          className="atlas-3d-card-img"
                          loading="lazy"
                          onError={(e) => {
                            const fallback = (place.dataSource === 'live' || place.dataSource === 'cached')
                              ? generateSvgPlaceholder(place.name || destinationName)
                              : getFallbackImage(place, destinationName, true)
                            if (e.target.src !== fallback) e.target.src = fallback
                          }}
                        />
                        {place.rating ? (
                          <span className="atlas-3d-rating-pill">
                            <Star size={12} fill="currentColor" /> {place.rating}/3
                          </span>
                        ) : null}
                      </div>

                      {/* Content Body */}
                      <div className="atlas-3d-card-body">
                        <div className="atlas-3d-card-top">
                          <h4 className="atlas-3d-card-title">{place.name}</h4>
                          <span className="atlas-3d-card-cost">
                            {isSample ? (place.estimatedCost === 0 ? 'Free entry' : `Approx. ₹${place.estimatedCost}`) : 'Price on arrival'}
                          </span>
                        </div>

                        {place.description ? (
                          <p className="atlas-3d-card-desc">{place.description}</p>
                        ) : (
                          <p className="atlas-3d-card-desc atlas-muted">A top-rated point of interest in {destinationName}, curated by AtlasAI.</p>
                        )}

                        {/* Feature Tags / Pills */}
                        <div className="atlas-3d-card-tags">
                          <span className="atlas-3d-tag">#{destinationName}</span>
                          <span className="atlas-3d-tag">#TopDetour</span>
                          {place.category && <span className="atlas-3d-tag">#{place.category.replace(/\s+/g, '')}</span>}
                        </div>
                      </div>

                      {/* Card Action Footer */}
                      <div className="atlas-3d-card-footer">
                        <button
                          type="button"
                          className={`atlas-3d-add-btn ${added[place.id] ? 'is-added' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            setAdded((s) => ({ ...s, [place.id]: true }))
                          }}
                        >
                          {added[place.id] ? (
                            <>
                              <CheckCircle2 size={15} /> Added to plan
                            </>
                          ) : (
                            <>
                              <PlusCircle size={15} /> Add to itinerary <ArrowUpRight size={14} />
                            </>
                          )}
                        </button>

                        {(place.wikipediaUrl || place.website) && (
                          <div className="atlas-3d-card-links" onClick={(e) => e.stopPropagation()}>
                            {place.wikipediaUrl && (
                              <a
                                href={place.wikipediaUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="atlas-3d-icon-link"
                                title="Wikipedia"
                                aria-label="Wikipedia"
                              >
                                <ExternalLink size={13} />
                              </a>
                            )}
                            {place.website && (
                              <a
                                href={place.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="atlas-3d-icon-link"
                                title="Official Website"
                                aria-label="Official Website"
                              >
                                <Compass size={13} />
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    </article>
                  )
                })}
              </div>
            </div>

            {/* Quick Jump Dot Indicator */}
            <div className="atlas-3d-carousel-indicators" role="tablist" aria-label="Jump to attraction">
              {places.map((place, i) => (
                <button
                  key={place.id || i}
                  type="button"
                  className={`atlas-3d-dot ${i === activeIdx ? 'is-active' : ''}`}
                  onClick={() => setActiveIdx(i)}
                  aria-label={`Jump to ${place.name}`}
                  aria-selected={i === activeIdx}
                >
                  <span />
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
