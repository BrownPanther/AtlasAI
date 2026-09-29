import { bookingRepository } from '../repositories/bookingRepository.js'
import { serviceRepository } from '../repositories/serviceRepository.js'
import { notificationRepository } from '../repositories/notificationRepository.js'
import { AppError } from '../utils/AppError.js'

const STATUSES = ['selected', 'pending', 'confirmed', 'completed', 'cancelled', 'reviewed']

// Forward-only lifecycle, plus cancellation from any pre-completion state.
// Reaching 'reviewed' happens automatically when a review is submitted, not via this map.
const ALLOWED_TRANSITIONS = {
  selected: ['pending', 'cancelled'],
  pending: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'cancelled'],
  completed: [], // becomes 'reviewed' only via reviewService
  cancelled: [],
  reviewed: [],
}

function requireOwnBooking(id, userId) {
  const booking = bookingRepository.findById(id)
  if (!booking) throw AppError.notFound('Booking not found')
  if (booking.userId !== userId) throw AppError.forbidden('Not your booking')
  return booking
}

export const bookingService = {
  create(userId, { tripId, serviceId, type, name, dateLabel, price, provider, route, status }) {
    if (!type || !name || price == null) throw AppError.badRequest('type, name and price are required')
    const initialStatus = status && STATUSES.includes(status) ? status : 'pending'

    // The frontend already knows the full details of what's being booked
    // (it's showing the same sample data the service was built from) — we
    // upsert a services row from that so reviews have something real to attach to.
    const svcId = serviceId || `${type.toLowerCase()}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}`
    serviceRepository.upsert({ id: svcId, type, provider: provider || name, route, price })

    return bookingRepository.create({ userId, tripId, serviceId: svcId, type, name, dateLabel, price, status: initialStatus })
  },

  listForUser(userId) {
    return bookingRepository.listForUser(userId)
  },

  getById(id, userId) {
    return requireOwnBooking(id, userId)
  },

  updateStatus(id, userId, status) {
    const booking = requireOwnBooking(id, userId)
    if (!STATUSES.includes(status)) throw AppError.badRequest('Invalid status', { field: 'status' })
    if (!ALLOWED_TRANSITIONS[booking.status].includes(status)) {
      throw AppError.badRequest(`Cannot move a booking from "${booking.status}" to "${status}"`, { field: 'status' })
    }
    const updated = bookingRepository.updateStatus(id, status)
    if (status === 'confirmed' || status === 'completed' || status === 'cancelled') {
      notificationRepository.create({
        userId,
        type: 'BOOKING_STATUS',
        title: `Booking ${status}: ${booking.name}`,
        link: '/bookings',
      })
    }
    return updated
  },

  cancel(id, userId) {
    return this.updateStatus(id, userId, 'cancelled')
  },

  remove(id, userId) {
    const booking = requireOwnBooking(id, userId)
    if (booking.status !== 'selected') {
      throw AppError.badRequest('Only a not-yet-committed booking can be deleted outright — cancel it instead')
    }
    bookingRepository.delete(id)
  },
}
