import { useNavigate } from 'react-router-dom'
import { CheckCheck, Users, MessageSquare, LogIn, LogOut, Send, Wallet, Star, ShieldAlert, Bell } from 'lucide-react'
import { useNotifications } from '../context/NotificationContext'

const TYPE_ICON = {
  GROUP_INVITE: Users,
  GROUP_MESSAGE: MessageSquare,
  GROUP_JOIN: LogIn,
  GROUP_LEAVE: LogOut,
  ITINERARY_SHARED: Send,
  TRIP_UPDATED: Bell,
  BOOKING_STATUS: Wallet,
  REVIEW_REMINDER: Star,
  SAFETY_ALERT: ShieldAlert,
  SYSTEM: Bell,
}

function timeAgo(sqliteTimestamp) {
  // SQLite's datetime('now') yields "YYYY-MM-DD HH:MM:SS" in UTC with no offset marker.
  const iso = sqliteTimestamp.replace(' ', 'T') + 'Z'
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

export default function NotificationPanel({ onClose }) {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications()
  const navigate = useNavigate()

  const openNotification = (n) => {
    if (!n.read) markRead(n.id)
    if (n.link) navigate(n.link)
    onClose()
  }

  return (
    <>
      <button className="atlas-search-backdrop" aria-label="Close notifications" onClick={onClose} />
      <div className="atlas-notification-panel">
        <div className="atlas-notification-panel-head">
          <b className="text-xs font-bold text-slate-900 dark:text-white">Notifications</b>
          {unreadCount > 0 && (
            <button onClick={markAllRead}><CheckCheck size={12} style={{ display: 'inline', marginRight: 4 }} />Mark all read</button>
          )}
        </div>
        <div className="atlas-notification-list">
          {notifications.length === 0 && (
            <div className="atlas-notification-empty flex flex-col items-center gap-2 py-8 px-4 text-slate-500 dark:text-[#cbd5e1]">
              <Bell size={24} className="text-purple-600 dark:text-[#a078ff] mb-1 opacity-90" />
              <p className="text-xs font-semibold text-slate-700 dark:text-[#e9def7] m-0">You're all caught up</p>
              <span className="text-[11px] text-slate-400 dark:text-[#a599b5]">No new travel updates or group invites</span>
            </div>
          )}
          {notifications.map((n) => {
            const Icon = TYPE_ICON[n.type] || Bell
            return (
              <button key={n.id} className={`atlas-notification-item ${n.read ? '' : 'is-unread'}`} onClick={() => openNotification(n)}>
                <span className="atlas-notification-icon"><Icon size={14} /></span>
                <span className="atlas-notification-copy">
                  <b className="text-slate-900 dark:text-white font-bold">{n.title}</b>
                  {n.body && <small className="text-slate-600 dark:text-[#cbc3d7]">{n.body}</small>}
                  <em className="text-slate-400 dark:text-[#958ca0]">{timeAgo(n.createdAt)}</em>
                </span>
                {!n.read && <span className="atlas-notification-dot" />}
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}
