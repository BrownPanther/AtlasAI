// Response shapes modelled on Amadeus's documented test-environment API
// (developers.amadeus.com). Hand-written fixtures: values are illustrative,
// not real provider data.

export function tokenOk({ expiresIn = 1799 } = {}) {
  return { access_token: 'test-access-token', token_type: 'Bearer', expires_in: expiresIn }
}

export function cityResultOk({ iataCode = 'GOI', name = 'GOA' } = {}) {
  return [{ type: 'location', subType: 'CITY', name, iataCode, address: { cityName: name } }]
}

export function hotelsByCityOk({ hotelId = 'ABGOI001' } = {}) {
  return [{ hotelId, name: 'Sample Hotel', chainCode: 'AB', iataCode: 'GOI', geoCode: { latitude: 15.49, longitude: 73.82 } }]
}

export function hotelOffersOk({ hotelId = 'ABGOI001', name = 'Sample Hotel', price = '4200.00', currency = 'INR' } = {}) {
  return [{
    type: 'hotel-offers',
    hotel: {
      hotelId, name, rating: '4', latitude: 15.49, longitude: 73.82,
      address: { lines: ['Beach Road'], cityName: 'Goa' },
      amenities: ['WIFI', 'POOL'],
    },
    offers: [{ id: 'offer-1', price: { currency, total: price } }],
  }]
}

export function flightOffersOk({
  id = 'offer-1', origin = 'DEL', destination = 'GOI', carrierCode = '6E', number = '204',
  departureAt = '2026-10-10T07:00:00', arrivalAt = '2026-10-10T09:30:00',
  price = '5200.00', currency = 'INR', returnLeg = null,
} = {}) {
  const itineraries = [{
    segments: [{
      departure: { iataCode: origin, at: departureAt },
      arrival: { iataCode: destination, at: arrivalAt },
      carrierCode, number,
    }],
  }]
  if (returnLeg) {
    itineraries.push({
      segments: [{
        departure: { iataCode: destination, at: returnLeg.departureAt },
        arrival: { iataCode: origin, at: returnLeg.arrivalAt },
        carrierCode, number,
      }],
    })
  }
  return [{ id, itineraries, price: { currency, total: price } }]
}


export function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

/**
 * Installs a global fetch mock that answers Amadeus test-environment URLs
 * from fixtures, routed by path. Returns { calls, restore }. `handlers` may
 * override any of { token, cities, byCity, offers } to test failure paths.
 */
export function installAmadeusMock(handlers = {}) {
  const realFetch = globalThis.fetch
  const calls = { token: 0, cities: 0, byCity: 0, offers: 0, flights: 0, urls: [] }
  globalThis.fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input.url)
    if (url.hostname !== 'test.api.amadeus.com') return realFetch(input, init)
    calls.urls.push(url.toString())

    if (url.pathname === '/v1/security/oauth2/token') {
      calls.token++
      return (handlers.token || (() => json(tokenOk())))(url)
    }
    if (url.pathname === '/v1/reference-data/locations') {
      calls.cities++
      return (handlers.cities || (() => json({ data: cityResultOk() })))(url)
    }
    if (url.pathname === '/v1/reference-data/locations/hotels/by-city') {
      calls.byCity++
      return (handlers.byCity || (() => json({ data: hotelsByCityOk() })))(url)
    }
    if (url.pathname === '/v3/shopping/hotel-offers') {
      calls.offers++
      return (handlers.offers || (() => json({ data: hotelOffersOk() })))(url)
    }
    if (url.pathname === '/v2/shopping/flight-offers') {
      calls.flights++
      return (handlers.flights || (() => json({ data: flightOffersOk() })))(url)
    }
    return realFetch(input, init)
  }
  return { calls, restore: () => { globalThis.fetch = realFetch } }
}
