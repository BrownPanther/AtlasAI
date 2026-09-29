import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import crypto from 'node:crypto'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config()
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

// JWT_SECRET falls back to a process-lifetime random secret so the app
// never silently runs with a guessable default. This means tokens won't
// survive a restart unless JWT_SECRET is set in .env — that's intentional
// for a dev default, and documented in .env.example.
const fallbackSecret = crypto.randomBytes(32).toString('hex')

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 4000,
  jwtSecret: process.env.JWT_SECRET || fallbackSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  dbPath: process.env.DB_PATH || './data/atlasai.db',
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL || '',
  ollamaModel: process.env.OLLAMA_MODEL || '',
  usingFallbackSecret: !process.env.JWT_SECRET,

  // --- Real travel-data providers (all optional) ---
  // Every one of these is optional. AtlasAI must keep working with none of
  // them set, falling back to the existing sample data. See SETUP.md for
  // which provider covers which feature and how to get a free key.
  providers: {
    // Images — Google Places API (places.googleapis.com). Paid API, requires billing.
    googlePlacesApiKey: process.env.GOOGLE_PLACES_API_KEY || '',
    // Attractions/places — OpenTripMap (dev.opentripmap.com). Free tier.
    attractionsApiKey: process.env.ATTRACTIONS_API_KEY || '',
    // Maps/routing — OpenRouteService (openrouteservice.org). Free tier.
    mapsApiKey: process.env.MAPS_API_KEY || '',
    // Flights — Duffel API (duffel.com). Supports live & sandbox Offer Requests.
    duffelApiKey: process.env.DUFFEL_API_KEY || '',
    // Hotels — Amadeus for Developers (developers.amadeus.com)
    amadeusApiKey: process.env.AMADEUS_API_KEY || '',
    amadeusApiSecret: process.env.AMADEUS_API_SECRET || '',
    // Weather — OpenWeatherMap (openweathermap.org). Free tier.
    weatherApiKey: process.env.WEATHER_API_KEY || '',
    // Trains — RailRadar (railradar.in). Free sandbox tier: 1,000
    // requests/month. See providers/railProvider.js.
    trainsApiKey: process.env.TRAINS_API_KEY || '',
    // Provider credentials (optional)
    tripjackApiKey: process.env.TRIPJACK_API_KEY || '',
    tboApiKey: process.env.TBO_API_KEY || '',
  },

  // Provider selection: 'atlas' (AtlasTravelProvider - default truthful planning layer) | 'amadeus' | 'duffel' | 'tripjack' | 'tbo' | 'sample'
  flightProvider: process.env.FLIGHT_PROVIDER || process.env.TRAVEL_PLANNING_PROVIDER || 'atlas',
  hotelProvider: process.env.HOTEL_PROVIDER || process.env.TRAVEL_PLANNING_PROVIDER || 'atlas',
}
