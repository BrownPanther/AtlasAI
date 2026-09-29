import { userRepository } from '../repositories/userRepository.js'
import { tripRepository } from '../repositories/tripRepository.js'
import { groupRepository } from '../repositories/groupRepository.js'
import { bookingRepository } from '../repositories/bookingRepository.js'
import { reviewRepository } from '../repositories/reviewRepository.js'
import { feedbackRepository } from '../repositories/feedbackRepository.js'
import { supportRepository } from '../repositories/supportRepository.js'
import { emergencyRepository } from '../repositories/emergencyRepository.js'
import { agentRunRepository } from '../repositories/agentRunRepository.js'
import { AppError } from '../utils/AppError.js'

const ACTIVE_TRIP_STATUSES = ['planned', 'upcoming']
const TICKET_STATUSES = ['open', 'in_progress', 'resolved']

export const adminService = {
  stats() {
    const tripsByStatus = tripRepository.countByStatus()
    const activeTrips = tripsByStatus.filter((s) => ACTIVE_TRIP_STATUSES.includes(s.status)).reduce((sum, s) => sum + s.c, 0)
    const reviewStats = reviewRepository.globalStats()

    return {
      totalUsers: userRepository.count(),
      totalTrips: tripRepository.count(),
      activeTrips,
      tripsByStatus,
      totalGroups: groupRepository.count(),
      totalBookings: bookingRepository.count(),
      bookingsByStatus: bookingRepository.countByStatus(),
      averageServiceRating: reviewStats.average,
      totalReviews: reviewStats.count,
      supportTicketCount: supportRepository.count(),
      emergencyAlertCount: emergencyRepository.count(),
      activeEmergencyCount: emergencyRepository.countByStatus().find((s) => s.status === 'active')?.c || 0,
      popularDestinations: tripRepository.popularDestinations(5),
    }
  },

  users() {
    return userRepository.all()
  },

  groups() {
    return groupRepository.all()
  },

  trips() {
    return tripRepository.all()
  },

  bookings() {
    return bookingRepository.all()
  },

  feedback() {
    return feedbackRepository.all()
  },

  support() {
    return supportRepository.all()
  },

  updateSupportTicket(id, status) {
    if (!TICKET_STATUSES.includes(status)) throw AppError.badRequest('Invalid status', { field: 'status' })
    const ticket = supportRepository.findById(id)
    if (!ticket) throw AppError.notFound('Support ticket not found')
    return supportRepository.updateStatus(id, status)
  },

  emergencies() {
    return emergencyRepository.all()
  },

  agentRuns() {
    return agentRunRepository.all()
  },
}
