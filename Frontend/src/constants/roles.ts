export const ROLES = {
  ADMIN: 'ADMIN',
  MEDICO: 'MEDICO',
  AUDITOR: 'AUDITOR',
} as const

export type Role = (typeof ROLES)[keyof typeof ROLES]

export const ROLE_KEYS = Object.keys(ROLES) as (keyof typeof ROLES)[]

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Administrador',
  MEDICO: 'Médico',
  AUDITOR: 'Auditor',
}

export function roleLabel(role: string): string {
  return ROLE_LABELS[role as Role] ?? role
}
