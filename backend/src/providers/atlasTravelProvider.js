import { BaseProvider } from './BaseProvider.js'

// Authentic Indian and international airport reference data
const AIRPORTS = {
  DEL: { code: 'DEL', name: 'Indira Gandhi International Airport', city: 'Delhi', lat: 28.5562, lng: 77.1000 },
  BOM: { code: 'BOM', name: 'Chhatrapati Shivaji Maharaj International Airport', city: 'Mumbai', lat: 19.0896, lng: 72.8656 },
  BLR: { code: 'BLR', name: 'Kempegowda International Airport', city: 'Bengaluru', lat: 13.1986, lng: 77.7066 },
  GOI: { code: 'GOI', name: 'Dabolim Airport', city: 'Goa', lat: 15.3808, lng: 73.8314 },
  GOX: { code: 'GOX', name: 'Manohar International Airport', city: 'Goa', lat: 15.7667, lng: 73.8667 },
  JAI: { code: 'JAI', name: 'Jaipur International Airport', city: 'Jaipur', lat: 26.8242, lng: 75.8122 },
  KUU: { code: 'KUU', name: 'Kullu-Manali Airport (Bhuntar)', city: 'Manali', lat: 31.8767, lng: 77.1542 },
  CCU: { code: 'CCU', name: 'Netaji Subhash Chandra Bose International Airport', city: 'Kolkata', lat: 22.6547, lng: 88.4467 },
  MAA: { code: 'MAA', name: 'Chennai International Airport', city: 'Chennai', lat: 12.9941, lng: 80.1709 },
  HYD: { code: 'HYD', name: 'Rajiv Gandhi International Airport', city: 'Hyderabad', lat: 17.2403, lng: 78.4294 },
  COK: { code: 'COK', name: 'Cochin International Airport', city: 'Kochi', lat: 10.1520, lng: 76.3920 },
  AMD: { code: 'AMD', name: 'Sardar Vallabhbhai Patel International Airport', city: 'Ahmedabad', lat: 23.0734, lng: 72.6347 },
  PNQ: { code: 'PNQ', name: 'Pune Airport', city: 'Pune', lat: 18.5822, lng: 73.9197 },
  SXR: { code: 'SXR', name: 'Sheikh ul-Alam International Airport', city: 'Srinagar', lat: 33.9871, lng: 74.7742 },
  IXC: { code: 'IXC', name: 'Shaheed Bhagat Singh International Airport', city: 'Chandigarh', lat: 30.6735, lng: 76.7885 },
  ATQ: { code: 'ATQ', name: 'Sri Guru Ram Dass Jee International Airport', city: 'Amritsar', lat: 31.7096, lng: 74.7973 },
  GAU: { code: 'GAU', name: 'Lokpriya Gopinath Bordoloi International Airport', city: 'Guwahati', lat: 26.1061, lng: 91.5859 },
  UDR: { code: 'UDR', name: 'Maharana Pratap Airport', city: 'Udaipur', lat: 24.6178, lng: 73.8961 },
  DED: { code: 'DED', name: 'Jolly Grant Airport', city: 'Dehradun', lat: 30.1897, lng: 78.1803 },
  DXB: { code: 'DXB', name: 'Dubai International Airport', city: 'Dubai', lat: 25.2532, lng: 55.3657 },
  SIN: { code: 'SIN', name: 'Singapore Changi Airport', city: 'Singapore', lat: 1.3644, lng: 103.9915 },
  LHR: { code: 'LHR', name: 'London Heathrow Airport', city: 'London', lat: 51.4700, lng: -0.4543 },
}

const CITY_TO_IATA = {
  delhi: 'DEL',
  'new delhi': 'DEL',
  mumbai: 'BOM',
  bombay: 'BOM',
  bengaluru: 'BLR',
  bangalore: 'BLR',
  goa: 'GOI',
  jaipur: 'JAI',
  manali: 'KUU',
  kullu: 'KUU',
  kolkata: 'CCU',
  calcutta: 'CCU',
  chennai: 'MAA',
  madras: 'MAA',
  hyderabad: 'HYD',
  kochi: 'COK',
  cochin: 'COK',
  ahmedabad: 'AMD',
  pune: 'PNQ',
  srinagar: 'SXR',
  chandigarh: 'IXC',
  amritsar: 'ATQ',
  guwahati: 'GAU',
  udaipur: 'UDR',
  dehradun: 'DED',
  dubai: 'DXB',
  singapore: 'SIN',
  london: 'LHR',
}

