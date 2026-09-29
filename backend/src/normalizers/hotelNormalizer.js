// Canonical AtlasAI hotel shape — superset of the existing sample shape
// ({ id, name, area, pricePerNight, rating, amenities, dataSource }).
//
// {
//   id, name, area, pricePerNight, rating, amenities, dataSource, provider, cached,
//   currency, address, coordinates: { lat, lng } | null, images: string[],
//   liveAvailability, bookingUrl,
// }

/** Maps one Amadeus hotel-offers-search result to the canonical shape. */
export function normalizeAmadeusHotel(raw, { cached = false } = {}) {
  if (!raw?.hotel) return null
  const offer = raw.offers?.[0]
  return {
    id: raw.hotel.hotelId,
    name: raw.hotel.name || 'Unnamed hotel',
    area: raw.hotel.address?.cityName || '',
    pricePerNight: offer?.price?.total ? Number(offer.price.total) : null,
    rating: raw.hotel.rating ? Number(raw.hotel.rating) : null,
    amenities: (raw.hotel.amenities || []).map((a) => a.toLowerCase().replace(/_/g, ' ')),
    // Amadeus's *test* environment (see amadeusProvider.js) returns
    // synthetic offers, not bookable inventory — never claim liveAvailability.
    dataSource: 'live',
    sourceType: 'live',
    provider: 'amadeus',
    cached,
    currency: offer?.price?.currency || 'INR',
    address: [raw.hotel.address?.lines, raw.hotel.address?.cityName].flat().filter(Boolean).join(', '),
    coordinates: raw.hotel.latitude != null ? { lat: raw.hotel.latitude, lng: raw.hotel.longitude } : null,
    images: [],
    liveAvailability: false,
    bookingUrl: null,
  }
}

/** Maps one Amadeus city reference-data result to { iataCode, name }, or null if unusable. */
export function normalizeAmadeusCity(raw) {
  if (!raw?.iataCode) return null
  return { iataCode: raw.iataCode, name: raw.name || raw.address?.cityName || raw.iataCode }
}

/** Maps an estimated reference hotel to the canonical AtlasAI shape. */
export function normalizeEstimatedHotel(raw, { cached = false } = {}) {
  if (!raw) return null
  return {
    id: raw.id,
    name: raw.name || 'Unnamed reference property',
    area: raw.area || '',
    pricePerNight: raw.pricePerNight != null ? Number(raw.pricePerNight) : null,
    priceRange: raw.priceRange || null,
    rating: raw.rating != null ? Number(raw.rating) : null,
    amenities: raw.amenities || [],
    dataSource: raw.dataSource || 'estimated',
    sourceType: 'estimated',
    costState: 'estimated',
    provider: raw.provider || 'AtlasTravelProvider',
    cached,
    currency: raw.currency || 'INR',
    address: raw.address || raw.area || '',
    coordinates: raw.coordinates || null,
    images: raw.images || [],
    liveAvailability: false,
    availability: 'not_verified',
    bookingStatus: 'not_booked',
    bookingUrl: null,
    label: 'Reference estimate',
    actionLabel: 'Check live availability',
  }
}

/** Wraps an existing sample-data hotel so its shape always matches the canonical one. */
export function normalizeSampleHotel(raw) {
  return {
    ...raw,
    dataSource: raw.dataSource || 'sample',
    sourceType: raw.sourceType || (raw.dataSource === 'sample' ? 'demo' : raw.dataSource || 'sample'),
    costState: raw.costState || (raw.dataSource === 'sample' ? 'estimated' : raw.dataSource),
    provider: 'sample',
    cached: false,
    currency: 'INR',
    address: raw.area || '',
    coordinates: null,
    images: [],
    liveAvailability: false,
    bookingUrl: null,
  }
}
