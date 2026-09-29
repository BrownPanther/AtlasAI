let rawUrl = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').trim().replace(/\/+$/, '')
if (!rawUrl.endsWith('/api')) {
  rawUrl += '/api'
}
const API_URL = rawUrl
const TOKEN_KEY = 'atlasai_token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export class ApiError extends Error {
  constructor(message, status, code, details) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

export async function apiFetch(path, { method = 'GET', body, headers = {} } = {}) {
  const token = getToken()
  const res = await fetch(`${API_URL}${path}`, {
    method,
    credentials: 'include',
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (res.status === 204) return null

  let data
  try {
    data = await res.json()
  } catch {
    data = null
  }

  if (!res.ok) {
    if (res.status === 401) {
      setToken(null)
    }
    const err = data?.error || {}
    throw new ApiError(err.message || `Request failed (${res.status})`, res.status, err.code, err.details)
  }

  return data
}

export const api = {
  register: (payload) => apiFetch('/auth/register', { method: 'POST', body: payload }),
  login: (payload) => apiFetch('/auth/login', { method: 'POST', body: payload }),
  me: () => apiFetch('/auth/me'),
  logout: () => apiFetch('/auth/logout', { method: 'POST' }),

  updateProfile: (payload) => apiFetch('/users/me', { method: 'PATCH', body: payload }),
  searchUsers: (q) => apiFetch(`/users/search?q=${encodeURIComponent(q)}`),

  listTrips: () => apiFetch('/trips'),
  getTrip: (id) => apiFetch(`/trips/${id}`),
  updateTrip: (id, payload) => apiFetch(`/trips/${id}`, { method: 'PATCH', body: payload }),

  getAgentRun: (id) => apiFetch(`/ai/runs/${id}`),

  listGroups: () => apiFetch('/groups'),
  createGroup: (payload) => apiFetch('/groups', { method: 'POST', body: payload }),
  getGroup: (id) => apiFetch(`/groups/${id}`),
  updateGroup: (id, payload) => apiFetch(`/groups/${id}`, { method: 'PATCH', body: payload }),
  deleteGroup: (id) => apiFetch(`/groups/${id}`, { method: 'DELETE' }),
  inviteToGroup: (id, payload) => apiFetch(`/groups/${id}/invites`, { method: 'POST', body: payload }),
  removeGroupMember: (id, userId) => apiFetch(`/groups/${id}/members/${userId}`, { method: 'DELETE' }),
  myInvites: () => apiFetch('/groups/invites'),
  previewInvite: (token) => apiFetch(`/groups/invites/token/${token}`),
  acceptInvite: (inviteId) => apiFetch(`/groups/invites/${inviteId}/accept`, { method: 'POST' }),
  declineInvite: (inviteId) => apiFetch(`/groups/invites/${inviteId}/decline`, { method: 'POST' }),
  listMessages: (id) => apiFetch(`/groups/${id}/messages`),
  postMessage: (id, body) => apiFetch(`/groups/${id}/messages`, { method: 'POST', body: { body } }),
  shareItinerary: (id, payload) => apiFetch(`/groups/${id}/itinerary-share`, { method: 'POST', body: payload }),

  listNotifications: () => apiFetch('/notifications'),
  markNotificationRead: (id) => apiFetch(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllNotificationsRead: () => apiFetch('/notifications/read-all', { method: 'POST' }),

  listBookings: () => apiFetch('/bookings'),
  createBooking: (payload) => apiFetch('/bookings', { method: 'POST', body: payload }),
  updateBooking: (id, payload) => apiFetch(`/bookings/${id}`, { method: 'PATCH', body: payload }),
  deleteBooking: (id) => apiFetch(`/bookings/${id}`, { method: 'DELETE' }),

  listAttractions: (destination, { limit } = {}) => apiFetch(`/attractions?destination=${encodeURIComponent(destination)}${limit ? `&limit=${limit}` : ''}`),
  searchHotels: (destination, { limit } = {}) => apiFetch(`/hotels/search?destination=${encodeURIComponent(destination)}${limit ? `&limit=${limit}` : ''}`),
  searchFlights: (destination, { origin = 'Delhi', departureDate, returnDate, limit } = {}) => apiFetch(`/flights/search?destination=${encodeURIComponent(destination)}&origin=${encodeURIComponent(origin)}&departureDate=${encodeURIComponent(departureDate)}${returnDate ? `&returnDate=${encodeURIComponent(returnDate)}` : ''}${limit ? `&limit=${limit}` : ''}`),
  searchTrains: (destination, { origin = 'Delhi', date, limit } = {}) => apiFetch(`/trains/search?destination=${encodeURIComponent(destination)}&origin=${encodeURIComponent(origin)}${date ? `&date=${encodeURIComponent(date)}` : ''}${limit ? `&limit=${limit}` : ''}`),
  getTrainStatus: (number, { date } = {}) => apiFetch(`/trains/${encodeURIComponent(number)}/status${date ? `?date=${encodeURIComponent(date)}` : ''}`),
  getCurrentWeather: (destination) => apiFetch(`/weather/current?destination=${encodeURIComponent(destination)}`),
  getWeatherForecast: (destination) => apiFetch(`/weather/forecast?destination=${encodeURIComponent(destination)}`),
  searchDestinations: (q) => apiFetch(`/destinations/search?q=${encodeURIComponent(q)}`),

  listServiceReviews: (serviceId) => apiFetch(`/services/${serviceId}/reviews`),
  createServiceReview: (serviceId, payload) => apiFetch(`/services/${serviceId}/reviews`, { method: 'POST', body: payload }),

  postLocation: (tripId, payload) => apiFetch(`/trips/${tripId}/location`, { method: 'POST', body: payload }),
  getLocationState: (tripId) => apiFetch(`/trips/${tripId}/location`),
  previewShareToken: (token) => apiFetch(`/trips/share/${token}`),
  raiseEmergency: (tripId, payload) => apiFetch(`/trips/${tripId}/emergency`, { method: 'POST', body: payload }),
  getEmergencyState: (tripId) => apiFetch(`/trips/${tripId}/emergency`),
  resolveEmergency: (tripId, alertId) => apiFetch(`/trips/${tripId}/emergency/${alertId}/resolve`, { method: 'POST' }),
  myFeedback: () => apiFetch('/feedback/mine'),
  submitFeedback: (payload) => apiFetch('/feedback', { method: 'POST', body: payload }),
  submitSupportTicket: (payload) => apiFetch('/support', { method: 'POST', body: payload }),
  mySupportTickets: () => apiFetch('/support/mine'),

  adminStats: () => apiFetch('/admin/stats'),
  adminUsers: () => apiFetch('/admin/users'),
  adminGroups: () => apiFetch('/admin/groups'),
  adminTrips: () => apiFetch('/admin/trips'),
  adminBookings: () => apiFetch('/admin/bookings'),
  adminFeedback: () => apiFetch('/admin/feedback'),
  adminSupport: () => apiFetch('/admin/support'),
  adminUpdateSupportTicket: (id, status) => apiFetch(`/admin/support/${id}`, { method: 'PATCH', body: { status } }),
  adminEmergencies: () => apiFetch('/admin/emergencies'),
  adminAgentRuns: () => apiFetch('/admin/agent-runs'),
}

export { API_URL, TOKEN_KEY }
