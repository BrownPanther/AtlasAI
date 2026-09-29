import { userRepository } from '../repositories/userRepository.js'
import { AppError } from '../utils/AppError.js'

export const userService = {
  search(query, excludeUserId) {
    if (!query || query.trim().length < 2) return []
    return userRepository.searchByUsername(query.trim(), excludeUserId)
  },

  getById(id) {
    const user = userRepository.findById(id)
    if (!user) throw AppError.notFound('User not found')
    return user
  },

  updateMe(id, fields) {
    return userRepository.updateProfile(id, fields)
  },
}
