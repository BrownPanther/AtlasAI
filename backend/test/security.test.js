import './support/setup.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'dist', 'data', '.git'].includes(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else out.push(full)
  }
  return out
}

/** Normalize Windows backslashes to forward slashes so assertions are cross-platform. */
const relPath = (f) => path.relative(root, f).replaceAll('\\', '/')

test('.env.example holds only an empty ATTRACTIONS_API_KEY placeholder', () => {
  const text = fs.readFileSync(path.join(root, 'backend/.env.example'), 'utf8')
  assert.match(text, /^ATTRACTIONS_API_KEY=$/m)
})

test('frontend never references provider keys or VITE_-prefixed secrets', () => {
  const files = walk(path.join(root, 'travel-planner')).filter((f) => /\.(jsx?|html|json|css)$/.test(f) && !f.endsWith('package-lock.json'))
  for (const f of files) {
    const text = fs.readFileSync(f, 'utf8')
    assert.doesNotMatch(text, /ATTRACTIONS_API_KEY|opentripmap\.com\/0\.1|VITE_[A-Z_]*(KEY|SECRET)/, `${path.relative(root, f)} must not reference provider credentials`)
  }
})

test('backend source never logs the key value', () => {
  const files = walk(path.join(root, 'backend/src')).filter((f) => f.endsWith('.js'))
  for (const f of files) {
    const text = fs.readFileSync(f, 'utf8')
    assert.doesNotMatch(text, /console\.(log|warn|error|info)\([^)]*(attractionsApiKey|ATTRACTIONS_API_KEY)/, path.relative(root, f))
  }
})

test('only the OpenTripMap provider reads the attractions key', () => {
  const offenders = walk(path.join(root, 'backend/src')).filter((f) => f.endsWith('.js') && /attractionsApiKey/.test(fs.readFileSync(f, 'utf8')))
  const rel = offenders.map((f) => relPath(f)).sort()
  assert.deepEqual(rel, ['backend/src/config/env.js', 'backend/src/providers/openTripMapProvider.js'])
})

test('.env.example holds only empty AMADEUS_API_KEY / AMADEUS_API_SECRET placeholders', () => {
  const text = fs.readFileSync(path.join(root, 'backend/.env.example'), 'utf8')
  assert.match(text, /^AMADEUS_API_KEY=$/m)
  assert.match(text, /^AMADEUS_API_SECRET=$/m)
})

test('frontend never references Amadeus credentials', () => {
  const files = walk(path.join(root, 'travel-planner')).filter((f) => /\.(jsx?|html|json|css)$/.test(f) && !f.endsWith('package-lock.json'))
  for (const f of files) {
    const text = fs.readFileSync(f, 'utf8')
    assert.doesNotMatch(text, /AMADEUS_API_KEY|AMADEUS_API_SECRET|amadeusApiKey|amadeusApiSecret/, `${path.relative(root, f)} must not reference Amadeus credentials`)
  }
})

test('backend source never logs the Amadeus key/secret value', () => {
  const files = walk(path.join(root, 'backend/src')).filter((f) => f.endsWith('.js'))
  for (const f of files) {
    const text = fs.readFileSync(f, 'utf8')
    assert.doesNotMatch(text, /console\.(log|warn|error|info)\([^)]*(amadeusApiKey|amadeusApiSecret|AMADEUS_API_KEY|AMADEUS_API_SECRET)/, path.relative(root, f))
  }
})

test('only the Amadeus provider, hotels/flights services and env read the Amadeus credentials', () => {
  const offenders = walk(path.join(root, 'backend/src')).filter((f) => f.endsWith('.js') && /amadeusApiKey|amadeusApiSecret/.test(fs.readFileSync(f, 'utf8')))
  const rel = offenders.map((f) => relPath(f)).sort()
  assert.deepEqual(rel, ['backend/src/config/env.js', 'backend/src/providers/amadeusProvider.js'])
})