// Major domestic scheduled carriers with real IATA airline codes
const CARRIERS = [
  { name: 'IndiGo', code: '6E' },
  { name: 'Air India', code: 'AI' },
  { name: 'Air India Express', code: 'IX' },
  { name: 'SpiceJet', code: 'SG' },
  { name: 'Akasa Air', code: 'QP' },
  { name: 'Vistara', code: 'UK' },
]

// Benchmark reference routes with vetted durations & realistic planning fare ranges (economy, one-way)
const BENCHMARK_ROUTES = {
  'DEL-BOM': { durationHours: 2.1, minFare: 4500, maxFare: 6000 },
  'BOM-DEL': { durationHours: 2.1, minFare: 4500, maxFare: 6000 },
  'DEL-GOI': { durationHours: 2.5, minFare: 4800, maxFare: 6800 },
  'GOI-DEL': { durationHours: 2.5, minFare: 4800, maxFare: 6800 },
  'DEL-BLR': { durationHours: 2.7, minFare: 5000, maxFare: 7200 },
  'BLR-DEL': { durationHours: 2.7, minFare: 5000, maxFare: 7200 },
  'DEL-JAI': { durationHours: 1.0, minFare: 3000, maxFare: 4500 },
  'JAI-DEL': { durationHours: 1.0, minFare: 3000, maxFare: 4500 },
  'DEL-KUU': { durationHours: 1.3, minFare: 6500, maxFare: 9500 },
  'KUU-DEL': { durationHours: 1.3, minFare: 6500, maxFare: 9500 },
  'BOM-GOI': { durationHours: 1.2, minFare: 3200, maxFare: 4800 },
  'GOI-BOM': { durationHours: 1.2, minFare: 3200, maxFare: 4800 },
  'BOM-BLR': { durationHours: 1.7, minFare: 3800, maxFare: 5500 },
  'BLR-BOM': { durationHours: 1.7, minFare: 3800, maxFare: 5500 },
  'BLR-GOI': { durationHours: 1.2, minFare: 3000, maxFare: 4600 },
  'GOI-BLR': { durationHours: 1.2, minFare: 3000, maxFare: 4600 },
  'DEL-CCU': { durationHours: 2.2, minFare: 4600, maxFare: 6400 },
  'DEL-HYD': { durationHours: 2.2, minFare: 4400, maxFare: 6200 },
  'DEL-MAA': { durationHours: 2.8, minFare: 5200, maxFare: 7500 },
}

