import { db } from '../db/index.js'
import { locationRepository } from '../repositories/locationRepository.js'
import { emergencyRepository } from '../repositories/emergencyRepository.js'
import { tripRepository } from '../repositories/tripRepository.js'
import { notificationRepository } from '../repositories/notificationRepository.js'
import { userRepository } from '../repositories/userRepository.js'
import { GENERAL_EMERGENCY_CONTACTS } from '../tools/safetyTool.js'
import { makeToken } from '../utils/id.js'
import { AppError } from '../utils/AppError.js'

const DEFAULT_SHARE_HOURS = 4

function requireTripMember(tripId, userId) {
  const trip = tripRepository.findById(tripId)
  if (!trip) throw AppError.notFound('Trip not found')
  if (!tripRepository.isMember(tripId, userId)) throw AppError.forbidden('Not a member of this trip')
  return trip
}

function otherTripMemberIds(tripId, exceptUserId) {
  // trip_members includes the owner and anyone a shared itinerary granted access to (Checkpoint 5).
  return db
    .prepare(`SELECT user_id FROM trip_members WHERE trip_id = ? AND user_id != ?`)
    .all(tripId, exceptUserId)
    .map((r) => r.user_id)
}

function tripProgress(trip) {
  const days = trip.finalPlan?.days || []
  const totalStops = days.reduce((s, d) => s + d.stops.length, 0)
  const doneStops = days.reduce((s, d) => s + d.stops.filter((st) => st.completed).length, 0)
  return totalStops ? Math.round((doneStops / totalStops) * 100) : 0
}

export const safetyService = {
  // --- location sharing ---

  postLocation(tripId, userId, { latitude, longitude, enableSharing, durationHours }) {
    requireTripMember(tripId, userId)
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      throw AppError.badRequest('latitude and longitude (numbers) are required')
    }

    let shareToken = null
    let shareExpiresAt = null

    if (enableSharing === true) {
      shareToken = makeToken()
      shareExpiresAt = new Date(Date.now() + (durationHours || DEFAULT_SHARE_HOURS) * 3600000).toISOString()
    } else if (enableSharing === false) {
      shareToken = null
      shareExpiresAt = null
    } else {
      const latest = locationRepository.latestForTrip(tripId)
      if (latest?.shareToken && new Date(latest.shareExpiresAt).getTime() > Date.now()) {
        shareToken = latest.shareToken
        shareExpiresAt = latest.shareExpiresAt
      }
    }

    const location = locationRepository.create({ tripId, userId, latitude, longitude, shareToken, shareExpiresAt })
    return {
      location,
      shareLink: shareToken ? `/share/trip/${shareToken}` : null,
      sharingActive: Boolean(shareToken),
    }
  },

  getLocationState(tripId, userId) {
    requireTripMember(tripId, userId)
    const latest = locationRepository.latestForTrip(tripId)
    const history = locationRepository.historyForTrip(tripId, 20)
    const sharingActive = Boolean(latest?.shareToken && new Date(latest.shareExpiresAt).getTime() > Date.now())
    return {
      latest,
      history,
      sharingActive,
      shareLink: sharingActive ? `/share/trip/${latest.shareToken}` : null,
      shareExpiresAt: sharingActive ? latest.shareExpiresAt : null,
    }
  },

  previewByShareToken(token) {
    const row = locationRepository.findLatestByToken(token)
    if (!row) throw AppError.notFound('This share link is invalid')

    const latest = locationRepository.latestForTrip(row.tripId)
    if (!latest || latest.shareToken !== token) {
      throw AppError.conflict('This share link is no longer active')
    }
    if (new Date(latest.shareExpiresAt).getTime() < Date.now()) {
      throw AppError.conflict('This share link has expired')
    }

    const trip = tripRepository.findById(row.tripId)
    if (!trip) throw AppError.notFound('Trip no longer exists')

    const activeEmergency = emergencyRepository.activeForTrip(trip.id)

    return {
      destination: trip.destination,
      tripTitle: trip.title,
      lastLocation: { latitude: latest.latitude, longitude: latest.longitude },
      lastUpdatedAt: latest.createdAt,
      progress: tripProgress(trip),
      emergencyActive: Boolean(activeEmergency),
    }
  },

  // --- emergency workflow ---

  raiseAlert(tripId, userId, { latitude = null, longitude = null, notes = null }) {
    const trip = requireTripMember(tripId, userId)
    const existing = emergencyRepository.activeForTrip(tripId)
    if (existing) throw AppError.conflict('An emergency alert is already active for this trip')

    const alert = emergencyRepository.create({ tripId, userId, latitude, longitude, notes })
    const alerter = userRepository.findById(userId)

    for (const memberId of otherTripMemberIds(tripId, userId)) {
      notificationRepository.create({
        userId: memberId,
        type: 'SAFETY_ALERT',
        title: `Emergency alert: ${alerter.username} on the ${trip.destination} trip`,
        body: notes || 'No additional details provided.',
        link: `/trips/${tripId}/safety`,
        meta: { tripId, alertId: alert.id },
      })
    }

    return { alert, emergencyContacts: GENERAL_EMERGENCY_CONTACTS }
  },

  getAlertState(tripId, userId) {
    requireTripMember(tripId, userId)
    return {
      active: emergencyRepository.activeForTrip(tripId),
      history: emergencyRepository.listForTrip(tripId),
      emergencyContacts: GENERAL_EMERGENCY_CONTACTS,
    }
  },

  resolveAlert(tripId, alertId, userId) {
    requireTripMember(tripId, userId)
    const alert = emergencyRepository.findById(alertId)
    if (!alert || alert.tripId !== tripId) throw AppError.notFound('Alert not found')
    if (alert.status !== 'active') throw AppError.conflict('This alert is not active')
    const resolved = emergencyRepository.resolve(alertId)

    for (const memberId of otherTripMemberIds(tripId, userId)) {
      notificationRepository.create({
        userId: memberId,
        type: 'SAFETY_ALERT',
        title: `Emergency alert resolved`,
        link: `/trips/${tripId}/safety`,
        meta: { tripId, alertId },
      })
    }
    return resolved
  },
}
