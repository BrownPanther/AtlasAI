import { RuleBasedProvider } from './RuleBasedProvider.js'
import { LocalOllamaProvider } from './LocalOllamaProvider.js'
import { env } from '../config/env.js'

const ruleBased = new RuleBasedProvider()
const ollama = new LocalOllamaProvider()

// Ollama provider already falls back to rule-based internally if unavailable,
// so it's always safe to export it as "the" provider.
export const llmProvider = env.ollamaBaseUrl ? ollama : ruleBased
