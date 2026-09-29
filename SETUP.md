# AtlasAI — current state (Checkpoints 0–12 complete; Real Data Integration R1–R10 complete)

## What's in this zip
```
backend/               Node/Express API (SQLite via better-sqlite3)
travel-planner/         React/Vite frontend, wired to the real backend
```
`node_modules/`, `dist/`, and the SQLite DB file are excluded — reinstall/regenerate with the commands below.

## Run it

**Backend**
```
cd backend
npm install
cp .env.example .env
# open .env and set a real JWT_SECRET (any long random string)
npm run dev        # http://localhost:4000
```
The DB file and its folder are created automatically on first run — no separate migrate step needed (though `npm run migrate` also works if you want to run it explicitly).

**Frontend** (separate terminal)
```
cd travel-planner
npm install
npm run dev         # http://localhost:5173
```

Optional: set `ATTRACTIONS_API_KEY` in `backend/.env` (free key from https://dev.opentripmap.com) to get real attractions. Without it everything still works on sample data.

**Backend checks**
```
cd backend
npm test           # node:test suite — mocked provider responses, never calls the live API
npm run lint       # oxlint
```

Register the first account — it's automatically made an admin (`/admin` dashboard becomes visible from the Profile page).

## Where things stand

All planned checkpoints for this development phase are complete:

- **Checkpoints 0–9**: backend foundation, the custom multi-agent planning runtime, real-time SSE streaming, the full interactive itinerary redesign, groups/chat/invites, notifications, bookings/reviews/feedback/support, safety (location sharing + emergency alerts), and the admin dashboard.
- **Checkpoint 10 (integration pass)**: fixed the known unused imports, a broken `npm run smoke` script reference, and a stray empty directory. Verified frontend↔backend API contracts match 1:1, auth/protected routes, SSE streaming, and all core flows.
- **Checkpoint 11 (UI/UX polish)**: fixed a broken CSS variable in `ThemeToggle`, a dead (CSS-hidden) mobile nav overlay, a hardcoded-fake-trip-data bug on the Dashboard (now reads the user's real trips), a timezone bug in group chat timestamps, consolidated error-state styling into one shared class, added `role="dialog"` to all modals, and associated form labels with their inputs app-wide via `FormField.jsx`.
- **Checkpoint 12 (final audit)**: full security/auth/authorization audit (verified 401/403 boundaries and no IDOR live), database/schema/foreign-key audit, multi-agent orchestrator error-handling audit, removed one dead file (`data/itineraryBuilder.js`, an unused pre-backend mock generator), and re-validated every core flow end-to-end against a fresh database.

### Known, intentional limitations (documented, not bugs)
- The browsable catalog in `Reservations.jsx` (flights, trains, buses, hotels, rentals) and the navbar's quick-search still read from a static local sample dataset (`travel-planner/data/mockData.js`) — there is no backend catalog/search API for flights, hotels, or trains yet. (The Explore/Attractions page moved to the backend in R2.) The actual booking *action* in Reservations **is** wired to the real backend and persists real bookings; only the browsable listing is static sample content.
- Trip budget/expense tracking (`ExpenseContext`) is local-only (browser-side), with no backend persistence.
- Group chat uses 4-second polling rather than a websocket layer.
- (Historical, Checkpoint 12) There was no automated test suite then; the backend now has a mocked `node:test` suite (223 tests after R7).

## AtlasAI — Real Travel Data Integration (new phase, in progress)

This phase replaces the static sample travel catalog with real external
provider data, without touching the existing architecture (agents, tools,
routes, DB, frontend design system are all reused — only the data source
behind them changes). Work is split into checkpoints R1–R10; R1–R7 are done
so far (**R8 is next**).

### Providers selected (see individual provider files for research notes)
| Category | Provider | Type | Env vars |
|---|---|---|---|
| Attractions/places | [OpenTripMap](https://dev.opentripmap.com) | Free tier, official key | `ATTRACTIONS_API_KEY` |
| Maps/routing | [OpenRouteService](https://openrouteservice.org) | Free "Standard" tier, official key | `MAPS_API_KEY` |
| Flights + hotels | [Amadeus for Developers](https://developers.amadeus.com) test environment | Free, rate-limited, **synthetic data** (not live pricing/availability) | `AMADEUS_API_KEY`, `AMADEUS_API_SECRET` |
| Weather | [OpenWeatherMap](https://openweathermap.org/api) | Free tier, official key | `WEATHER_API_KEY` |
| Trains | [RailRadar](https://railradar.in/docs) | Official REST API, free sandbox tier (1,000 req/month) — **integrated in R6** (no scraping of IRCTC/NTES) | `TRAINS_API_KEY` |

**The app works fully with zero provider keys set** — every category falls
back to the existing sample data, honestly labeled `dataSource: 'sample'`.
Setting a key only adds real data for that one category; nothing else changes.

### R1 — Provider architecture + normalization — COMPLETE
Built the foundational layers every later checkpoint (R2–R6) will plug into:
- `backend/src/providers/` — one HTTP client class per provider (`BaseProvider.js` is the shared base with a timeout-guarded fetch helper). Each provider exposes `isConfigured()` and category-specific methods (e.g. `openTripMapProvider.searchNearby(...)`).
- `backend/src/normalizers/` — pure functions mapping each provider's raw response into AtlasAI's own canonical shape (a deliberate superset of the existing sample-data shape, so agents/tools need no changes once wired in later).
- `backend/src/services/` — one service per category (`attractionsService`, `mapsService`, `hotelsService`, `flightsService`, `trainsService`, `weatherService`) plus `providerRegistry.js`, which reports every provider's configured/unconfigured status (logged, without secrets, at server startup).
- `backend/src/cache/cacheStore.js` — a generic SQLite-backed TTL cache (new `provider_cache` table, added via `schema.sql`) so repeated queries don't re-hit external APIs. Per-category TTLs are documented in `services/cacheDurations.js`.
- `.env.example` / `config/env.js` updated with all new provider variables — all optional, all backend-only (never exposed to the frontend/Vite bundle).

**Not done yet** (upcoming checkpoints, not started): wiring `hotelTool.js`/`transportTool.js` to call their services instead of `sampleTravelData.js` (R4–R6; `attractionTool.js` was wired in R2, routing was wired in R3); remaining frontend consumption (R8); admin provider-health UI (R9); automated tests for the provider/normalizer layer (R10, though R2 and R3 each added their own tests as they went).

**Validated this checkpoint**: fresh migration (new `provider_cache` table creates cleanly), server boot with zero provider keys (all 6 categories correctly report `sample`/unconfigured, no crashes), all 6 normalizers round-tripped against synthetic payloads matching each provider's documented response shape, and a full regression pass (auth, trips, AI planning) confirming zero behavior change for existing features.

### R2 — Attractions + Destinations — COMPLETE

Real places now flow through the existing R1 architecture; nothing was redesigned.

```
Explore page ─► GET /api/attractions ─┐
ActivityAgent ─► attractionTool ──────┴─► attractionsService ─► openTripMapProvider ─► OpenTripMap
                                                    │                                        │
                                                    │  SQLite TTL cache (cacheStore)   attractionNormalizer
                                                    └─► sampleTravelData fallback
```

**Environment variable** — `ATTRACTIONS_API_KEY` (backend only, optional, empty in `.env.example`). Never prefixed `VITE_`, never returned by an endpoint, never logged (startup logs only "live/sample"; provider errors are redacted before logging).

**Backend endpoints** (both require login, share a 60 requests / 15 min limiter):
- `GET /api/attractions?destination=Manali[&limit=9][&interests=nature,food]` → `{ query, destination, attractions[], count, dataSource, provider, fallbackReason, stale?, attribution? }`
- `GET /api/destinations/search?q=Manali` → `{ results[], dataSource, provider, fallbackReason }`. OpenTripMap's geoname resolves one best match per name (name, country, timezone, population, coordinates), so `results` has at most one entry.

**Service changes** (`attractionsService.js`): `getAttractions()` is the full fallback chain (fresh cache → OpenTripMap → stale cache → sample → empty); `fetchForDestination()` is the provider-only path; `searchDestination()` does destination lookup. Per cold destination it makes 1 geoname + 1 radius + up to `limit` place-detail calls (max 4 in flight); places are ranked by OpenTripMap's popularity score, de-duplicated by name, unnamed places dropped. Interests map to a fixed OpenTripMap `kinds` whitelist — free text never reaches the provider request. `BaseProvider` now tags failures (`auth` / `rate_limited` / `timeout` / `network` / `http`); after an auth or rate-limit rejection the service pauses provider calls (5 min / 1 min) and serves cache/sample instead of hammering the API.

**Attraction tool changes** (`tools/attractionTool.js`): now async and calls `attractionsService` (5 s provider deadline, well inside the orchestrator's 8 s agent timeout; the provider request keeps running and warms the cache). It hands `ActivityAgent` a *concise* planning record (`id, name, area, category, cost/duration flags, ≤160-char summary, popularity, coordinates, dataSource`) — never raw provider JSON, long descriptions, addresses or image lists. `ActivityAgent` awaits the tool and records `dataSource`/`provider`/`fallbackReason`; otherwise unchanged. `SynthesisAgent` adds `finalPlan.sources` (per component) and keeps the overall `dataSource` at `'sample'` while transport/stay are still sample data, so a mixed plan is never presented as live.

**Frontend changes**: `pages/Attractions.jsx` reads from the backend (same Checkpoint 11 cards, grid, pager and design tokens) and adds a destination field, skeleton loading state, empty state, error state with retry, a source badge and OpenTripMap attribution. Itinerary stop drawer shows "Not listed by provider" instead of "Free" when a live place has no price. New CSS is appended to `index.css` (`atlas-explore-search`, `atlas-state-box`, skeleton, pill variants).

**Caching**: existing `cacheStore` / `provider_cache` table and the 7-day `attractions` TTL. Three layers are cached separately (geoname, radius list, place detail) so a different `limit` or a repeat visit costs zero provider calls, and concurrent identical requests share one in-flight call. Expired entries are served (labeled cached, `stale: true`) only when the provider is failing. `cacheStore.getStale()` was added for this.

**Fallback behaviour**: real → cache → sample → graceful empty. Known sample destinations (Manali, Goa, Jaipur) fall back to sample places. For unknown destinations the Explore endpoint returns an honest empty state rather than generated placeholder places; planning agents keep their existing generated-sample behaviour so plans still complete. No raw provider error ever reaches a client — responses carry a `fallbackReason` code: `not_configured | timeout | rate_limited | provider_unavailable | destination_not_found | no_results`.

**Live vs sample** — `dataSource` is `live` (an OpenTripMap request succeeded during this call), `cached` (served from AtlasAI's cache of an earlier provider response), `sample` (bundled demo data) or `none`. The UI badge reads "Live data · OpenTripMap", "Cached data · OpenTripMap" or "Sample data"; sample data is never called live.

**Fields**: only what OpenTripMap returns — name, description (Wikipedia extract or provider text, clipped to 500 chars), coordinates, address/area, category + raw `kinds`, popularity score (1–3, shown as "n/3" — *not* a star rating), Wikidata id, Wikipedia/website/OpenTripMap links, preview image, provider id. Left unavailable (null) because OpenTripMap does not supply them: prices, opening hours, review counts, visit durations. For itinerary scheduling only, live places get a placeholder duration flagged `durationEstimated: true`, and unknown prices count as ₹0 with `costKnown: false` (the itinerary and budget therefore exclude place prices).

**Tests** (`cd backend && npm test`, 43 tests, all mocked — no live API calls): normalizer (real fields, no fabrication, unsafe URLs dropped), service (valid/missing/invalid key, timeout, deadline, no results, malformed data, cache hit, different-limit reuse, concurrent dedupe, stale serving, sample fallback, destination search), tool + `ActivityAgent` + itinerary flags, HTTP API (auth, validation, live→cached, failures never leak errors/keys, full `/ai/plan` with and without a key), and static security checks (key only read by env/provider, absent from frontend, `.env.example` empty, RailRadar untouched). Frontend: `npm run lint` (0 errors; the 8 pre-existing warnings are unchanged) and `npm run build` pass. The Explore page was also exercised in a real browser against a mocked OpenTripMap (live, cached, sample fallback + retry, loading, empty, error + retry, signed-out, mobile).

**Also fixed in R2**: `cacheStore` prepared its SQL statements at import time, so a brand-new database crashed on first boot (`no such table: provider_cache`) because migrations run after imports. Statements are now prepared lazily.

**Limitations**
- Not yet exercised against the real OpenTripMap service (no key/network in the build environment): request and response shapes follow OpenTripMap's documented API and are covered by mocked fixtures. Run once with a real key before relying on it (see below).
- No prices, opening hours, review counts or durations (OpenTripMap doesn't provide them); the popularity score is coarse (1–3) and many places have none.
- Place names/descriptions are OpenTripMap's English data; coverage varies by region. Preview images are hot-linked from the provider's URLs.
- The Explore page's destination search accepts free text and relies on OpenTripMap's single best geoname match (no autocomplete list).
- Navbar quick-search and the Reservations catalog still use `mockData.js` (later checkpoints).
- Pre-existing: if `/api/auth/me` fails on a transient network error the frontend clears the session (`AuthContext`), so a fully unreachable backend shows the signed-out prompt on Explore rather than the error state.
- Circuit-breaker and in-flight state are per-process (fine for one backend instance).

**Trying it with a real key**: put `ATTRACTIONS_API_KEY=<your key>` in `backend/.env`, restart, confirm the startup log says `live — attractions`, then open Explore (badge "Live data · OpenTripMap") or `GET /api/attractions?destination=Manali` with your login token. A second identical request should report `cached`.

### R3 — Maps + Routing — COMPLETE

Real distance/duration between itinerary stops now flows through the R1 architecture (no new architecture, no redesign):

```
Itinerary generation ─► itineraryTool.buildDays ─► mapsService ─► openRouteServiceProvider ─► OpenRouteService
GET /api/routes ────────────────────────────────┘        │                                          │
                                                   SQLite TTL cache (cacheStore)              routeNormalizer
                                                           └─► unavailableRoute() (never fabricated)
```

**Environment variable** — `MAPS_API_KEY` (backend only, optional, empty in `.env.example`, already present from R1). Never prefixed `VITE_`, never returned by an endpoint, never logged (only "live/sample" at startup; provider errors are redacted before logging, same as R2).

**Backend endpoint** — `GET /api/routes?fromLat=..&fromLng=..&toLat=..&toLng=..[&mode=driving|cab|walking|cycling]` (login required, dedicated 60 requests / 15 min limiter). Returns `{ route: { distanceKm, durationMinutes, mode, dataSource, provider, cached, stale?, fallbackReason? }, dataSource, provider }`. Validates all four coordinates and rejects unsupported modes with 400; never forwards a raw provider error or the provider URL/key.

**Maps provider** (`providers/openRouteServiceProvider.js`) — only maps AtlasAI transport modes to profiles OpenRouteService actually has: `driving`/`cab` → `driving-car` (a cab is a car ride, so this is a legitimate reuse, not an approximation), `walking` → `foot-walking`, `cycling` → `cycling-regular`. There is deliberately **no** `bus`/public-transport mapping — ORS has no transit profile (no schedules/routes), so requesting it returns a controlled `unsupported_mode` error instead of silently timing a bus trip as if it were a car.

**Service** (`services/mapsService.js`) — same fallback chain and circuit-breaker shape as `attractionsService`: fresh cache → provider → stale cache → `unavailable` (never fabricated, never straight-line-as-road-distance). Coordinates are rounded to ~11m precision for stable cache keys. After an auth/rate-limit rejection the service pauses provider calls (5 min / 1 min) the same way R2 does.

**Itinerary integration** (`tools/itineraryTool.js`) — `buildDays()` is now async. For each pair of consecutive activities in a day that both have coordinates (only live/cached OpenTripMap places do — sample activities and hotels don't yet, so this degrades gracefully), it calls `mapsService.getRoute()` and attaches the result as `stop.travelToNext = { distanceKm, durationMinutes, mode, dataSource, provider, cached }` (or `null`). When a live/cached leg is available its real duration is used as the schedule gap to the next stop instead of the previous fixed 45-minute buffer; when it isn't, the fixed buffer is kept as-is. All legs for a day run concurrently and are bounded by a 3s deadline (`ROUTE_DEADLINE_MS`) well inside the Orchestrator's 8s per-agent budget — a slow/unreachable provider degrades that leg to the fixed buffer rather than stalling or failing itinerary generation; the request keeps running in the background and still warms the cache. `agents/SynthesisAgent.js` now awaits `buildDays()`.

Only attraction→attraction routing is possible today: hotels and inter-city transport are still sample data with no coordinates (R4/R5/R6), so hotel→attraction and airport/station→hotel legs are `null` until those checkpoints add real coordinates — this is the expected, honest degradation, not a bug.

**Frontend**: `components/itinerary/StopDetailDrawer.jsx` now shows the real `stop.travelToNext` (distance, duration, mode) when present, falling back to the existing schedule-gap estimate (now labeled "(estimated)" so the two are never confused) when it isn't. No new map visualization was built this checkpoint (per R3 scope) — route *data* reaches the itinerary now; a map UI can be layered on later.

**Caching**: existing `cacheStore` / `provider_cache` table, new 30-day `routes` TTL (`cacheDurations.js`) — a distance/duration between two fixed points doesn't change, so it's cached far longer than attractions.

**Tests** (`cd backend && npm test`, 63 tests total, all mocked — no live API calls): `test/mapsService.test.js` (not-configured, invalid coordinates, unsupported mode, live+normalize, cache hit, provider failure with/without stale cache, auth failure trips the breaker, malformed response never cached); `test/routes.api.test.js` (auth, input validation, unavailable payload with no key, live response with no key/URL leak, cache hit, sanitized upstream errors); `test/itineraryTool.test.js` (no-coordinates activities skip routing entirely, live routing populates `travelToNext` and drives real scheduling spacing, missing key or provider failure degrades to the fixed buffer without throwing); `test/api.test.js` gained one full-pipeline test combining the OpenTripMap and OpenRouteService mocks, confirming a live route leg reaches an actual `/ai/plan` response. Frontend: `npm run lint` (0 errors, same 8 pre-existing warnings) and `npm run build` pass.

**Security**: `MAPS_API_KEY` is read only by `openRouteServiceProvider.js` (mirrors R2's `ATTRACTIONS_API_KEY` check); never logged, never in a response body, never in the frontend bundle; `/api/routes` requires auth and rate-limits separately from `/api/attractions`.

**Limitations**
- Not yet exercised against the real OpenRouteService (no key/network in the build environment); request/response shapes follow ORS's documented `/v2/directions/{profile}` API and are covered by mocked fixtures. Run once with a real key before relying on it (put `MAPS_API_KEY=<your key>` in `backend/.env`, restart, confirm the startup log says `live — maps`, then call `GET /api/routes?fromLat=..&fromLng=..&toLat=..&toLng=..` with your login token — a second identical call should report `cached`).
- Routing only happens between consecutive **activities** that both carry provider coordinates; hotel and inter-city legs stay unavailable until R4–R6 give those categories real coordinates.
- No route geometry/polyline is stored or returned — not needed by anything built so far, and not fabricated; can be added from the same ORS response (`features[0].geometry`) when a map UI needs it.
- No public-transit/bus mode — ORS doesn't offer one; adding a genuine transit provider is future work, not a swap of this one.
- Circuit-breaker and cache are per-process (same as R2).

### R4 — Hotels / Accommodation — COMPLETE

Real hotel/accommodation data now flows through the R1 architecture (Amadeus, already selected in R1 — no new provider introduced):

```
StayAgent ─► tools/hotelTool.js ─► services/hotelsService.js ─► providers/amadeusProvider.js ─► Amadeus (test env)
GET /api/hotels/search ──────────────────────┘        │                                              │
                                               SQLite TTL cache (cacheStore)                 hotelNormalizer
                                                       └─► sample fallback (data/sampleTravelData.js, never fabricated)
```

**IMPORTANT — read before wiring a real key**: `test.api.amadeus.com` is Amadeus's free self-service **test** environment. It's a real API (real auth, real schema, genuine request/response cycle) but the hotel/offer data it returns is **synthetic**, not live bookable inventory or live pricing. Every hotel normalized from it therefore carries `liveAvailability: false` and `bookingUrl: null` regardless of `dataSource` — `dataSource: 'live'` here means "a live Amadeus API call succeeded," not "this room is bookable." Don't relax that when eventually moving to Amadeus's production self-service tier — production still requires a paid/negotiated agreement with real inventory access before `bookingUrl`/`liveAvailability` should ever be filled in.

**Environment variables** — `AMADEUS_API_KEY` / `AMADEUS_API_SECRET` (backend only, optional, empty in `.env.example`, already present from R1 — shared with R5's flights work, since Amadeus covers both under one credential pair). Never prefixed `VITE_`, never returned by an endpoint, never logged.

**Backend endpoint** — `GET /api/hotels/search?destination=<name>[&limit=]` (login required, dedicated 60 requests / 15 min limiter). Returns `{ query, hotels: [...], count, dataSource, provider, fallbackReason, stale? }`. Each hotel is the canonical shape from `normalizers/hotelNormalizer.js`: `{ id, name, area, pricePerNight, rating, amenities, dataSource, provider, cached, currency, address, coordinates, images, liveAvailability, bookingUrl }`. There is no separate `GET /api/hotels/:id` — Amadeus's hotel-offers-by-city call already returns full details for every hotel in one round trip, so a details fetch would just re-serve the same cached search result; adding one was skipped as unnecessary duplication (documented limitation below, not an oversight).

**Destination → city code resolution** (the piece R1 explicitly left for R4) — Amadeus identifies cities by IATA city code, not free text. `hotelsService.resolveCityCode()`:
1. Checks a small static map for AtlasAI's own known sample destinations — `manali → KUU` (Kullu-Manali/Bhuntar, the closest real IATA city code to Manali), `goa → GOI`, `jaipur → JAI` — zero provider calls for these.
2. Otherwise calls Amadeus's own `/v1/reference-data/locations?subType=CITY` search and caches the result for 30 days (a city's code never changes) via a new `cities` TTL in `cacheDurations.js`.
3. If neither resolves (city not found, provider down), the destination honestly falls through to sample data with a `fallbackReason`.

**Provider** (`providers/amadeusProvider.js`) — already existed from R1 with `searchHotelsByCity`/`getHotelOffers`/`searchFlights`; R4 fixed a real bug where `errorType` was silently dropped on failure (defeating the circuit-breaker pattern used everywhere else) and added `searchCities()` for the resolution step above. OAuth (`client_credentials`) token fetch/refresh is unchanged; an auth failure now correctly reports `errorType: 'auth'` like any other provider error.

**Service** (`services/hotelsService.js`) — same fallback-chain and circuit-breaker shape as `attractionsService`/`mapsService`: fresh cache → provider (city resolution, then hotel search + offers) → stale cache → sample. After an auth/rate-limit rejection the service pauses provider calls (5 min / 1 min), same as R2/R3. `fetchForDestination()` is the provider-only lookup; `getHotels()` wraps it with the sample fallback and is what `hotelTool.js` and the route call.

**StayAgent / hotelTool integration** — `tools/hotelTool.js` is now async and calls `hotelsService.getHotels()` instead of reading sample data directly; the existing budget/comfort-band scoring logic is unchanged but now treats an unknown price or rating (Amadeus's test data doesn't always include an offer, and never includes a comfort rating) as **neutral** rather than fabricating or penalizing it — `priceKnown`/`ratingKnown` flags are attached to each scored option. `agents/StayAgent.js` now `await`s the call; `agents/Agent.js` already awaited `execute()` generically, so no orchestrator change was needed. Confirmed end-to-end against a live `/api/ai/plan` run (sample fallback, since no real key is configured in this environment) — `stay.data.recommended` comes back fully scored with `liveAvailability: false`.

**Caching**: existing `cacheStore` / `provider_cache` table; new `hotels` TTL (6h — Amadeus test data is quasi-live) and `cities` TTL (30 days) in `cacheDurations.js`.

**Booking**: unchanged — hotels reached via search are *browsable* information, not a confirmed reservation. The existing `/api/bookings` flow (unchanged) still records a user's chosen hotel as a booking exactly as it did for sample data; `bookingUrl` stays `null` since Amadeus's test environment has none to offer, so there's nothing to hand off to for external booking.

**Frontend integration** — `services/api.js` gained `searchHotels(destination, { limit })`. `pages/Reservations.jsx`'s Hotel tab now fetches from `/api/hotels/search` (default destination "Manali", with a destination input to search others) instead of reading `data/mockData.js` directly, with loading ("Searching accommodations…"), error ("Hotel provider temporarily unavailable — showing sample listings."), empty, and source-badge (Live/Cached/Sample data, "(last known)" when stale) states; a hotel with no known price shows "Price on request" instead of a fabricated ₹0, and is never blocked from selection. The other four tabs (Flights/Trains/Buses/Rentals) are untouched, per R4 scope. `data/mockData.js`'s hotel list is kept as the fallback shown if the request itself fails outright (network/auth) — the backend's own sample fallback already covers the "no provider configured" case, so mock data is now a last-resort UI safety net, not the primary source.

**Tests** (`cd backend && npm test`, 81 tests total, all mocked — no live API calls): `test/hotelsService.test.js` (no credentials → sample with `not_configured`; known destination resolves its city code for free with no city-search call; unlisted destination resolves via Amadeus city search; second identical call served from cache; city search with no results falls back to sample; auth failure trips the breaker so a second call skips the provider entirely; provider failure after a prior live success serves the stale cached hotels; a malformed offers response is never cached or presented as live; a hotel with no offer/price is never fabricated a price); `test/hotelTool.test.js` (sample fallback is fully scored; a live hotel with unknown price is scored neutrally, not penalized; a hotel over budget scores worse than one within budget). `test/support/amadeusFixtures.js` adds a routable Amadeus mock (token/city-search/hotels-by-city/hotel-offers) in the same style as R2/R3's fixture helpers. `test/security.test.js` gained the same checks R2/R3 got: `.env.example` placeholders, no Amadeus credential in the frontend bundle, no key/secret value ever logged, only `config/env.js` + `providers/amadeusProvider.js` read the raw credential, and every hotel response is asserted to carry `liveAvailability: false` / `bookingUrl: null`. Frontend: `npm run lint` (0 errors — 9 warnings, all pre-existing `set-state-in-effect` style warnings already present elsewhere in this codebase, e.g. `Admin.jsx`/`BookingContext.jsx`, same pattern as this new effect) and `npm run build` pass.

**Security**: `AMADEUS_API_KEY`/`AMADEUS_API_SECRET` are read only by `config/env.js` and `providers/amadeusProvider.js` (verified by a security test that scans all of `backend/src` for any other reference); never logged; never in a response body; never in the frontend bundle; `/api/hotels/search` requires auth and rate-limits separately from `/api/attractions` and `/api/routes`.

**Live-provider verification**: not exercised against the real Amadeus test API in this environment (no credentials/network available in the build sandbox). Request/response shapes follow Amadeus's documented `/v1/reference-data/locations`, `/v1/reference-data/locations/hotels/by-city`, and `/v3/shopping/hotel-offers` APIs and are covered by mocked fixtures modelled on those docs. **Before relying on it**: put `AMADEUS_API_KEY=<your key>` and `AMADEUS_API_SECRET=<your secret>` in `backend/.env`, restart, confirm the startup log says `live — hotels`, then call `GET /api/hotels/search?destination=Manali` with your login token (or any destination — try one outside the static map, e.g. `?destination=Paris`, to also exercise the Amadeus city-search path) — a second identical call should report `cached`.

**Limitations**
- Not yet exercised against the real Amadeus API (see above) — mocked-only verification.
- No `GET /api/hotels/:id` endpoint — deliberately skipped as redundant (see above), not missing.
- Hotel coordinates from Amadeus (`coordinates.lat/lng`) are captured in the normalized model but **not yet wired into `mapsService`/itinerary routing** — hotel→attraction legs in the itinerary still show `travelToNext: null` exactly as R3 documented; wiring that in is left to whichever later checkpoint revisits itinerary routing, since R4's scope was hotel data itself, not an itinerary rewrite.
- The static known-city map (`manali`/`goa`/`jaipur`) only covers AtlasAI's three bundled sample destinations; every other destination depends on Amadeus's city search succeeding, which the sandbox can't verify live yet.
- Circuit-breaker and cache are per-process (same as R2/R3).

### R5 — Flights — COMPLETE

Real flight-offer data now flows through the same R1 architecture (Amadeus — same credential pair as R4's hotels, no new provider introduced):

```
TransportAgent ─► tools/transportTool.js ─► services/flightsService.js ─► providers/amadeusProvider.js ─► Amadeus (test env)
GET /api/flights/search ──────────────────────┘        │                                                        │
                                                SQLite TTL cache (cacheStore)                          flightNormalizer
                                                        └─► sample fallback (data/sampleTravelData.js, never fabricated)
```

**IMPORTANT — same caveat as R4's hotels**: `test.api.amadeus.com` is Amadeus's free **test** environment — real auth/schema, **synthetic** flight-offer data, not live bookable fares/availability/status. Every flight normalized from it carries `bookingUrl: null` and `status: null` regardless of `dataSource` — `dataSource: 'live'` means "a live Amadeus API call succeeded," not "this fare is bookable." Don't relax that in production without a paid/negotiated Amadeus agreement with real flight inventory/status access.

**Environment variables** — unchanged: `AMADEUS_API_KEY` / `AMADEUS_API_SECRET` (same pair R1/R4 already added, shared across hotels and flights). No new variables introduced.

**Backend endpoint** — `GET /api/flights/search?destination=<name>&departureDate=YYYY-MM-DD[&origin=Delhi][&returnDate=][&adults=][&travelClass=ECONOMY|PREMIUM_ECONOMY|BUSINESS|FIRST][&nonStop=true|false][&limit=]` (login required, dedicated 60 requests / 15 min limiter, same shape as `/api/hotels/search`). `destination` and `departureDate` are required (400 if missing/malformed); everything else is optional and only sent to Amadeus when given — all genuine `/v2/shopping/flight-offers` query parameters, none invented. Returns `{ query, origin, departureDate, returnDate, flights: [...], count, dataSource, provider, fallbackReason, stale? }`. Each flight is the canonical shape from `normalizers/flightNormalizer.js`: `{ id, mode: 'flight', provider, from, to, price, durationHours, departure, arrival, dataSource, cached, currency, airline, flightNumber, stops, status, bookingUrl, tripType, ...returnDeparture/returnArrival/returnDurationHours/returnStops when tripType is 'round-trip' }`. There is no separate `GET /api/flights/:id` — same reasoning as R4's hotels: Amadeus's flight-offers search already returns full itinerary/fare detail for every offer in one round trip, so a details fetch would just re-serve the same cached search result.

**Origin/destination → IATA code resolution** — `flightsService.resolveAirportCode()`, same shape as R4's `resolveCityCode()` but its own function/cache namespace (`airports`, not `cities`, so the two never collide):
1. A small static map for AtlasAI's known cities — `delhi → DEL` (the fixed sample-data origin for every transport option), plus the three R4 already resolves (`manali → KUU`, `goa → GOI`, `jaipur → JAI`), plus `mumbai → BOM` — zero provider calls.
2. A bare 3-letter code (e.g. `"GOI"` given directly) is used as-is — also zero provider calls.
3. Otherwise, Amadeus's own city search (the same endpoint R4 added `searchCities()` for), cached 30 days.
4. If none resolves, honestly falls through to sample data with a `fallbackReason`.

**Provider** (`providers/amadeusProvider.js`) — `searchFlights` (already existed from R1) extended with optional `returnDate`, `travelClass`, `nonStop`, and a caller-supplied `max` (previously hardcoded to `'10'`) — all genuine `/v2/shopping/flight-offers` (GET) parameters. No other provider changes were needed.

**Service** (`services/flightsService.js`, previously a stub) — same fallback-chain/circuit-breaker shape as `hotelsService`: fresh cache → provider (both endpoints resolved to IATA codes, then a flight-offers search) → stale cache → sample. `fetchForRoute()` is the provider-only lookup (validates both dates, including that a given `returnDate` isn't before `departureDate`, before making any provider call); `getFlights()` wraps it with the sample fallback and is what `transportTool.js` and the route call. A missing/invalid `departureDate` degrades straight to sample with `fallbackReason: 'invalid_date'` — there's no meaningful cache for a query that was never valid.

**Round trip** — genuinely supported via Amadeus's own `returnDate` parameter (never combined from two unrelated one-way responses, per the checkpoint's explicit constraint). A round-trip offer's normalized `price` is the whole-itinerary total exactly as Amadeus returns it (not split or doubled); `returnDeparture`/`returnArrival`/`returnDurationHours`/`returnStops` describe the return leg alongside the existing outbound fields.

**Flight status** — not implemented. Amadeus's flight-offers search endpoint doesn't return live operational status (that's a separate Amadeus product, "On Demand Flight Status," not part of the R1-selected credential pair/scope); every normalized flight honestly reports `status: null` rather than inferring one.

**TransportAgent / transportTool integration** — `tools/transportTool.js` is now async and calls `flightsService.getFlights()` for the `flight` mode specifically; bus/train/cab stay sample data (R6/future work — out of R5 scope, same as R3 left non-hotel categories alone). All sample options (not just flights) are now passed through `normalizeSampleTransport()` so every transport option, real or sample, shares one canonical shape. Scoring treats an unknown price/duration as neutral rather than fabricating or penalizing it (same principle as R4's hotel scoring). `agents/TransportAgent.js` now `await`s the call and passes `intent.startDate` as `departureDate`; `agents/Agent.js` already awaited `execute()` generically, so no orchestrator change was needed. Confirmed end-to-end against a live `/api/ai/plan` run (sample fallback, since no real key is configured in this environment) — `finalPlan.transport` comes back fully scored with `status: null`, `bookingUrl: null`.

**Caching**: existing `cacheStore` / `provider_cache` table; reuses the `flights` TTL (30 min — pricing-sensitive) already present from R1, plus a new `airports` TTL (30 days, same value as `cities` but its own key) in `cacheDurations.js`.

**Booking**: unchanged from R4's reasoning — flights reached via search are *browsable* information, not a confirmed reservation or ticket. `bookingUrl` stays `null` since Amadeus's test environment doesn't supply one; there is nothing to hand off to for external booking, and AtlasAI never claims to have booked a flight.

**Frontend integration** — `services/api.js` gained `searchFlights(destination, { origin, departureDate, returnDate, limit })`. `pages/Reservations.jsx`'s Flight tab now fetches from `/api/flights/search` (default destination "Manali", default departure date 30 days out, with destination + date inputs to search others) instead of reading `data/mockData.js` directly — same loading/error/empty/source-badge states as R4's Hotel tab ("Searching flights…", "Flight provider temporarily unavailable — showing sample listings.", Live/Cached/Sample data badge). A flight with no known price shows "Price on request" instead of a fabricated ₹0. The other three tabs (Trains/Buses/Rentals) are untouched, per R5 scope. `data/mockData.js`'s flight list is kept as the last-resort fallback if the request itself fails outright (network/auth), same reasoning as R4.

**Tests** (`cd backend && npm test`, 110 tests total, all mocked — no live API calls): `test/flightsService.test.js` (no credentials → sample with `not_configured`; missing/malformed/past departure date never reaches the provider; known origin/destination resolve for free; a bare IATA code is used as-is; an unlisted city resolves via Amadeus city search; second identical call served from cache; a different departure date is a cache miss; round-trip `returnDate` is genuinely passed through and reflected in the normalized `tripType`/return fields; a `returnDate` before `departureDate` is rejected without a provider call; city search with no results falls back to sample; auth and rate-limit failures both trip the breaker; a stale-cache serve after a later provider failure returns the last good answer, not a fabricated one; a malformed offer is never cached or presented as live; an offer with no price is never given a fabricated one). `test/transportTool.test.js` (sample fallback fully scored for a known destination; missing departure date still returns sample rather than failing; a live flight offer replaces the sample flight option while other modes stay sample; a provider failure keeps the sample flight option instead of dropping the mode entirely; an over-budget option scores worse than one within budget). `test/flights.api.test.js` (auth required; required-field/date-format/enum validation; graceful sample response with no credentials; live response with no credential/URL leak; cache hit on a second identical request; upstream errors sanitized; optional round-trip `returnDate`). `test/support/amadeusFixtures.js` gained a `flightOffersOk()` fixture and routes `/v2/shopping/flight-offers` in the same mock-fetch style as R4's hotel fixtures. `test/security.test.js` gained an assertion that the flight normalizer always sets `bookingUrl: null` / `status: null`; the existing "only `config/env.js` + `providers/amadeusProvider.js` read the raw Amadeus credential" scan was re-verified against all of `backend/src` including the new files (still passes — `flightsService.js`/`transportTool.js`/`flights.routes.js` only ever call `amadeusProvider.isConfigured()`/`searchFlights()`, never touch the raw key/secret). Frontend: `npm run lint` (0 errors — 10 warnings, one new `set-state-in-effect` warning of the same pre-existing style R4 already noted, e.g. `Admin.jsx`, plus R4's own hotel-effect warning) and `npm run build` pass.

**Security**: same posture as R4 — `AMADEUS_API_KEY`/`AMADEUS_API_SECRET` read only by `config/env.js` and `providers/amadeusProvider.js`; never logged; never in a response body; never in the frontend bundle; `/api/flights/search` requires auth and rate-limits separately from `/api/hotels/search`.

**Live-provider verification**: not exercised against the real Amadeus test API in this environment (no credentials/network available in the build sandbox). Request/response shapes follow Amadeus's documented `/v2/shopping/flight-offers` API and are covered by mocked fixtures modelled on those docs. A full local smoke test (register → `GET /api/flights/search` → `POST /api/ai/plan` with `transportPreference: "flight"`) was run against the running dev server in this environment with no credentials configured, confirming the sample fallback path end-to-end (`dataSource: "sample"`, `fallbackReason: "not_configured"`) and that R1–R4 endpoints (`/api/hotels/search`, `/api/attractions`) remain unaffected. **Before relying on live data**: put `AMADEUS_API_KEY=<your key>` and `AMADEUS_API_SECRET=<your secret>` in `backend/.env` (same pair already used for hotels), restart, confirm the startup log says `live — flights`, then call `GET /api/flights/search?destination=Manali&departureDate=<a future date>` with your login token — a second identical call should report `cached`.

**Limitations**
- Not yet exercised against the real Amadeus API (see above) — mocked-only verification.
- No `GET /api/flights/:id` endpoint — deliberately skipped as redundant (see above), not missing.
- No flight status — Amadeus's flight-offers search doesn't provide it; every flight reports `status: null` (see above).
- Children/infants passenger counts are not exposed — AtlasAI's own trip-intent model only has a single `travellers` headcount, with no child/infant distinction to map Amadeus's `children`/`infants` parameters onto; adding that would be a trip-intent model change, out of R5's scope.
- Currency is not explicitly requested from Amadeus (no `currencyCode` param sent) — the test environment's default currency is used as-is and labeled from the response, to avoid an unverified assumption about which currencies the test tier actually supports.
- The static known-airport map (`delhi`/`manali`/`goa`/`jaipur`/`mumbai`) only covers AtlasAI's fixed sample origin plus its three bundled sample destinations; every other destination depends on Amadeus's city search succeeding, which the sandbox can't verify live yet.
- Bus/train/cab transport modes are still 100% sample data — untouched, reserved for R6 (trains) and beyond.
- Circuit-breaker and cache are per-process (same as R2/R3/R4).

### R6 — Trains (RailRadar) + Weather (OpenWeatherMap) — COMPLETE

Status of R1–R6: **all complete** (R7 was completed afterwards — see the R7 section below).

```
TransportAgent ─► tools/transportTool.js ─► services/trainsService.js ─► providers/railProvider.js ─► RailRadar (api.railradar.in/v1)
GET /api/trains/* ────────────────────────────┘        │                                                 │
                                                SQLite TTL cache (cacheStore)                     trainNormalizer
                                                        └─► sample fallback (search only; status/fare/seats -> unavailable)

SafetyAgent ─► tools/safetyTool.js ──┐
SynthesisAgent ─► tools/itineraryTool.js ─┼─► services/weatherService.js ─► providers/openWeatherMapProvider.js ─► OpenWeatherMap
GET /api/weather/* ──────────────────┘        │                                                                   │
                                        SQLite TTL cache                                                    weatherNormalizer
                                                └─► stale cache -> unavailable (NO sample weather, ever)
```

**Environment variables** — no new ones. `TRAINS_API_KEY` (RailRadar, bearer token) and `WEATHER_API_KEY` (OpenWeatherMap) were already reserved in R1; `TRAINS_API_KEY` is now actually used. Read only by `config/env.js` + `providers/railProvider.js` (trains) and `config/env.js` + `providers/openWeatherMapProvider.js` (weather) — enforced by `test/security.test.js`.

#### Trains

**Provider** (`providers/railProvider.js`, previously a stub) — official RailRadar REST API, base `https://api.railradar.in/v1`, `Authorization: Bearer <key>`. Supported capabilities (all genuine documented endpoints, none invented):
- `searchStations(q)` → `GET /lookup/search/stations` (resolves a city/station name to a station code)
- `trainsBetween(from, to, {date,type,category,byCity,live})` → `GET /trains/between/{from}/{to}` (`live=true` is only sent when a journey date is given)
- `getTrainStatus(number, {date})` → `GET /trains/{number}/live`
- `getFare(number, {source,destination,journeyDate,classCode,quotaCode})` → `GET /trains/{number}/fare`
- `getSeatAvailability(...)` → `GET /trains/{number}/seats`
Not implemented: train details/timetable (`GET /trains/{number}`) — the between-stations search already returns schedule, duration, distance and halt count, so a separate details call was skipped as redundant for R6.

**Normalized model** (`normalizers/trainNormalizer.js`) — `{ id, mode:'train', provider, trainNumber, trainName, trainType, from, to, departure, arrival, durationHours, distanceKm, stops, runDays, status, delayMinutes, platform, price, currency:'INR', dataSource, cached, bookingUrl }`, shape-compatible with flights so `transportTool` scoring is unchanged. Separate normalizers for live status, fare, seat availability and stations. Provider response shapes never leave the normalizer.

**Honesty rules (TRAIN EXISTS ≠ RUNNING ≠ SEATS AVAILABLE ≠ BOOKED)**
- `bookingUrl` is always `null`; RailRadar is a data API, not ticketing. AtlasAI never claims a train was booked. Selecting a train in the UI creates an AtlasAI reservation record only (same as flights/hotels).
- Search results carry `price: null` — RailRadar's search returns no fare. UI shows "Price on request". Fares come only from `/fare`.
- `status`/`delayMinutes`/`platform` are populated only from RailRadar's live enrichment (requested only when a date is given); never inferred from scheduled times.
- Live status, fare and seat availability have **no sample fallback** — they return `dataSource:'unavailable'` rather than fabricate.

**Endpoints** (login required, dedicated 60 req / 15 min limiter, same shape as flights):
- `GET /api/trains/search?destination=<name>[&origin=Delhi][&date=YYYY-MM-DD][&limit=]` → `{ query, origin, date, trains, count, dataSource, provider, fallbackReason, stale? }`
- `GET /api/trains/:number/status[?date=]` → `{ trainNumber, status, dataSource, provider, fallbackReason, stale? }`
- `GET /api/trains/:number/fare?source=&destination=&journeyDate=&classCode=[&quotaCode=GN]` → `{ trainNumber, fare, ... }`
- `GET /api/trains/:number/seats?...same params` → `{ trainNumber, availability:{days:[{date,status}]}, ... }`
Invalid dates/class codes are rejected with 400 before any provider call. A journey date is optional for search (RailRadar's schedule search works without one).

**Service** (`services/trainsService.js`, previously a stub) — same shape as `flightsService`. Station resolution: static map (`delhi→NDLS`, `mumbai→CSTM`, `goa→MAO`, `jaipur→JP`) → bare uppercase 2–5 letter code used as-is → RailRadar station search (cached 30 days) → sample fallback. Search fallback: fresh cache → provider → stale cache → sample. Status/fare/seats: fresh cache → provider → stale cache → unavailable. Circuit breaker: auth failure = 5 min, rate limit = 1 min.

**Cache TTLs** (`services/cacheDurations.js`): `trains` 30 min, `stations` 30 days, `trainStatus` 2 min, `trainDetails` (fare/seats) 5 min. Search cache key includes origin, destination, date, type, category. Cached/stale results are labelled `dataSource:'cached'` (+ `stale:true`) — never presented as live.

**TransportAgent integration** — `tools/transportTool.js` now looks up flights and trains concurrently (`Promise.all`, one shared deadline). Live/cached trains replace the sample `train` option(s); `bus`, `cab` and composite `train+cab` stay sample. TransportAgent itself was not changed and never calls RailRadar directly.

**Frontend** — `services/api.js`: `searchTrains`, `getTrainStatus`, `getCurrentWeather`, `getWeatherForecast`. `pages/Reservations.jsx` Train tab now searches `/api/trains/search` (default Jaipur, date 30 days out) with the same states as Flights/Hotels: "Searching trains…", "Train provider temporarily unavailable — showing sample listings.", "Showing cached train data.", "No trains found.", Live/Cached/Sample badge. Buses/Rentals untouched.

#### Weather

**Provider selected**: OpenWeatherMap (R1 decision, unchanged — no new provider introduced). Free tier.

**Provider** (`providers/openWeatherMapProvider.js`) — `getForecast` (existing, 5-day/3-hour, folded to daily) plus new `getCurrentWeather` → `/data/2.5/weather`. Both now propagate `errorType` so the service can tell rate-limit/timeout/auth apart.

**Normalized models** (`normalizers/weatherNormalizer.js`) — forecast day `{ date, tempMinC, tempMaxC, condition, description, icon, precipitationChancePct, dataSource, provider, cached }` (existing) and new current-weather `{ tempC, feelsLikeC, condition, description, icon, humidityPct, windSpeedKmh (m/s→km/h), visibilityKm, observedAt, dataSource, provider, cached }`.

**Service** (`services/weatherService.js`) — `fetchForecast` and new `fetchCurrent`: fresh cache → provider → stale cache → **unavailable**. There is deliberately no sample weather: a fabricated reading is worse than none. Added the same circuit breaker as other services. TTL: `weather` 1 hour (current and forecast cached under separate keys).

**Endpoints** (login required, 60 req / 15 min): `GET /api/weather/current?destination=<name>` and `GET /api/weather/forecast?destination=<name>`. An unavailable provider returns HTTP 200 with `dataSource:'unavailable'` (weather is optional context, never a hard failure). Lookup is by destination name — the existing pipeline is name-based; coordinate lookup was not added. Forecast range is whatever OpenWeatherMap's free tier returns (~5 days); nothing is extrapolated.

**Agent / itinerary integration** (minimal, no new agent)
- `tools/safetyTool.js` (now async) → `SafetyAgent`: when a real current reading exists, `weatherNote` becomes e.g. "Currently 18°C, scattered clouds in Manali." (adds "(recently cached reading)" when cached) and a `weather` object is attached; otherwise the original static sample note is used unchanged and `weather` is `null`. The existing `InsightsPanel.jsx` displays it with no frontend change.
- `tools/itineraryTool.js` `buildDays` gained an optional `destination`; forecast is fetched once per trip and each day gets `weather` (its matching forecast day, or `null`). `SynthesisAgent` passes `intent.destination`. `components/itinerary/DayTabs.jsx` shows "min–max°C condition" under the date when present.
- No weather-based recommendations are generated — weather is supplied as factual context only.

#### Testing
`cd backend && npm test` → **166 tests, all passing**, all mocked (`global.fetch` replaced; no live API calls, no credentials needed). New: `test/trainsService.test.js` (17), `test/weatherService.test.js` (9), `test/trains.api.test.js` (9), `test/weather.api.test.js` (6), `test/safetyTool.test.js` (3); extended: `transportTool.test.js` (+3 train cases), `itineraryTool.test.js` (+2 weather cases), `security.test.js` (RailRadar + weather credential isolation, no key logging, `bookingUrl:null`/`price:null`, no fabricated weather — replaces the old "RailRadar not implemented yet" assertion). Fixtures: `test/support/railRadarFixtures.js`, `test/support/owmFixtures.js`. Backend lint: 0 warnings. Frontend: `npm run lint` 0 errors (11 warnings, one new `set-state-in-effect` in the Train effect, same pre-existing style as Flights/Hotels); `npm run build` passes.

#### Verification status
- Mocked provider verification: **done** (adapters, normalization, services, API, tool/agent/itinerary integration).
- Local smoke test on a running backend with no credentials: register → `/api/trains/search` (sample, `not_configured`), bad date (400), `/api/trains/:n/status` (unavailable), `/api/weather/current` + `/forecast` (unavailable), no-auth (401) — all as designed.
- **Live provider verification requires configured credentials and was NOT performed** (no keys/network in the build sandbox). RailRadar request/response shapes follow its published docs at railradar.in/docs; field names such as `avlDayList`/`availablityDate` are copied from those docs, so confirm them against a real response. To verify: put `TRAINS_API_KEY` / `WEATHER_API_KEY` in `backend/.env`, restart, then call `GET /api/trains/search?destination=Jaipur&date=<future date>` and `GET /api/weather/current?destination=Manali`; a repeat call should report cached/served-from-cache.

#### Files
Created: `backend/src/routes/trains.routes.js`, `backend/src/routes/weather.routes.js`, `backend/test/{trainsService,weatherService,trains.api,weather.api,safetyTool}.test.js`, `backend/test/support/{railRadarFixtures,owmFixtures}.js`.
Modified: `backend/src/providers/{railProvider,openWeatherMapProvider}.js`, `backend/src/normalizers/{trainNormalizer,weatherNormalizer}.js`, `backend/src/services/{trainsService,weatherService,cacheDurations}.js`, `backend/src/tools/{transportTool,safetyTool,itineraryTool}.js`, `backend/src/agents/{SafetyAgent,SynthesisAgent}.js`, `backend/src/routes/index.js`, `backend/src/config/env.js` (comment only), `backend/.env.example` (comment only), `backend/test/{transportTool,itineraryTool,security}.test.js`, `travel-planner/services/api.js`, `travel-planner/pages/Reservations.jsx`, `travel-planner/components/itinerary/DayTabs.jsx`, `SETUP.md`.
No database/schema changes; train and weather data is cache-only (`provider_cache`).

#### Limitations
- Live RailRadar/OpenWeatherMap not exercised (see above).
- No train timetable/details endpoint and no train UI for status/fare/seats yet (endpoints exist; only search is in the UI).
- Live-status enrichment only requested when a journey date is given; RailRadar's free tier (1,000 req/month) is easy to exhaust — caching mitigates but doesn't eliminate.
- Static station map covers only Delhi/Mumbai/Goa/Jaipur; anything else (e.g. Manali, which has no nearby mainline station) depends on RailRadar station search and may fall back to sample.
- Train fares are never shown in search results (separate `/fare` call needed); the transport scorer treats unknown price as neutral.
- Weather is name-based, ~5-day forecast, no dedicated weather page; the only weather UI is the safety note and the per-day line in itinerary tabs.
- Circuit breaker and cache are per-process (same as R2–R5).

#### What R7 should do
Broader agent integration: make ActivityAgent/planning logic actually *use* weather (e.g. reschedule outdoor stops), use train fare/seat/status data inside TransportAgent scoring and recommendations, add a train fare/status UI, and audit that the whole real-data ecosystem (attractions, maps, hotels, flights, trains, weather) is consumed consistently by the agents. *(Historical note written at the end of R6 — R7 has since been completed; see below.)*

Each checkpoint's chat report has the full specifics: files touched, tests run, and findings for that piece.

### Checkpoint status

R1 COMPLETE
R2 COMPLETE
R3 COMPLETE
R4 COMPLETE
R5 COMPLETE
R6 COMPLETE
R7 COMPLETE
**Next checkpoint: R8 (frontend integration). Do not start R9/R10 before R8.**

## Real Data Integration — R7

R7 made the **existing** agents consume the R2–R6 normalized real data correctly. No new provider, no new agent, no runtime rewrite, no DB/schema change, no frontend change (the frontend contract is only *extended* with additive fields).

### Architecture (Agent → Tool → Service → Provider)

```
Trip request
  └► IntentAgent  (destination, dates, checkIn/checkOut/returnDate, rooms, dateIssues)
        ├► TransportAgent ─► transportTool ─┬► flightsService ─► amadeusProvider ─► Amadeus (test env)
        │                                    └► trainsService  ─► railProvider   ─► RailRadar (+ per-train fare)
        ├► StayAgent      ─► hotelTool     ─► hotelsService  ─► amadeusProvider ─► Amadeus (test env)
        └► ActivityAgent  ─► attractionTool ─► attractionsService ─► OpenTripMap
                          ─► routeTool     ─► mapsService     ─► OpenRouteService
                          ─► weatherTool   ─► weatherService  ─► OpenWeatherMap   (run-shared, see below)
  ► SafetyAgent   ─► safetyTool (+ shared weather ctx, measured routes, selected transport status)
  ► BudgetAgent   ─► budgetTool (components carry amount + source state)
  ► CriticAgent   ─► structured outputs only (no provider access)
  ► ReplanningAgent (rerun list via the existing Orchestrator loop)
  ► SynthesisAgent ─► itineraryTool.buildPlan (arrival-aware schedule, weather advisories, real route legs)
```
Orchestration order (in `agents/Orchestrator.js`): Intent → [Transport ‖ Stay ‖ Activity] → Safety → Budget → Critic → (Replanning → reruns → Safety refresh if transport/activities changed → Budget → Critic)×≤2 → Synthesis. Safety moved from the parallel group to *after* the specialists because it now reads the selected transport, measured routes and weather. Enforced by `test/agentsRealData.api.test.js`: agents/tools never import `providers/`, call `fetch`, or read credentials; agents never import services.

### Which agent uses which real data
| Agent | Tools | Real data consumed |
|---|---|---|
| Intent | – | dates validated (`end_before_start` etc. reported, never repaired), `rooms` (assumed = ceil(travellers/2) unless given, flagged `roomsAssumed`), `returnDate` |
| Activity | attractionTool, routeTool, weatherTool | OpenTripMap places (name/coords/category/rating; `openingHours` explicitly `unavailable`), measured legs between coordinated stops, forecast facts (wet dates, outdoor count); `preferIndoor` re-ranking after replanning |
| Stay | hotelTool | Amadeus hotels: nightly price × nights × rooms; listing ≠ availability ≠ booking (`availability:'not_verified'`, `bookingStatus:'not_booked'`) |
| Transport | transportTool | Amadeus flights + RailRadar trains searched concurrently; round-trip fare requested when a return date exists; per-train fare fetched for the top live train (disclosed default class `3A`/`GN`, `fareBasis.assumedClass`); replanning `excludeTransportModes` |
| Safety | safetyTool | shared weather context, measured route totals, selected train status — reported as facts (`forecastNotes`, `routeNotes`, `transportNotes`); **no verdicts** (rain ≠ unsafe) |
| Budget | budgetTool | per-component amount + state; unavailable prices are `null`, never 0 |
| Critic | – | missing components, arrival vs trip window, measured travel, weather exposure, stale/unavailable data, lower-bound budgets |
| Replanning | – | new change types map onto existing reruns (below) |
| Synthesis | itineraryTool | everything above; adds `sourceStatus`, `dataCompleteness`, `dataNotes`, `weatherAdjustments`, `unscheduledActivities`, `arrival`, `bookingDisclaimer` |

### New files
`agents/sourceStatus.js` (shared vocabulary: `live | cached | estimated | sample | unavailable`, `makeSource`, `weakestState`, `safeErrorReason`), `agents/realData.js` (run-shared `ensureWeather`, progress helper), `tools/weatherTool.js`, `tools/routeTool.js`, tests `test/agentsRealData.test.js`, `test/realDataTools.test.js`, `test/agentsRealData.api.test.js`, `test/support/realDataHarness.js`.

### Shared context (extended, not replaced)
`AgentContext.state` gained `weather`, `routes`, `sources`; `context.once(key, fn)` memoises a provider-backed lookup per run (weather is fetched once and reused by Activity, Safety and Synthesis — verified: 1 forecast + 1 current call per plan). `context.adjustments` gained `excludeTransportModes`, `excludeStayIds`, `preferIndoor`. Only normalized facts are stored (forecast capped to 6 days); no raw provider payloads are persisted beyond the existing `provider_cache`.

### Source-status propagation
Provider → service (`dataSource`, `fallbackReason`, `stale`) → tool (`makeSource`) → agent `data.source(s)` and `context.state.sources` → `finalPlan.sourceStatus` = `{ attractions, hotels, flights, trains, trainFare, routes, weather, budget }`, each `{ state, provider, fallbackReason, stale? }`. Legacy `finalPlan.dataSource` / `finalPlan.sources` keep their shape and meaning: `dataSource` is `live`/`cached` only when transport, stay and activities are all real; **any sample or unavailable core component ⇒ `'sample'`** (the frontend only special-cases `'sample'`, so partial plans are never shown as live). `dataCompleteness` (`complete|partial`) and `unavailableComponents` say what is missing.

### Fallback / failure behaviour
- Tools never throw for provider problems; services already return cache/sample/unavailable. The orchestrator additionally wraps every specialist in `settle()`: a crashing agent becomes an error-status result (sanitized reason: URLs/tokens stripped, ≤160 chars, no stack) and planning continues; the Critic reports `missing_transport`/`missing_stay`; Replanning retries.
- Weather unavailable ⇒ plan generated, per-day `weather: null`, `weatherStatus:'unavailable'`, note in `dataNotes`. Hotels/flights/trains unavailable ⇒ labelled sample options (as R4–R6). Routes unavailable ⇒ `travelToNext: null` + fixed buffer (as R3).
- `Agent.run`, the retry trace and the SSE `error` event now sanitize error text (found in R7: raw `err.message` — possibly containing a URL — reached the trace/SSE).
- Retries: unchanged (orchestrator: 1 retry, 8 s budget); services keep their circuit breakers (auth 5 min / rate-limit 1 min); no new retry loops.

### Replanning (existing loop, three new triggers)
`find_alternative_transport` (no transport, or arrival after trip end) → excludes the failed mode, reruns Transport; `find_alternative_stay` → excludes the failed hotel id, reruns Stay; `adjust_for_weather` (≥50 % of forecast trip days wet **and** ≥50 % outdoor activities; once only) → `preferIndoor`, reruns Activity. Existing `find_cheaper_option` etc. unchanged. An exclusion never removes the last remaining option.

### Budget rules
Component = `{ amount|null, state, note, coverage?, unknownItems? }`. `null` (unavailable) is listed in `budget.unavailable`, the total becomes a **lower bound** (`isLowerBound`), and `fitsBudgetConfirmed` is never true for a lower bound. Amadeus flight offers are **party totals** (`priceBasis:'party_total'`, not multiplied by travellers); sample prices and train fares are per person (multiplied). Hotel = per-room-per-night × nights × rooms. Non-INR provider prices are **not converted** (no conversion service exists): `totalPrice:null`, original kept in `priceOriginal`. Flight/train fares cover the outbound journey unless the provider returned a return itinerary (`coverage`); the return leg is never priced by doubling. Food/local travel/contingency stay AtlasAI allowances (`estimatedItems`). Live attractions without prices are counted via `unknownCostCount`, not as free. Legacy `breakdown.*` numbers are still present for the UI (an unavailable component shows 0 there — check `components`/`unavailable`).

### Date/time consistency
Amadeus times are airport-local; the normalizer now reads clock/date from the string (no server-timezone shift), adds `departureDate`/`arrivalDate`, and uses the provider's ISO duration for elapsed time. RailRadar's day numbers give `arrivalDayOffset`. `resolveArrival()` yields the arrival day/time **only from real provider data** (sample schedules are undated, so they never shift the itinerary). `buildPlan` schedules nothing before arrival + 1.5 h buffer, turns pre-arrival days into `travelDay`, carries overflow to later days and reports anything unplaceable in `unscheduledActivities`. Critic flags arrival after the trip ends (high), late day-1 arrival and unused pre-arrival nights (low).

### Weather integration
Facts only. Forecast wet threshold = provider precipitation chance ≥ 60 % (`WET_DAY_PRECIP_PCT`). Itinerary building moves outdoor activities from a wet day to a day ≥20 points drier (only when ≥2 forecast days exist; recorded in `weatherAdjustments`); otherwise outdoor stops get a `weatherAdvisory` annotation. Trip days outside the provider's ~5-day window are not extrapolated (`weatherStatus:'outside_forecast_range'`).

### LLM
LLM output is explanatory text only. `RuleBasedProvider` templates no longer print `NaN`/`null` for unavailable price/rating/duration. The optional Ollama provider prefixes every prompt with a no-fabrication guard and sends only slimmed planning fields (`slimForPrompt`: no addresses, URLs, images, coordinates, credentials, user data).

### SSE progress
Existing trace/SSE unchanged; extra `running` events with summaries: "Searching attractions…", "Finding accommodations…", "Searching flights and trains…", "Checking weather…", "Calculating routes…" (the loader's per-agent collapse shows them as the agent's current step).

### Tests (`cd backend && npm test` → 223 pass, all mocked; `npm run lint` → 0 warnings)
`agentsRealData.test.js` — Scenarios A (normal), B (flights down), C/C2 (hotels down / stay agent crash), D (RailRadar down), E (weather down), F (multiple down), G (hotel price unavailable), H/H2 (transport changes during replanning / arrival after trip end), progress events, no duplicate provider calls, zero-keys regression, date issues. `realDataTools.test.js` — source vocabulary, budget maths, pricing basis/currency/fare enrichment, weather/route tools, safety facts, timezone-safe normalization, arrival-aware scheduling, weather moves, Critic/Replanning units, LLM behaviour. `agentsRealData.api.test.js` — full HTTP `/ai/plan` and `/ai/plan/stream` flows with all providers mocked (no credential/URL leaks), all-providers-failing plan, and static architecture checks (agents/tools never import providers, call `fetch` or read keys). Frontend: `npm run lint` 0 errors (11 pre-existing warnings), `npm run build` passes (no frontend files changed in R7).

### Verification status
- Mocked end-to-end verification: **done**. Local smoke test on a running backend with **zero provider keys** (register → `/api/ai/plan` → `/api/ai/plan/stream`): plan completes, everything labelled `sample`/`unavailable`, progress events streamed, no secrets in output.
- **Live provider verification was NOT performed** (no credentials/network in the build sandbox). Live behaviour of R2–R6 providers is still unverified against the real services; nothing was fabricated to claim otherwise.

### Known limitations
- Live provider shapes (OpenTripMap, ORS, Amadeus test env, RailRadar, OpenWeatherMap) still only verified against mocked fixtures.
- Amadeus test-environment data is synthetic; RailRadar's free tier is small — each plan can now cost 1 fare call in addition to the search.
- Train fare uses a *disclosed assumed class* (3A/GN) because the trip intent has no class field; fares for other trains in the list stay unavailable.
- Transport search origin is still fixed to Delhi (sample-data convention); intent `origin` is not yet used for provider searches.
- Return legs are not priced separately (outbound-only coverage is flagged); no currency conversion service; hotel `rooms` is assumed from party size unless given; no opening-hours data (OpenTripMap has none).
- Hotel→attraction and station/airport→hotel routing is not wired (hotel coordinates exist but the itinerary has no hotel stop).
- Bus/cab/rail+cab remain sample-only. Weather is name-based with ~5-day range.
- Circuit breakers, `context.once` memo and caches are per-process.
- `finalPlan.budget.breakdown.<component>` shows 0 for an unavailable component (legacy shape) — the UI renders `unavailable`/`isLowerBound`/`sourceStatus` as of R8.

### Files
Created: see "New files". Modified: `backend/src/agents/{Agent,AgentContext,IntentAgent,ActivityAgent,TransportAgent,StayAgent,BudgetAgent,SafetyAgent,CriticAgent,ReplanningAgent,SynthesisAgent,Orchestrator}.js`, `backend/src/tools/{transportTool,hotelTool,budgetTool,safetyTool,attractionTool,itineraryTool}.js`, `backend/src/normalizers/{flightNormalizer,trainNormalizer}.js`, `backend/src/llm/{RuleBasedProvider,LocalOllamaProvider}.js`, `backend/src/routes/ai.routes.js`, `backend/src/services/providerRegistry.js` (stale label), `backend/test/attractionTool.test.js` (uses a real `AgentContext`), `SETUP.md`.

### R8 — Frontend real-data integration (complete)

**Goal**: Connect the existing frontend to R7's backend fields so every data-source state, budget nuance, and planning note is visible to the user.

**Changes**:

| File | What changed |
|------|-------------|
| `travel-planner/components/itinerary/BudgetPanel.jsx` | Shows `isLowerBound` indicator, `unavailable` component list, per-category source-status dots (live/cached/sample/unavailable), and lower-bound explanation banner. |
| `travel-planner/components/OrchestratorPanel.jsx` | Displays per-provider source-status pills (Attractions, Hotels, Flights, Trains, Routes, Weather), `dataCompleteness` partial-data notice, `dataNotes` from synthesis, `bookingDisclaimer`. |
| `travel-planner/components/itinerary/OverviewPanel.jsx` | Source status tags on Transport/Stay/Activities cards, arrival info card, data-completeness card, lower-bound budget label. |
| `travel-planner/components/itinerary/InsightsPanel.jsx` | Renders `dataNotes`, `weatherAdjustments` (moved activities), `unscheduledActivities`, expanded safety notes, `bookingDisclaimer`. |
| `travel-planner/pages/Itinerary.jsx` | Arrival time in header, `isLowerBound` budget pill, overall `dataSource` badge (Live/Cached/Sample), `bookingDisclaimer` text. |
| `travel-planner/pages/Reservations.jsx` | Bus and Rental tabs show a "Sample data — no live provider" banner. |
| `travel-planner/components/Navbar.jsx` | Quick-search now queries real user trips (`api.listTrips`), real bookings (`api.listBookings`), and backend destinations (`api.searchDestinations`) with 300ms debounce instead of static `mockData.js`. |
| `travel-planner/services/api.js` | Added missing `submitFeedback` method (was called by `Feedback.jsx` but not defined). |
| `backend/test/security.test.js` | Cross-platform `relPath()` helper for Windows path separators (R7 fix, carried into R8). |

**What remains mock / local-only** (by design, no backend endpoint exists):
- `data/mockData.js` — still imported by `Reservations.jsx` (bus/rental fallback) and `ExpenseContext.jsx` (expense seeding). The file is not deleted because buses/rentals have no backend provider and expenses are local-only.
- `ExpenseContext.jsx` — expenses are localStorage-only with mock seed data. No expense backend exists.
- `Attractions.jsx` "Add to itinerary" — sets local UI state only; does not persist to an active itinerary.

**Build verification**:
- Backend tests: 223/223 pass, 0 fail
- Backend lint: 0 warnings, 0 errors
- Frontend lint: 0 errors, 12 warnings (all pre-existing `set-state-in-effect` pattern + 1 from new Navbar debounce)
- Frontend build: ✅ passes (1.04s, 377 KB JS)

### R9 & R10 — Hardening & Final Release (complete)
- **Security:** API keys and tokens are securely redacted from error logs before bubbling up to users. `req.body` destructuring is validated in AI routes to prevent crashes.
- **Validation:** Added robust date-range checking and input sanitization for flights and AI plan streams.
- **Failures:** Fallback responses for malformed or missing-key states are explicitly typed rather than silently masked.
- **Caching:** Cache keys explicitly filter `undefined` values to prevent missed cache hits.

**All Real-Data Integration milestones (R1–R10) are complete.**
