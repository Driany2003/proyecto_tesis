import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { User } from '@/types/user'
import * as authApi from '@/api/auth'

interface AuthState {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  hasRole: (...roles: string[]) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

const STORAGE_USER = 'user'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    const stored = localStorage.getItem(STORAGE_USER)
    if (stored) {
      try {
        const user = JSON.parse(stored) as User
        return { user, isLoading: true, isAuthenticated: false }
      } catch {
        localStorage.removeItem(STORAGE_USER)
      }
    }
    return { user: null, isLoading: true, isAuthenticated: false }
  })

  useEffect(() => {
    const verify = async () => {
      try {
        const me = await authApi.getMe()
        if (!me) {
          localStorage.removeItem(STORAGE_USER)
          setState({ user: null, isLoading: false, isAuthenticated: false })
          return
        }
        const fresh: User = {
          id: me.id, name: me.name, email: me.email, role: me.role, active: me.active,
        }
        localStorage.setItem(STORAGE_USER, JSON.stringify(fresh))
        setState({ user: fresh, isLoading: false, isAuthenticated: true })
      } catch {
        localStorage.removeItem(STORAGE_USER)
        setState({ user: null, isLoading: false, isAuthenticated: false })
      }
    }
    verify()
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const authUser = await authApi.login({ email, password })
    const user: User = {
      id: authUser.id, name: authUser.name, email: authUser.email,
      role: authUser.role, active: authUser.active,
    }
    localStorage.setItem(STORAGE_USER, JSON.stringify(user))
    setState({ user, isLoading: false, isAuthenticated: true })
  }, [])

  const logout = useCallback(async () => {
    try { await authApi.logout() } catch {}
    localStorage.removeItem(STORAGE_USER)
    setState({ user: null, isLoading: false, isAuthenticated: false })
  }, [])

  const hasRole = useCallback(
    (...roles: string[]) => state.user ? roles.includes(state.user.role) : false,
    [state.user]
  )

  return (
    <AuthContext.Provider value={{ ...state, login, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
