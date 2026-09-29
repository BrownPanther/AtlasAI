export const SOURCE_LABEL = {
  live: 'Live',
  cached: 'Cached',
  estimated: 'Planning estimate',
  sample: 'Sample data',
}

// Maps a normalized backend flight (see flightNormalizer.js) into the
// list-row shape used by the Reservations page and BookingContext.
export function toFlightListItem(f) {
  const isEstimated = f.sourceType === 'estimated' || f.dataSource === 'estimated'
  const priceDisplay = f.priceRange?.formatted || (f.price != null ? `₹${f.price.toLocaleString()}` : 'Price on request')
  const durationDisplay = f.durationText || (f.departure && f.arrival ? `${f.departure} → ${f.arrival}` : 'Approx. 2h 10m')

  return {
    id: f.id,
    provider: f.airline || f.provider,
    route: `${f.from || '—'} → ${f.to || '—'}`,
    time: durationDisplay,
    price: f.price ?? 0,
    priceFormatted: priceDisplay,
    status: isEstimated ? '≈ Planning estimate' : f.dataSource === 'sample' ? 'Sample' : 'Available',
    statusDetail: isEstimated ? (f.statusDetail || 'Live availability unavailable') : null,
    dataSource: f.dataSource,
    sourceType: f.sourceType,
    priceKnown: f.price != null || !!f.priceRange,
    isEstimate: isEstimated,
    actionText: isEstimated ? 'Search live availability' : null,
    searchUrl: isEstimated
      ? `https://www.google.com/travel/flights?q=flights+from+${encodeURIComponent(f.from || '')}+to+${encodeURIComponent(f.to || '')}`
      : null,
  }
}

// Maps a normalized backend hotel (see hotelNormalizer.js) into the
// list-row shape used by the Reservations page and BookingContext.
export function toListItem(h) {
  const isEstimated = h.sourceType === 'estimated' || h.dataSource === 'estimated'
  const priceDisplay = h.priceRange?.formatted
    ? `${h.priceRange.formatted} / night`
    : h.pricePerNight != null
      ? `₹${h.pricePerNight.toLocaleString()} / night`
      : 'Price not listed'

  return {
    id: h.id,
    provider: h.name,
    route: h.area || '—',
    time: h.tier ? `${h.tier.charAt(0).toUpperCase() + h.tier.slice(1)} tier` : (h.rating ? `${h.rating}★` : 'Standard'),
    price: h.pricePerNight ?? 0,
    priceFormatted: priceDisplay,
    status: isEstimated ? '≈ Reference estimate' : h.dataSource === 'sample' ? 'Sample' : 'Available',
    statusDetail: isEstimated ? (h.statusDetail || 'Estimated stay cost') : null,
    dataSource: h.dataSource,
    sourceType: h.sourceType,
    priceKnown: h.pricePerNight != null || !!h.priceRange,
    isEstimate: isEstimated,
    actionText: isEstimated ? 'Check live availability' : null,
    searchUrl: isEstimated
      ? `https://www.google.com/travel/hotels?q=${encodeURIComponent(h.name + ' ' + (h.area || ''))}`
      : null,
  }
}
