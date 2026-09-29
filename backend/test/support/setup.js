// Must be the FIRST import of every test file. Uses a throwaway SQLite file
// and a fake key — automated tests never contact the real OpenTripMap API.
// Kept synchronous so migrations finish before any later import (e.g.
// cacheStore) prepares statements against provider_cache.
import './env.js'
import { runMigrations, db } from '../../src/db/index.js'

runMigrations()

export { db }
export const TEST_KEY = process.env.ATTRACTIONS_API_KEY
