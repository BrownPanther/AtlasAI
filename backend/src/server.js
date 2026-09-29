import { createApp } from './app.js'
import { runMigrations } from './db/index.js'
import { env } from './config/env.js'
import { cacheStore } from './cache/cacheStore.js'
import { providerRegistry } from './services/providerRegistry.js'

runMigrations()
cacheStore.sweepExpired()

const app = createApp()

app.listen(env.port, () => {
  if (env.usingFallbackSecret) {
    console.warn('[atlasai] WARNING: JWT_SECRET not set in .env — using a random in-memory secret. Sessions will not survive a server restart. Set JWT_SECRET in .env for a real deployment.')
  }
  console.log(`[atlasai] backend listening on http://localhost:${env.port}`)

  // Logs configured/unconfigured only — never logs the key values themselves.
  const statuses = providerRegistry.status()
  const configuredCount = statuses.filter((s) => s.configured).length
  console.log(`[atlasai] travel-data providers: ${configuredCount}/${statuses.length} configured (sample data used for the rest)`)
  for (const s of statuses) {
    console.log(`[atlasai]   ${s.configured ? 'live' : 'sample'} — ${s.category}: ${s.label}`)
  }
})
