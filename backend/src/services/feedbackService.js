import { feedbackRepository } from '../repositories/feedbackRepository.js'
import { AppError } from '../utils/AppError.js'

export const feedbackService = {
  create(userId, { category, message }) {
    if (!message?.trim()) throw AppError.badRequest('message is required', { field: 'message' })
    return feedbackRepository.create({ userId, category, message: message.trim() })
  },

  listForUser(userId) {
    return feedbackRepository.listForUser(userId)
  },
}
