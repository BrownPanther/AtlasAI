// Response shapes modelled on OpenTripMap's documented API
// (https://dev.opentripmap.com/docs). Hand-written fixtures: names and
// values are illustrative, not real provider data.

export const geonameOk = { name: 'Manali', country: 'IN', lat: 32.2432, lon: 77.1892, timezone: 'Asia/Kolkata', population: 8096, status: 'OK' }
export const geonameNotFound = { status: 'NOT_FOUND', error: 'No such place' }

export const radiusList = [
  { xid: 'N1', name: 'Hadimba Temple', dist: 1200, rate: 3, osm: 'node/1', wikidata: 'Q1', kinds: 'religion,temples,interesting_places', point: { lon: 77.18, lat: 32.25 } },
  { xid: 'N2', name: 'Solang Valley', dist: 13000, rate: 2, osm: 'node/2', wikidata: 'Q2', kinds: 'natural,mountain_peaks,interesting_places', point: { lon: 77.15, lat: 32.31 } },
  { xid: 'N3', name: '', dist: 50, rate: 0, osm: 'node/3', kinds: 'interesting_places', point: { lon: 77.19, lat: 32.24 } },
  { xid: 'N4', name: 'Hadimba Temple', dist: 1210, rate: 1, osm: 'node/4', kinds: 'religion', point: { lon: 77.181, lat: 32.251 } },
  { xid: 'N5', name: 'Old Manali Bridge', dist: 900, rate: 0, kinds: 'architecture,bridges', point: { lon: 77.17, lat: 32.26 } },
]

export const details = {
  N1: {
    xid: 'N1', name: 'Hadimba Temple', rate: '3h', kinds: 'religion,temples,interesting_places', wikidata: 'Q1',
    otm: 'https://opentripmap.com/en/card/N1', wikipedia: 'https://en.wikipedia.org/wiki/Hidimba_Devi_Temple',
    url: 'https://example.org/hadimba',
    point: { lon: 77.18, lat: 32.25 },
    address: { city: 'Manali', suburb: 'Old Manali', state: 'Himachal Pradesh', country: 'India', country_code: 'in', road: 'Dhungri Road' },
    preview: { source: 'https://upload.wikimedia.org/example/hadimba.jpg', height: 200, width: 300 },
    wikipedia_extracts: { title: 'Hidimba Devi Temple', text: 'Hidimba Devi Temple is an ancient cave temple dedicated to Hidimbi Devi. ' + 'It stands in a forest of deodar trees. '.repeat(20) },
  },
  N2: {
    xid: 'N2', name: 'Solang Valley', rate: '2', kinds: 'natural,mountain_peaks,interesting_places',
    point: { lon: 77.15, lat: 32.31 }, address: { village: 'Solang', county: 'Kullu' },
    info: { descr: 'A side valley at the top of the Kullu Valley.' },
  },
  N5: {
    xid: 'N5', name: 'Old Manali Bridge', rate: '0', kinds: 'architecture,bridges', point: { lon: 77.17, lat: 32.26 },
  },
}

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

/**
 * Installs a global fetch mock that answers OpenTripMap URLs from fixtures.
 * Returns { calls, restore }. `overrides` may replace any endpoint handler.
 */
export function installOpenTripMapMock(overrides = {}) {
  const realFetch = globalThis.fetch
  const calls = { geoname: 0, radius: 0, xid: 0, urls: [], geonameParams: [] }
  globalThis.fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input.url)
    if (url.hostname !== 'api.opentripmap.com') return realFetch(input, init)
    calls.urls.push(url.toString())
    const path = url.pathname
    if (path.endsWith('/geoname')) {
      calls.geoname++
      calls.geonameParams.push(url.searchParams.get('name'))
      return (overrides.geoname || (() => json(geonameOk)))(url)
    }
    if (path.endsWith('/radius')) { calls.radius++; return (overrides.radius || (() => json(radiusList)))(url) }
    if (path.includes('/xid/')) {
      calls.xid++
      const xid = decodeURIComponent(path.split('/xid/')[1])
      return (overrides.xid || ((u, id) => (details[id] ? json(details[id]) : json({ error: 'not found' }, 404))))(url, xid)
    }
    return json({ error: 'unexpected' }, 500)
  }
  return { calls, restore: () => { globalThis.fetch = realFetch } }
}
