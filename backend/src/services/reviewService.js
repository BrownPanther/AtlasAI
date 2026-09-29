import { reviewRepository } from '../repositories/reviewRepository.js'
import { serviceRepository } from '../repositories/serviceRepository.js'
import { bookingRepository } from '../repositories/bookingRepository.js'
import { AppError } from '../utils/AppError.js'

export const reviewService = {
  create(userId, serviceIdFromUrl, { bookingId, rating, title, body }) {
    if (!bookingId) throw AppError.badRequest('bookingId is required', { field: 'bookingId' })
    const ratingNum = Number(rating)
    if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      throw AppError.badRequest('rating must be an integer from 1 to 5', { field: 'rating' })
    }

    const booking = bookingRepository.findById(bookingId)
    if (!booking) throw AppError.notFound('Booking not found')
    if (booking.userId !== userId) throw AppError.forbidden('Not your booking')
    if (booking.serviceId !== serviceIdFromUrl) throw AppError.badRequest('Booking does not belong to this service', { field: 'bookingId' })
    if (reviewRepository.findByBookingId(bookingId)) throw AppError.conflict('This booking has already been reviewed')
    if (booking.status !== 'completed') throw AppError.badRequest('Only completed bookings can be reviewed', { field: 'bookingId' })

    const review = reviewRepository.create({
      serviceId: booking.serviceId,      bookingId,
      userId,
      rating: ratingNum,
      title,
      body,
      verified: true, // every review here is tied to a real booking by this user
    })

    bookingRepository.updateStatus(bookingId, 'reviewed')
    return review
  },

  listForService(serviceId) {
    return {
      reviews: reviewRepository.listForService(serviceId),
      summary: serviceRepository.ratingSummary(serviceId),
    }
  },
}
