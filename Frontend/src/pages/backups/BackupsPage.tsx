import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getBackups, restoreBackup } from '@/api/backups'
import { PageHeader, SectionCard, SectionCardSimple, SectionDivider } from '@/layout/PageSection'
import { IconDatabase } from '@/components/icons/SidebarIcons'

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export function BackupsPage() {
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const { data: backups = [], isLoading } = useQuery({
    queryKey: ['backups'],
    queryFn: getBackups,
  })

  const restoreMutation = useMutation({
    mutationFn: restoreBackup,
    onSuccess: (_, backupId) => {
      setRestoringId(null)
      queryClient.invalidateQueries({ queryKey: ['backups'] })
      const dateStr = new Date(backupId).toLocaleDateString('es-PE')
      setSuccessMessage(`Restauración solicitada (${dateStr}).`)
      setTimeout(() => setSuccessMessage(null), 4000)
    },
    onError: () => setRestoringId(null),
  })

  const handleRestore = (id: string) => {
    if (!window.confirm('¿Restaurar desde este respaldo? Esta acción puede sobrescribir datos actuales.')) return
    setRestoringId(id)
    restoreMutation.mutate(id)
  }

  const formatDate = (s: string) => new Date(s).toLocaleString('es-PE')

  return (
    <div>
      <PageHeader
        title="Respaldo de datos"
        subtitle="Historial de respaldos y restauración"
      />

      {successMessage && (
        <SectionCardSimple className="mb-6 border-sky-200/80 bg-sky-50/80 dark:border-sky-800/60 dark:bg-sky-950/30">
          <p className="text-sm font-medium text-sky-800 dark:text-sky-100">{successMessage}</p>
        </SectionCardSimple>
      )}

      <SectionCard
        title="Respaldo automático"
        description="Historial y restauración desde respaldos."
        icon={<IconDatabase className="h-5 w-5" />}
        className="mb-6 border-amber-200/80 bg-amber-50/50 dark:border-amber-800/50 dark:bg-amber-950/20"
      >
        <p className="text-sm text-amber-800 dark:text-amber-100">
          Los respaldos automáticos se ejecutan en el backend (por defecto 2:00 AM). Aquí puede ver el
          historial y solicitar una restauración.
        </p>
      </SectionCard>

      <SectionDivider label="Historial de respaldos" />
      {isLoading ? (
        <SectionCardSimple>
          <p className="py-8 text-center text-slate-500 dark:text-slate-400">Cargando…</p>
        </SectionCardSimple>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card dark:border-slate-600 dark:bg-slate-800">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="h-12 border-b border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-800/60">
                  <th className="px-4 py-3 text-left align-middle text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Fecha
                  </th>
                  <th className="px-4 py-3 text-left align-middle text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Tamaño
                  </th>
                  <th className="px-4 py-3 text-left align-middle text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Duración
                  </th>
                  <th className="px-4 py-3 text-left align-middle text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-left align-middle text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Integridad
                  </th>
                  <th className="px-4 py-3 text-right align-middle text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {backups.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-slate-500 dark:text-slate-400">
                      Todavía no hay registros.
                    </td>
                  </tr>
                ) : (
                  backups.map((b) => (
                    <tr key={b.id} className="border-b border-slate-100 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/50">
                      <td className="whitespace-nowrap px-4 py-3 align-middle font-medium text-slate-800 dark:text-slate-100">
                        {formatDate(b.date)}
                      </td>
                      <td className="px-4 py-3 align-middle text-slate-600 dark:text-slate-300">{formatBytes(b.sizeBytes)}</td>
                      <td className="px-4 py-3 align-middle text-slate-600 dark:text-slate-300">{b.durationSeconds} s</td>
                      <td className="px-4 py-3 align-middle">
                        <span
                          className={
                            b.status === 'success' ? 'text-sky-600 dark:text-sky-400' : 'text-red-600 dark:text-red-400'
                          }
                        >
                          {b.status === 'success' ? 'Éxito' : 'Error'}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-middle font-mono text-xs text-slate-500 dark:text-slate-400">
                        {b.integrityHash ?? '-'}
                      </td>
                      <td className="px-4 py-3 text-right align-middle">
                        <button
                          type="button"
                          disabled={b.status !== 'success' || restoringId === b.id}
                          onClick={() => handleRestore(b.id)}
                          className="btn-primary rounded-xl px-3 py-2 text-xs font-medium shadow-sm disabled:opacity-50"
                        >
                          {restoringId === b.id ? 'Restaurando…' : 'Restaurar'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