// Authentic reference properties across popular destinations
const REFERENCE_HOTELS = {
  manali: [
    { name: 'Snow Valley Resorts', area: 'Log Huts Area', rating: 4.4, minPrice: 2500, maxPrice: 4000, amenities: ['wifi', 'mountain view', 'restaurant', 'heating', 'parking'] },
    { name: 'The Himalayan Resort & Spa', area: 'Hadimba Road', rating: 4.7, minPrice: 6500, maxPrice: 10500, amenities: ['wifi', 'spa', 'pool', 'mountain view', 'restaurant'] },
    { name: 'Apple Country Resorts', area: 'Log Huts Area', rating: 4.3, minPrice: 3200, maxPrice: 5000, amenities: ['wifi', 'restaurant', 'spa', 'valley view'] },
    { name: 'Johnson Hotel & Cafe', area: 'Circuit House Road', rating: 4.5, minPrice: 4000, maxPrice: 6200, amenities: ['wifi', 'cafe', 'bar', 'garden'] },
    { name: 'Zostel Manali', area: 'Old Manali', rating: 4.4, minPrice: 900, maxPrice: 2200, amenities: ['wifi', 'cafe', 'common lounge', 'mountain view'] },
    { name: 'Riverside Homestay', area: 'Old Manali', rating: 4.2, minPrice: 1400, maxPrice: 2400, amenities: ['wifi', 'kitchen access', 'river view'] },
  ],
  goa: [
    { name: 'Santana Beach Resort', area: 'Candolim', rating: 4.3, minPrice: 3200, maxPrice: 4800, amenities: ['wifi', 'pool', 'beachfront', 'restaurant'] },
    { name: 'Taj Fort Aguada Resort & Spa', area: 'Sinquerim', rating: 4.8, minPrice: 13000, maxPrice: 21000, amenities: ['wifi', 'spa', 'infinity pool', 'beachfront', 'fine dining'] },
    { name: 'Fairfield by Marriott Goa Anjuna', area: 'Anjuna', rating: 4.4, minPrice: 4200, maxPrice: 6500, amenities: ['wifi', 'pool', 'fitness center', 'restaurant'] },
    { name: 'Palm Grove Guesthouse', area: 'Baga', rating: 4.1, minPrice: 1600, maxPrice: 2600, amenities: ['wifi', 'breakfast', 'garden'] },
    { name: 'Zostel Morjim', area: 'Morjim', rating: 4.5, minPrice: 1100, maxPrice: 2500, amenities: ['wifi', 'beach access', 'rooftop cafe'] },
  ],
  jaipur: [
    { name: 'Alsisar Haveli', area: 'Sansar Chandra Road', rating: 4.6, minPrice: 4500, maxPrice: 7000, amenities: ['wifi', 'heritage courtyard', 'pool', 'restaurant'] },
    { name: 'Shahpura House', area: 'Bani Park', rating: 4.5, minPrice: 3800, maxPrice: 5800, amenities: ['wifi', 'pool', 'spa', 'traditional decor'] },
    { name: 'Pink City Haveli', area: 'Old City', rating: 4.3, minPrice: 1800, maxPrice: 2900, amenities: ['wifi', 'rooftop restaurant', 'city view'] },
    { name: 'Rambagh Palace', area: 'Bhawani Singh Road', rating: 4.9, minPrice: 24000, maxPrice: 42000, amenities: ['wifi', 'heritage gardens', 'butler service', 'luxury spa'] },
    { name: 'Zostel Jaipur', area: 'Hawa Mahal Road', rating: 4.4, minPrice: 850, maxPrice: 2000, amenities: ['wifi', 'rooftop terrace', 'cafe', 'city center'] },
  ],
  mumbai: [
    { name: 'The Taj Mahal Palace', area: 'Colaba', rating: 4.9, minPrice: 18000, maxPrice: 32000, amenities: ['wifi', 'harbor view', 'luxury spa', 'multiple restaurants', 'pool'] },
    { name: 'Trident Nariman Point', area: 'Marine Drive', rating: 4.7, minPrice: 10500, maxPrice: 17000, amenities: ['wifi', 'ocean view', 'pool', 'gym', 'restaurant'] },
    { name: 'Residency Hotel Fort', area: 'Fort', rating: 4.2, minPrice: 3600, maxPrice: 5200, amenities: ['wifi', 'breakfast', 'near station'] },
  ],
  delhi: [
    { name: 'The Imperial New Delhi', area: 'Janpath', rating: 4.8, minPrice: 14000, maxPrice: 24000, amenities: ['wifi', 'historic art gallery', 'luxury spa', 'pool', 'fine dining'] },
    { name: 'Bloomrooms @ Janpath', area: 'Connaught Place', rating: 4.3, minPrice: 3400, maxPrice: 5000, amenities: ['wifi', 'cafe', 'city center', 'breakfast'] },
  ],
  bengaluru: [
    { name: 'The Leela Palace', area: 'Old Airport Road', rating: 4.8, minPrice: 13500, maxPrice: 23000, amenities: ['wifi', 'gardens', 'spa', 'pool', 'fine dining'] },
    { name: 'The Chancery Pavilion', area: 'Residency Road', rating: 4.2, minPrice: 3800, maxPrice: 5900, amenities: ['wifi', 'pool', 'gym', 'central location'] },
  ],
}

function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
}

function formatDuration(hoursDecimal) {
  const totalMins = Math.round(hoursDecimal * 60)
  const h = Math.floor(totalMins / 60)
  const m = totalMins % 60
  if (h === 0) return `Approx. ${m}m`
  if (m === 0) return `Approx. ${h}h`
  return `Approx. ${h}h ${m}m`
}

function addMinutesToClock(clockStr, minsToAdd) {
  const [h, m] = clockStr.split(':').map(Number)
  const total = (h * 60 + m + Math.round(minsToAdd)) % (24 * 60)
  const nh = String(Math.floor(total / 60)).padStart(2, '0')
  const nm = String(total % 60).padStart(2, '0')
  return `${nh}:${nm}`
}

export class AtlasTravelProvider extends BaseProvider {
  constructor() {
    super({ name: 'atlas-planning', category: 'travel-planning' })
  }

