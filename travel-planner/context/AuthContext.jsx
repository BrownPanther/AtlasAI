import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { api, getToken, setToken } from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function loadSession() {
      if (!getToken()) {
        setLoading(false)
        return
      }
      try {
        const { user } = await api.me()
        if (!cancelled) setUser(user)
      } catch {
        setToken(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadSession()
    return () => { cancelled = true }
  }, [])

  const login = useCallback(async (email, password) => {
    const { user, token } = await api.login({ email, password })
    setToken(token)
    setUser(user)
    return user
  }, [])

  const register = useCallback(async (username, email, password) => {
    const { user, token } = await api.register({ username, email, password })
    setToken(token)
    setUser(user)
    return user
  }, [])

  const logout = useCallback(async () => {
    try { await api.logout() } catch { /* token may already be invalid, still clear locally */ }
    setToken(null)
    setUser(null)
  }, [])

  const refreshUser = useCallback((patch) => setUser((u) => (u ? { ...u, ...patch } : u)), [])

  return (
    <AuthContext.Provider value={{ user, loading, isAuthenticated: Boolean(user), login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
