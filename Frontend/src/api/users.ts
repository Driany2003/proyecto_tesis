import { apiClient } from './client'
import type { User } from '@/types/user'

export interface CreateUserInput {
  name: string
  email: string
  username?: string
  password: string
  role: string
}

export interface UpdateUserInput {
  name?: string
  email?: string
  username?: string
  password?: string
  role?: string
  active?: boolean
}

export async function getUsers(): Promise<User[]> {
  const { data } = await apiClient.get<User[]>('/users')
  return Array.isArray(data) ? data : []
}

export async function createUser(input: CreateUserInput): Promise<User> {
  const { data } = await apiClient.post<User>('/users', input)
  return data
}

export async function updateUser(id: string, input: UpdateUserInput): Promise<User> {
  const { data } = await apiClient.patch<User>(`/users/${id}`, input)
  return data
}
