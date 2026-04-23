import { apiClient } from './client'
import type { AuthUser, LoginCredentials } from '@/types/user'
import type { Role } from '@/constants/roles'

function mapRole(role: string): Role {
  const r = String(role).trim()
  if (r === 'ADMIN' || r === 'MEDICO' || r === 'AUDITOR') return r
  return r as Role
}

export async function login(credentials: LoginCredentials): Promise<AuthUser> {
  const response = await apiClient.post<{ message: string; token?: string }>('/auth/login', credentials)
  // En CORS, el header Authorization a veces no es visible; el backend devuelve el token en el cuerpo
  const fromBody = (response.data?.token ?? '').trim()
  const authHeader = response.headers?.authorization ?? response.headers?.Authorization ?? ''
  const fromHeader = authHeader.replace(/^Bearer\s+/i, '').trim()
  const token = fromBody || fromHeader
  if (!token) throw new Error('No se recibió token')
  localStorage.setItem('token', token)
  const me = await getMe()
  if (!me) throw new Error('No se pudo obtener el usuario')
  const authUser: AuthUser = {
    id: String(me.id),
    name: me.name ?? '',
    email: me.email ?? '',
    role: mapRole(String(me.role)),
    active: me.active ?? true,
    token,
  }
  return authUser
}

export async function logout(): Promise<void> {
  await apiClient.post('/auth/logout').catch(() => {})
}

export async function getMe(): Promise<AuthUser | null> {
  const { data } = await apiClient.get<AuthUser | null>('/auth/me')
  return data
}
