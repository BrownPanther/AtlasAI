import { userRepository } from '../repositories/userRepository.js'
import { hashPassword, verifyPassword } from '../utils/password.js'
import { signToken } from '../utils/jwt.js'
import { AppError } from '../utils/AppError.js'
import { db } from '../db/index.js'

export const authService = {
  register({ username, email, password }) {
    const existingEmail = userRepository.findByEmail(email)
    if (existingEmail) throw AppError.conflict('An account with this email already exists')
    const existingUsername = userRepository.findByUsername(username)
    if (existingUsername) throw AppError.conflict('That username is taken')

    const { hash, salt } = hashPassword(password)

    // First registered user becomes admin so the admin dashboard is reachable
    // without manual DB surgery in a fresh install.
    const isFirstUser = userRepository.count() === 0

    const user = userRepository.create({
      username,
      email,
      passwordHash: hash,
      passwordSalt: salt,
    })

    if (isFirstUser) {
      db.prepare(`UPDATE users SET role = 'admin' WHERE id = ?`).run(user.id)
      user.role = 'admin'
    }

    const token = signToken({ sub: user.id, role: user.role })
    return { user, token }
  },

  login({ email, password }) {
    const row = userRepository.findByEmail(email)
    if (!row) throw AppError.unauthorized('Invalid email or password')
    const ok = verifyPassword(password, row.password_hash, row.password_salt)
    if (!ok) throw AppError.unauthorized('Invalid email or password')
    const user = userRepository.findById(row.id)
    const token = signToken({ sub: user.id, role: user.role })
    return { user, token }
  },
}