test('hotel search responses never carry a booking URL or claim live availability (Amadeus test-environment data)', () => {
  const normalizer = fs.readFileSync(path.join(root, 'backend/src/normalizers/hotelNormalizer.js'), 'utf8')
  assert.match(normalizer, /liveAvailability:\s*false/)
  assert.match(normalizer, /bookingUrl:\s*null/)
})

test('flight search responses never carry a booking URL or a live operational status (Amadeus test-environment data)', () => {
  const normalizer = fs.readFileSync(path.join(root, 'backend/src/normalizers/flightNormalizer.js'), 'utf8')
  assert.match(normalizer, /bookingUrl:\s*null/)
  assert.match(normalizer, /status:\s*null/)
})

test('.env.example holds only an empty TRAINS_API_KEY placeholder', () => {
  const text = fs.readFileSync(path.join(root, 'backend/.env.example'), 'utf8')
  assert.match(text, /^TRAINS_API_KEY=$/m)
})

test('frontend never references RailRadar credentials or its API host', () => {
  const files = walk(path.join(root, 'travel-planner')).filter((f) => /\.(jsx?|html|json|css)$/.test(f) && !f.endsWith('package-lock.json'))
  for (const f of files) {
    const text = fs.readFileSync(f, 'utf8')
    assert.doesNotMatch(text, /TRAINS_API_KEY|trainsApiKey|railradar\.in|api\.railradar/i, `${path.relative(root, f)} must not reference RailRadar credentials`)
  }
})

test('backend source never logs the RailRadar key value', () => {
  const files = walk(path.join(root, 'backend/src')).filter((f) => f.endsWith('.js'))
  for (const f of files) {
    const text = fs.readFileSync(f, 'utf8')
    assert.doesNotMatch(text, /console\.(log|warn|error|info)\([^)]*(trainsApiKey|TRAINS_API_KEY)/, path.relative(root, f))
  }
})

test('only the RailRadar provider and env read the trains credential', () => {
  const offenders = walk(path.join(root, 'backend/src')).filter((f) => f.endsWith('.js') && /trainsApiKey/.test(fs.readFileSync(f, 'utf8')))
  const rel = offenders.map((f) => relPath(f)).sort()
  assert.deepEqual(rel, ['backend/src/config/env.js', 'backend/src/providers/railProvider.js'])
})

test('train search responses never carry a booking URL or a fabricated fare/status (RailRadar is a data API, not a ticketing API)', () => {
  const normalizer = fs.readFileSync(path.join(root, 'backend/src/normalizers/trainNormalizer.js'), 'utf8')
  assert.match(normalizer, /bookingUrl:\s*null/)
  assert.match(normalizer, /price:\s*null,?\s*\/\/ not returned by this endpoint/)
})

test('only the OpenWeatherMap provider and env read the weather credential', () => {
  const offenders = walk(path.join(root, 'backend/src')).filter((f) => f.endsWith('.js') && /weatherApiKey/.test(fs.readFileSync(f, 'utf8')))
  const rel = offenders.map((f) => relPath(f)).sort()
  assert.deepEqual(rel, ['backend/src/config/env.js', 'backend/src/providers/openWeatherMapProvider.js'])
})

test('backend source never logs the weather key value', () => {
  const files = walk(path.join(root, 'backend/src')).filter((f) => f.endsWith('.js'))
  for (const f of files) {
    const text = fs.readFileSync(f, 'utf8')
    assert.doesNotMatch(text, /console\.(log|warn|error|info)\([^)]*(weatherApiKey|WEATHER_API_KEY)/, path.relative(root, f))
  }
})

test('weather responses never fabricate a reading — the "unavailable" state has no fake values', () => {
  const normalizer = fs.readFileSync(path.join(root, 'backend/src/normalizers/weatherNormalizer.js'), 'utf8')
  assert.match(normalizer, /tempMinC:\s*null,\s*tempMaxC:\s*null,\s*condition:\s*null/)
})
