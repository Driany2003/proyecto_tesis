import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { User } from '@/types/user'
import * as authApi from '@/api/auth'

interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  hasRole: (...roles: string[]) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

const STORAGE_TOKEN = 'token'
const STORAGE_USER = 'user'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: localStorage.getItem(STORAGE_TOKEN),
    isLoading: true,
    isAuthenticated: false,
  })

  const loadUser = useCallback(async () => {
    const token = localStorage.getItem(STORAGE_TOKEN)
    if (!token) {
      setState({ user: null, token: null, isLoading: false, isAuthenticated: false })
      return
    }
    const stored = localStorage.getItem(STORAGE_USER)
    if (stored) {
      try {
        const storedUser = JSON.parse(stored) as User
        setState({ user: storedUser, token, isLoading: false, isAuthenticated: true })
        return
      } catch {
        localStorage.removeItem(STORAGE_USER)
      }
    }
    try {
      const me = await authApi.getMe()
      if (!me) {
        localStorage.removeItem(STORAGE_TOKEN)
        localStorage.removeItem(STORAGE_USER)
        setState({ user: null, token: null, isLoading: false, isAuthenticated: false })
        return
      }
      const fresh: User = {
        id: me.id,
        name: me.name,
        email: me.email,
        role: me.role,
        active: me.active,
      }
      localStorage.setItem(STORAGE_USER, JSON.stringify(fresh))
      setState({ user: fresh, token, isLoading: false, isAuthenticated: true })
    } catch {
      localStorage.removeItem(STORAGE_TOKEN)
      localStorage.removeItem(STORAGE_USER)
      setState({ user: null, token: null, isLoading: false, isAuthenticated: false })
    }
  }, [])

  useEffect(() => {
    loadUser()
  }, [loadUser])

  const login = useCallback(async (email: string, password: string) => {
    const authUser = await authApi.login({ email, password })
    const user: User = {
      id: authUser.id,
      name: authUser.name,
      email: authUser.email,
      role: authUser.role,
      active: authUser.active,
    }
    localStorage.setItem(STORAGE_TOKEN, authUser.token)
    localStorage.setItem(STORAGE_USER, JSON.stringify(user))
    setState({ user, token: authUser.token, isLoading: false, isAuthenticated: true })
  }, [])

  const logout = useCallback(async () => {
    await authApi.logout()
    localStorage.removeItem(STORAGE_TOKEN)
    localStorage.removeItem(STORAGE_USER)
    setState({ user: null, token: null, isLoading: false, isAuthenticated: false })
  }, [])

  const hasRole = useCallback(
    (...roles: string[]) => {
      if (!state.user) return false
      return roles.includes(state.user.role)
    },
    [state.user]
  )

  const value: AuthContextValue = {
    ...state,
    login,
    logout,
    hasRole,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
