import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getPermissions, updatePermission } from '@/api/permissions'
import { useToast } from '@/contexts/ToastContext'
import { PageHeader, SectionCard, SectionDivider } from '@/layout/PageSection'
import { IconUserPlus } from '@/components/icons/SidebarIcons'

const SECTION_LABELS: Record<string, string> = {
  dashboard:     'Inicio',
  patients:      'Pacientes',
  recordings:    'Nueva grabación',
  collection:    'Recolección de datos',
  users:         'Gestión de usuarios',
  configuracion: 'Configuración',
  audit:         'Logs de auditoría',
}

export function PermissionSettingsPage() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [saving, setSaving] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['permissions'],
    queryFn: getPermissions,
  })

  const mutation = useMutation({
    mutationFn: ({ role, section, enabled }: { role: string; section: string; enabled: boolean }) =>
      updatePermission(role, section, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permissions'] })
      setSaving(null)
      toast.success('Permiso actualizado')
    },
    onError: () => {
      setSaving(null)
      toast.error('Error al actualizar permiso')
    }
  })

  const handleToggle = (role: string, section: string, currentEnabled: boolean) => {
    setSaving(`${role}/${section}`)
    mutation.mutate({ role, section, enabled: !currentEnabled })
  }

  const isEnabled = (role: string, section: string) =>
    data?.permissions[role]?.includes(section) ?? false

  const roles = data?.permissions ? Object.keys(data.permissions) : []
  const sections = data?.sections || []

  return (
    <div>
      <PageHeader section="Administración"
        title="Permisos por rol"
        subtitle="Active o desactive el acceso de cada rol a las secciones del sistema"
      />

      <SectionDivider label="Configuración" />
      <SectionCard
        title="Matriz de permisos"
        description="Cada interruptor controla si el rol puede ver y usar esa sección"
        icon={<IconUserPlus className="h-5 w-5" />}
      >
        {isLoading ? (
          <p className="py-8 text-center text-slate-500">Cargando permisos…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-600">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Sección</th>
                  {roles.map(role => (
                    <th key={role} className="px-4 py-3 text-center text-xs font-semibold uppercase text-slate-500">
                      {role === 'ADMIN' ? 'Administrador' : role === 'MEDICO' ? 'Médico' : 'Auditor'}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sections.map(section => (
                  <tr key={section} className="border-b border-slate-100 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/50">
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">
                      {SECTION_LABELS[section] || section}
                    </td>
                    {roles.map(role => {
                      const enabled = isEnabled(role, section)
                      const isThisSaving = saving === `${role}/${section}`
                      return (
                        <td key={role} className="px-4 py-3 text-center">
                          <button
                            type="button"
                            disabled={isThisSaving}
                            onClick={() => handleToggle(role, section, enabled)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                              enabled ? 'bg-sky-500' : 'bg-slate-300 dark:bg-slate-600'
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                                enabled ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  )
}
