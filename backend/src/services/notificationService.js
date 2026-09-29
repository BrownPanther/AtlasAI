import { notificationRepository } from '../repositories/notificationRepository.js'
import { AppError } from '../utils/AppError.js'

export const notificationService = {
  list(userId, limit = 50) {
    return {
      notifications: notificationRepository.listForUser(userId, limit),
      unreadCount: notificationRepository.unreadCount(userId),
    }
  },

  markRead(id, userId) {
    const existing = notificationRepository.findById(id)
    if (!existing || existing.userId !== userId) throw AppError.notFound('Notification not found')
    return notificationRepository.markRead(id, userId)
  },

  markAllRead(userId) {
    notificationRepository.markAllRead(userId)
  },
}
