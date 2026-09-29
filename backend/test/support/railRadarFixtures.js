// Response shapes modelled on RailRadar's documented API
// (https://railradar.in/docs). Hand-written fixtures: values are
// illustrative, not real provider data.

export function stationSearchOk({ code = 'JP', name = 'Jaipur Junction', city = 'Jaipur' } = {}) {
  return { data: [{ code, name, city }] }
}

export function trainsBetweenOk({
  from = { code: 'NDLS', name: 'New Delhi' },
  to = { code: 'JP', name: 'Jaipur Junction' },
  trainNumber = '12958', trainName = 'ADI SF EXPRESS', departure = '06:10', arrival = '10:45',
  duration = 275, distance = 308, totalHaltsBetween = 3, live = null,
} = {}) {
  return {
    data: {
      from,
      to,
      trains: [{
        train: { number: trainNumber, name: trainName, type: 'SUPERFAST', runDays: ['MON', 'WED', 'FRI'] },
        from: { departure, day: 1, sequence: 1 },
        to: { arrival, day: 1, sequence: 8 },
        duration,
        distance,
        totalHaltsBetween,
        live,
      }],
    },
  }
}

export function liveStatusOk({
  trainNumber = '12958', trainName = 'ADI SF EXPRESS', status = 'RUNNING', delayMinutes = 12,
} = {}) {
  return {
    data: {
      trainNumber, trainName, startDate: '2026-10-10', status, delayMinutes,
      currentLocation: { stationCode: 'RTGH', status: 'DEPARTED', segmentProgress: 0.4, speedKmh: 82 },
      previousHalt: { stationCode: 'RE', stationName: 'Rewari Junction' },
      nextHalt: { stationCode: 'AWR', stationName: 'Alwar Junction' },
      lastUpdatedAt: '2026-10-10T07:45:00Z',
      isLive: true,
    },
  }
}

export function fareOk({ trainNumber = '12958', classCode = '3A', quotaCode = 'GN', totalFare = 875 } = {}) {
  return { data: { trainNumber, classCode, quotaCode, totalFare, breakdown: { baseFare: 700, reservationCharge: 40, superfastCharge: 45, gst: 90 } } }
}

export function seatsOk({ trainNumber = '12958', classCode = '3A', quotaCode = 'GN' } = {}) {
  return {
    data: {
      trainNumber, classCode, quotaCode,
      avlDayList: [
        { availablityDate: '2026-10-10', availablityStatus: 'AVAILABLE-42' },
        { availablityDate: '2026-10-11', availablityStatus: 'RAC 5' },
      ],
    },
  }
}

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

/**
 * Installs a global fetch mock that answers RailRadar (api.railradar.in)
 * URLs from fixtures, routed by path shape. Returns { calls, restore }.
 * `handlers` may override any of { stations, between, live, fare, seats }
 * to test failure paths.
 */
export function installRailRadarMock(handlers = {}) {
  const realFetch = globalThis.fetch
  const calls = { stations: 0, between: 0, live: 0, fare: 0, seats: 0, urls: [] }
  globalThis.fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input.url)
    if (url.hostname !== 'api.railradar.in') return realFetch(input, init)
    calls.urls.push(url.toString())

    if (url.pathname === '/v1/lookup/search/stations') {
      calls.stations++
      return (handlers.stations || (() => json(stationSearchOk())))(url)
    }
    if (url.pathname.startsWith('/v1/trains/between/')) {
      calls.between++
      return (handlers.between || (() => json(trainsBetweenOk())))(url)
    }
    if (/^\/v1\/trains\/[^/]+\/live$/.test(url.pathname)) {
      calls.live++
      return (handlers.live || (() => json(liveStatusOk())))(url)
    }
    if (/^\/v1\/trains\/[^/]+\/fare$/.test(url.pathname)) {
      calls.fare++
      return (handlers.fare || (() => json(fareOk())))(url)
    }
    if (/^\/v1\/trains\/[^/]+\/seats$/.test(url.pathname)) {
      calls.seats++
      return (handlers.seats || (() => json(seatsOk())))(url)
    }
    return realFetch(input, init)
  }
  return { calls, restore: () => { globalThis.fetch = realFetch } }
}
