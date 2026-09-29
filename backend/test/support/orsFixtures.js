// Response shape modelled on OpenRouteService's documented
// /v2/directions/{profile} GeoJSON response
// (https://openrouteservice.org/dev/#/api-docs). Hand-written fixture:
// values are illustrative, not real provider data.

export function directionsOk({ distanceMeters = 3200, durationSeconds = 780 } = {}) {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { summary: { distance: distanceMeters, duration: durationSeconds } },
        geometry: { type: 'LineString', coordinates: [] },
      },
    ],
  }
}

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

/**
 * Installs a global fetch mock that answers OpenRouteService URLs from
 * fixtures. Returns { calls, restore }. `handler` may replace the default
 * success response.
 */
export function installOpenRouteServiceMock(handler) {
  const realFetch = globalThis.fetch
  const calls = { directions: 0, urls: [] }
  globalThis.fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input.url)
    if (url.hostname !== 'api.openrouteservice.org') return realFetch(input, init)
    calls.urls.push(url.toString())
    calls.directions++
    return (handler || (() => json(directionsOk())))(url)
  }
  return { calls, restore: () => { globalThis.fetch = realFetch } }
}
