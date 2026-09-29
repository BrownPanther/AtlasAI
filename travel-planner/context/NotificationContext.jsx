import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { useAuth } from './AuthContext'
import { api } from '../services/api'

const NotificationContext = createContext(null)

const POLL_MS = 15000

export function NotificationProvider({ children }) {
  const { isAuthenticated } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const pollRef = useRef(null)

  const refresh = useCallback(async () => {
    if (!isAuthenticated) return
    try {
      const { notifications, unreadCount } = await api.listNotifications()
      setNotifications(notifications)
      setUnreadCount(unreadCount)
    } catch {
      // non-blocking — the bell just won't update this cycle
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated) {
      setNotifications([])
      setUnreadCount(0)
      return
    }
    refresh()
    pollRef.current = setInterval(refresh, POLL_MS)
    return () => clearInterval(pollRef.current)
  }, [isAuthenticated, refresh])

  const markRead = useCallback(async (id) => {
    setNotifications((list) => list.map((n) => (n.id === id ? { ...n, read: true } : n)))
    setUnreadCount((c) => Math.max(0, c - 1))
    try { await api.markNotificationRead(id) } catch { /* next poll reconciles */ }
  }, [])

  const markAllRead = useCallback(async () => {
    setNotifications((list) => list.map((n) => ({ ...n, read: true })))
    setUnreadCount(0)
    try { await api.markAllNotificationsRead() } catch { /* next poll reconciles */ }
  }, [])

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, refresh, markRead, markAllRead }}>
      {children}
    </NotificationContext.Provider>
  )
}

export const useNotifications = () => useContext(NotificationContext)