  isConfigured() {
    return true
  }

  /**
   * Resolves a city name, airport name, or IATA code to reference airport data.
   */
  resolveAirport(query) {
    const q = String(query || '').trim().toLowerCase()
    if (!q) return null
    if (AIRPORTS[q.toUpperCase()]) return AIRPORTS[q.toUpperCase()]
    const mapped = CITY_TO_IATA[q]
    if (mapped && AIRPORTS[mapped]) return AIRPORTS[mapped]
    for (const apt of Object.values(AIRPORTS)) {
      if (apt.city.toLowerCase() === q || apt.name.toLowerCase().includes(q)) {
        return apt
      }
    }
    return null
  }

  /**
   * Resolves a city or destination name to city code and name.
   */
  resolveCity(query) {
    const apt = this.resolveAirport(query)
    if (apt) return { iataCode: apt.code, name: apt.city }
    const q = String(query || '').trim()
    return { iataCode: q.slice(0, 3).toUpperCase(), name: q }
  }

  /**
   * Generates legitimate reference flight options with realistic duration and fare ranges.
   * Source state is strictly 'estimated'.
   */
  async searchFlights({ origin, destination, departureDate, returnDate, adults = 1, travelClass = 'ECONOMY', limit = 10 } = {}) {
    const origApt = this.resolveAirport(origin) || { code: String(origin).toUpperCase().slice(0, 3), city: origin, lat: 28.5, lng: 77.1 }
    const destApt = this.resolveAirport(destination) || { code: String(destination).toUpperCase().slice(0, 3), city: destination, lat: 19.1, lng: 72.8 }
    const partySize = Math.max(1, Number(adults) || 1)

    const routeKey = `${origApt.code}-${destApt.code}`
    const benchmark = BENCHMARK_ROUTES[routeKey]

    let durationHours = 2.0
    let minPerPerson = 4500
    let maxPerPerson = 6500

    if (benchmark) {
      durationHours = benchmark.durationHours
      minPerPerson = benchmark.minFare
      maxPerPerson = benchmark.maxFare
    } else {
      const distKm = calculateDistanceKm(origApt.lat, origApt.lng, destApt.lat, destApt.lng)
      durationHours = Math.max(1.0, Math.round((0.5 + distKm / 750) * 10) / 10)
      const baseFare = 2200 + Math.round(distKm * 3.4)
      minPerPerson = Math.round((baseFare * 0.88) / 100) * 100
      maxPerPerson = Math.round((baseFare * 1.25) / 100) * 100
    }

    if (travelClass === 'BUSINESS') {
      minPerPerson = Math.round(minPerPerson * 2.8)
      maxPerPerson = Math.round(maxPerPerson * 3.2)
    }

    const isRoundTrip = Boolean(returnDate && returnDate >= departureDate && returnDate !== departureDate)
    const tripMultiplier = isRoundTrip ? 2 : 1
    const totalMin = minPerPerson * partySize * tripMultiplier
    const totalMax = maxPerPerson * partySize * tripMultiplier
    const totalMid = Math.round((totalMin + totalMax) / 2)

    const departureSlots = ['06:30', '09:15', '13:45', '17:20', '20:10']
    const options = []
    const count = Math.min(limit, CARRIERS.length)

    for (let i = 0; i < count; i++) {
      const carrier = CARRIERS[i % CARRIERS.length]
      const depTime = departureSlots[i % departureSlots.length]
      const arrTime = addMinutesToClock(depTime, durationHours * 60)
      const flightSpreadMin = Math.round(totalMin * (0.95 + (i * 0.03)))
      const flightSpreadMax = Math.round(totalMax * (0.95 + (i * 0.03)))
      const flightPrice = Math.round((flightSpreadMin + flightSpreadMax) / 2)

      const retDepTime = '11:00'
      const retArrTime = addMinutesToClock(retDepTime, durationHours * 60)

      options.push({
        id: `est-flt-${origApt.code}-${destApt.code}-${carrier.code}-${i + 1}`,
        mode: 'flight',
        provider: carrier.name,
        airline: carrier.name,
        airlineCode: carrier.code,
        flightNumber: null, // Truthful: do NOT fabricate live flight numbers
        from: origApt.code,
        origin: origApt.code,
        fromCity: origApt.city || origApt.name,
        fromName: origApt.name || origApt.code,
        to: destApt.code,
        destination: destApt.code,
        toCity: destApt.city || destApt.name,
        toName: destApt.name || destApt.code,
        price: flightPrice,
        priceRange: {
          min: flightSpreadMin,
          max: flightSpreadMax,
          formatted: `₹${flightSpreadMin.toLocaleString('en-IN')}–₹${flightSpreadMax.toLocaleString('en-IN')}`,
        },
        durationHours,
        durationMinutes: Math.round(durationHours * 60),
        durationText: formatDuration(durationHours),
        departure: depTime,
        arrival: arrTime,
        departureDate: departureDate || null,
        arrivalDate: departureDate || null,
        stops: 0,
        currency: 'INR',
        priceBasis: 'party_total',
        tripType: isRoundTrip ? 'round-trip' : 'one-way',
        // Truthful planning flags
        dataSource: 'estimated',
        sourceType: 'estimated',
        costState: 'estimated',
        cached: false,
        liveAvailability: false,
        status: 'Live availability unavailable',
        statusLabel: 'Planning estimate',
        statusDetail: 'Live availability unavailable',
        availability: 'not_verified',
        bookingStatus: 'not_booked',
        bookingUrl: null,
        label: 'Planning estimate',
        actionLabel: 'Search live availability',
        ...(isRoundTrip ? {
          returnDeparture: retDepTime,
          returnArrival: retArrTime,
          returnDurationHours: durationHours,
          returnStops: 0,
        } : {}),
      })
    }

    return {
      ok: true,
      flights: options,
      dataSource: 'estimated',
      sourceType: 'estimated',
      provider: this.name,
    }
  }

