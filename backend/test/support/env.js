// Side-effect-only module: sets process.env BEFORE src/config/env.js and
// src/db/index.js are evaluated (they read process.env once at import time).
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test-secret-not-for-production'
process.env.ATTRACTIONS_API_KEY = 'TEST_KEY_do_not_leak'
// MAPS_API_KEY is intentionally left unset here (like it is by default) —
// mapsService/routes tests set env.providers.mapsApiKey directly, the same
// way attractionsService tests toggle env.providers.attractionsApiKey, so
// other suites (e2e /ai/plan, etc.) never make a real routing call.
process.env.FLIGHT_PROVIDER = process.env.FLIGHT_PROVIDER || 'sample'
process.env.HOTEL_PROVIDER = process.env.HOTEL_PROVIDER || 'sample'
process.env.DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'atlasai-test-')), 'test.db')
