import { apiClient } from './client'

interface PermissionsResponse {
  sections: string[]
  permissions: Record<string, string[]>
}

let cachedPermissions: PermissionsResponse | null = null

export async function getPermissions(): Promise<PermissionsResponse> {
  const { data } = await apiClient.get<PermissionsResponse>('/settings/permissions')
  cachedPermissions = data
  return data
}

export async function updatePermission(role: string, section: string, enabled: boolean): Promise<void> {
  await apiClient.put('/settings/permissions', { role, section, enabled })
  if (cachedPermissions) {
    const perms = cachedPermissions.permissions[role] || []
    if (enabled && !perms.includes(section)) {
      perms.push(section)
      cachedPermissions.permissions[role] = perms
    } else if (!enabled) {
      cachedPermissions.permissions[role] = perms.filter(s => s !== section)
    }
  }
}

export function hasCachedPermission(role: string | undefined, section: string): boolean {
  if (!role || !cachedPermissions) return false
  return cachedPermissions.permissions[role]?.includes(section) ?? false
}
