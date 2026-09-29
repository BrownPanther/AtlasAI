import { openTripMapProvider } from '../providers/openTripMapProvider.js'
import { openRouteServiceProvider } from '../providers/openRouteServiceProvider.js'
import { amadeusProvider } from '../providers/amadeusProvider.js'
import { duffelProvider } from '../providers/duffelProvider.js'
import { openWeatherMapProvider } from '../providers/openWeatherMapProvider.js'
import { railProvider } from '../providers/railProvider.js'
import { atlasTravelProvider } from '../providers/atlasTravelProvider.js'

// Single place that knows about every travel-data provider AtlasAI can use.
// Used today for a startup log line (see server.js) and reserved for the
// admin "provider health" panel planned in a later checkpoint (R9).
const REGISTRY = [
  { provider: openTripMapProvider, category: 'attractions', label: 'OpenTripMap (attractions/places)' },
  { provider: openRouteServiceProvider, category: 'maps', label: 'OpenRouteService (maps/routing)' },
  {
    get provider() {
      if (duffelProvider.isConfigured()) return duffelProvider
      if (amadeusProvider.isConfigured()) return amadeusProvider
      return atlasTravelProvider
    },
    category: 'flights',
    get label() {
      if (duffelProvider.isConfigured()) return 'Duffel (flights, live)'
      if (amadeusProvider.isConfigured()) return 'Amadeus (flights, test environment)'
      return 'AtlasTravelProvider (flights, planning estimates)'
    },
  },
  {
    get provider() {
      return amadeusProvider.isConfigured() ? amadeusProvider : atlasTravelProvider
    },
    category: 'hotels',
    get label() {
      return amadeusProvider.isConfigured() ? 'Amadeus (hotels, test environment)' : 'AtlasTravelProvider (hotels, reference estimates)'
    },
  },
  { provider: railProvider, category: 'trains', label: 'RailRadar (trains)' },
  { provider: openWeatherMapProvider, category: 'weather', label: 'OpenWeatherMap (weather)' },
]

export const providerRegistry = {
  status() {
    return REGISTRY.map(({ provider, category, label }) => ({
      category,
      label,
      configured: provider.isConfigured(),
    }))
  },
}
