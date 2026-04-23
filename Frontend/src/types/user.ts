import type { Role } from '@/constants/roles'

export interface User {
  id: string
  name: string
  email: string
  username?: string | null
  role: Role
  active: boolean
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface AuthUser extends User {
  token: string
}
