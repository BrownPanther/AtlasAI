import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { api } from '../services/api'
import { useAuth } from './AuthContext'

const BookingContext = createContext(null)

export function BookingProvider({ children }) {
  const { isAuthenticated } = useAuth()
  const [bookingList, setBookingList] = useState([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!isAuthenticated) { setBookingList([]); return }
    setLoading(true)
    try {
      const { bookings } = await api.listBookings()
      setBookingList(bookings)
    } catch {
      // leave existing list as-is — a transient failure shouldn't wipe the UI
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => { refresh() }, [refresh])

  const addBooking = async (item, type) => {
    const booking = await api.createBooking({
      serviceId: item.id,
      type,
      name: `${item.provider} — ${item.route}`,
      provider: item.provider,
      route: item.route,
      dateLabel: item.time,
      price: item.price,
    })
    setBookingList((list) => [booking.booking, ...list])
    return booking.booking
  }

  const updateStatus = async (id, status) => {
    const { booking } = await api.updateBooking(id, { status })
    setBookingList((list) => list.map((b) => (b.id === id ? booking : b)))
    return booking
  }

  const cancelBooking = (id) => updateStatus(id, 'cancelled')

  const removeBooking = async (id) => {
    await api.deleteBooking(id)
    setBookingList((list) => list.filter((b) => b.id !== id))
  }

  return (
    <BookingContext.Provider value={{ bookingList, loading, addBooking, updateStatus, cancelBooking, removeBooking, refresh }}>
      {children}
    </BookingContext.Provider>
  )
}

export const useBookings = () => useContext(BookingContext)
