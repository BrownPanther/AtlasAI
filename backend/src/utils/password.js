import crypto from 'node:crypto'

const KEY_LEN = 64

export function hashPassword(plain) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(plain, salt, KEY_LEN).toString('hex')
  return { hash, salt }
}

export function verifyPassword(plain, hash, salt) {
  const candidate = crypto.scryptSync(plain, salt, KEY_LEN).toString('hex')
  const a = Buffer.from(candidate, 'hex')
  const b = Buffer.from(hash, 'hex')
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}
