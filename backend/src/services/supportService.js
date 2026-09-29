import { supportRepository } from '../repositories/supportRepository.js'
import { AppError } from '../utils/AppError.js'

export const supportService = {
  create(userId, { subject, message }) {
    if (!subject?.trim() || !message?.trim()) throw AppError.badRequest('subject and message are required')
    return supportRepository.create({ userId, subject: subject.trim(), message: message.trim() })
  },

  listForUser(userId) {
    return supportRepository.listForUser(userId)
  },
}
