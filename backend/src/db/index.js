import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { env } from '../config/env.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const resolvedDbPath = path.resolve(process.cwd(), env.dbPath)
fs.mkdirSync(path.dirname(resolvedDbPath), { recursive: true })

export const db = new Database(resolvedDbPath)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

export function runMigrations() {
  const schemaPath = path.join(__dirname, 'schema.sql')
  const schema = fs.readFileSync(schemaPath, 'utf-8')
  db.exec(schema)
}