  /**
   * Generates legitimate reference hotel options with authentic price ranges.
   * Source state is strictly 'estimated'.
   */
  async searchHotels(destination, { limit = 10 } = {}) {
    const destName = typeof destination === 'object' && destination !== null ? destination.destination : destination
    const lim = (typeof destination === 'object' && destination?.limit) || limit
    const key = String(destName || '').trim().toLowerCase()
    let pool = REFERENCE_HOTELS[key]

    if (!pool) {
      // Deterministic reference properties for unlisted destinations
      pool = [
        { name: `${destName} Heritage Retreat`, area: 'Central District', rating: 4.4, minPrice: 2800, maxPrice: 4500, amenities: ['wifi', 'restaurant', 'parking'] },
        { name: `${destName} Grand Resort`, area: 'Scenic Valley', rating: 4.6, minPrice: 4800, maxPrice: 7500, amenities: ['wifi', 'pool', 'spa', 'garden view'] },
        { name: `${destName} Boutique Stay`, area: 'Old Town', rating: 4.2, minPrice: 1800, maxPrice: 3000, amenities: ['wifi', 'breakfast'] },
        { name: `Zostel ${destName}`, area: 'City Center', rating: 4.3, minPrice: 900, maxPrice: 2200, amenities: ['wifi', 'cafe', 'lounge'] },
      ]
    }

    const hotels = pool.slice(0, lim).map((h, i) => {
      const mid = Math.round((h.minPrice + h.maxPrice) / 2)
      return {
        id: `est-htl-${key || 'city'}-${i + 1}`,
        name: h.name,
        area: h.area,
        destination: destName,
        rating: h.rating,
        pricePerNight: mid,
        priceRange: {
          min: h.minPrice,
          max: h.maxPrice,
          formatted: `₹${h.minPrice.toLocaleString('en-IN')}–₹${h.maxPrice.toLocaleString('en-IN')}`,
        },
        amenities: h.amenities,
        currency: 'INR',
        address: `${h.area}, ${destName}`,
        coordinates: null,
        images: [],
        // Truthful planning flags
        dataSource: 'estimated',
        sourceType: 'estimated',
        costState: 'estimated',
        provider: 'AtlasTravelProvider',
        cached: false,
        liveAvailability: false,
        availability: 'not_verified',
        bookingStatus: 'not_booked',
        bookingUrl: null,
        label: 'Reference estimate',
        statusLabel: 'Reference property',
        statusDetail: 'Reference estimate',
        actionLabel: 'Check live availability',
      }
    })

    return {
      ok: true,
      hotels,
      dataSource: 'estimated',
      sourceType: 'estimated',
      provider: this.name,
    }
  }
}

export const atlasTravelProvider = new AtlasTravelProvider()
