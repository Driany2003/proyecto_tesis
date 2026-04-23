import { apiClient } from './client'
import type { AuthUser, LoginCredentials } from '@/types/user'
import type { Role } from '@/constants/roles'

interface LoginResponse {
  message: string
  token?: string
  user?: {
    id: string
    name?: string
    email?: string
    role: string
    active?: boolean
  }
}

function mapRole(role: string): Role {
  const r = String(role).trim()
  if (r === 'ADMIN' || r === 'MEDICO' || r === 'AUDITOR') return r
  return r as Role
}

export async function login(credentials: LoginCredentials): Promise<AuthUser> {
  const response = await apiClient.post<LoginResponse>('/auth/login', credentials)

  const fromBody = (response.data?.token ?? '').trim()
  const authHeader = response.headers?.authorization ?? response.headers?.Authorization ?? ''
  const fromHeader = authHeader.replace(/^Bearer\s+/i, '').trim()
  const token = fromBody || fromHeader
  if (!token) throw new Error('No se recibió token')

  const u = response.data?.user
  if (!u) throw new Error('No se recibió el usuario')

  return {
    id: String(u.id),
    name: u.name ?? '',
    email: u.email ?? '',
    role: mapRole(String(u.role)),
    active: u.active ?? true,
    token,
  }
}

export async function logout(): Promise<void> {
  await apiClient.post('/auth/logout').catch(() => {})
}

export async function getMe(): Promise<AuthUser | null> {
  const { data } = await apiClient.get<{
    id: string
    name?: string
    email?: string
    role: string
    active?: boolean
  } | null>('/auth/me')
  if (!data) return null
  return {
    id: String(data.id),
    name: data.name ?? '',
    email: data.email ?? '',
    role: mapRole(String(data.role)),
    active: data.active ?? true,
    token: localStorage.getItem('token') ?? '',
  }
}
