// Canonical AtlasAI attraction shape. A superset of the sample-data shape
// ({ id, name, area, category, estimatedCost, durationHours, bestTimeOfDay,
// notes, dataSource }) so ActivityAgent / attractionTool keep working with
// either source.
//
// {
//   id, providerId, name, area, category, kinds: string[],
//   estimatedCost: number | null, costKnown: boolean,
//   durationHours: number | null, durationEstimated: boolean,
//   bestTimeOfDay: string | null, notes: string | null,
//   dataSource: 'live' | 'cached' | 'sample', provider, cached,
//   description, coordinates: { lat, lng } | null,
//   rating: number | null, ratingScale: string | null, reviewCount: null,
//   images: string[], address, openingHours: null,
//   wikidataId, wikipediaUrl, website, providerUrl,
// }
//
// Rule: a field the provider does not supply stays null/empty — nothing is
// invented. OpenTripMap supplies no prices, opening hours, review counts or
// visit durations, so those are always null for live records.

const OTM_KIND_TO_CATEGORY = {
  natural: 'nature', foods: 'food', cultural: 'culture', historic: 'history',
  religion: 'culture', architecture: 'culture', amusements: 'leisure',
  sport: 'adventure', shops: 'shopping', accomodations: 'leisure', // sic — OpenTripMap's own spelling
}

const MAX_DESCRIPTION_CHARS = 500

function guessCategory(kinds = []) {
  const first = kinds.find((k) => OTM_KIND_TO_CATEGORY[k])
  return first ? OTM_KIND_TO_CATEGORY[first] : 'leisure'
}

function parseKinds(kinds) {
  return typeof kinds === 'string' ? kinds.split(',').map((k) => k.trim()).filter(Boolean) : []
}

/**
 * OpenTripMap "rate" is a popularity score: 1-3, optionally suffixed "h" for
 * heritage sites; 0 means unrated. Detail responses return it as a string
 * ("3h"), list responses as a number. Anything outside 1-3 is treated as
 * "no score".
 */
export function parseOpenTripMapRate(rate) {
  if (rate === null || rate === undefined) return null
  const n = parseInt(String(rate), 10)
  return Number.isInteger(n) && n >= 1 && n <= 3 ? n : null
}

function clip(text, max) {
  if (typeof text !== 'string') return ''
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return `${cut.slice(0, lastSpace > max * 0.6 ? lastSpace : max).trimEnd()}…`
}

function pickArea(address = {}) {
  return address.suburb || address.neighbourhood || address.city_district || address.city || address.town || address.village || address.county || ''
}

function buildAddress(address) {
  if (!address || typeof address !== 'object') return ''
  const order = ['house_number', 'road', 'neighbourhood', 'suburb', 'city_district', 'city', 'town', 'village', 'county', 'state', 'postcode', 'country']
  return order.map((k) => address[k]).filter((v) => typeof v === 'string' && v).join(', ')
}

function safeUrl(value) {
  if (typeof value !== 'string') return null
  try {
    const u = new URL(value)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null
  } catch {
    return null
  }
}

function baseLive({ xid, name, kinds, cached }) {
  const kindList = parseKinds(kinds)
  return {
    id: xid,
    providerId: xid,
    name,
    category: guessCategory(kindList),
    kinds: kindList,
    estimatedCost: null, // OpenTripMap provides no prices
    costKnown: false,
    durationHours: null, // OpenTripMap provides no visit durations
    durationEstimated: false,
    bestTimeOfDay: null,
    notes: null,
    dataSource: 'live',
    provider: 'opentripmap',
    cached,
    reviewCount: null, // not provided by OpenTripMap
    openingHours: null, // not reliably provided by OpenTripMap
  }
}

/**
 * Maps a single OpenTripMap "xid" detail response to the canonical shape.
 * `listItem` (optional) is the matching /radius entry; it only fills gaps
 * (e.g. the numeric rate) and never overrides the detail response.
 */
export function normalizeOpenTripMapAttraction(raw, { cached = false, listItem = null } = {}) {
  if (!raw || typeof raw !== 'object') return null
  const xid = raw.xid || listItem?.xid
  const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : (typeof listItem?.name === 'string' ? listItem.name.trim() : '')
  if (!xid || !name) return null

  const point = raw.point || listItem?.point
  const rating = parseOpenTripMapRate(raw.rate ?? listItem?.rate)
  const description = clip(raw.wikipedia_extracts?.text || raw.info?.descr || '', MAX_DESCRIPTION_CHARS)

  return {
    ...baseLive({ xid, name, kinds: raw.kinds || listItem?.kinds, cached }),
    area: pickArea(raw.address),
    description,
    coordinates: point && Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lon)) ? { lat: Number(point.lat), lng: Number(point.lon) } : null,
    rating,
    ratingScale: rating === null ? null : 'opentripmap-popularity-1-3',
    images: safeUrl(raw.preview?.source) ? [safeUrl(raw.preview.source)] : [],
    address: buildAddress(raw.address),
    wikidataId: raw.wikidata || listItem?.wikidata || null,
    wikipediaUrl: safeUrl(raw.wikipedia),
    website: safeUrl(raw.url),
    providerUrl: safeUrl(raw.otm),
  }
}

/** Maps a lightweight /radius list entry (no detail call) to the canonical shape. */
export function normalizeOpenTripMapListItem(item, { cached = false } = {}) {
  if (!item || typeof item !== 'object') return null
  const name = typeof item.name === 'string' ? item.name.trim() : ''
  if (!item.xid || !name) return null
  const rating = parseOpenTripMapRate(item.rate)
  const p = item.point
  return {
    ...baseLive({ xid: item.xid, name, kinds: item.kinds, cached }),
    area: '',
    description: '',
    coordinates: p && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lon)) ? { lat: Number(p.lat), lng: Number(p.lon) } : null,
    rating,
    ratingScale: rating === null ? null : 'opentripmap-popularity-1-3',
    images: [],
    address: '',
    wikidataId: item.wikidata || null,
    wikipediaUrl: null,
    website: null,
    providerUrl: null,
  }
}

/** Maps a /geoname response (already validated by the provider) to a destination record. */
export function normalizeOpenTripMapDestination(geo, { cached = false } = {}) {
  if (!geo) return null
  return {
    name: geo.name,
    country: geo.country || null,
    timezone: geo.timezone || null,
    population: geo.population ?? null,
    coordinates: { lat: geo.lat, lng: geo.lon },
    dataSource: 'live',
    provider: 'opentripmap',
    cached,
  }
}

/** Wraps an existing sample-data attraction so its shape always matches the canonical one. */
export function normalizeSampleAttraction(raw) {
  return {
    ...raw,
    providerId: null,
    kinds: [],
    costKnown: true, // sample prices are demo estimates, labeled by dataSource: 'sample'
    durationEstimated: false,
    notes: raw.notes || null,
    dataSource: 'sample',
    provider: 'sample',
    cached: false,
    description: raw.notes || '',
    coordinates: null,
    rating: null,
    ratingScale: null,
    reviewCount: null,
    images: [],
    address: raw.area || '',
    openingHours: null,
    wikidataId: null,
    wikipediaUrl: null,
    website: null,
    providerUrl: null,
  }
}
