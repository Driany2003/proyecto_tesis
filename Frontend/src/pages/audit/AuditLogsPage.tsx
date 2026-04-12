import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getAuditLogs, exportAuditLogs } from '@/api/audit'
import type { AuditLogFilters } from '@/types/audit'
import { PageHeader, SectionCard, SectionCardSimple, SectionDivider } from '@/layout/PageSection'
import { IconClipboard } from '@/components/icons/SidebarIcons'
import { DateRangePicker } from '@/components/ui/DateRangePicker'

export function AuditLogsPage() {
  const [filters, setFilters] = useState<AuditLogFilters>({})
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json')

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit-logs', filters],
    queryFn: () => getAuditLogs(filters),
  })

  const handleExport = async () => {
    const blob = await exportAuditLogs(filters, exportFormat)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.${exportFormat}`
    a.click()
    URL.revokeObjectURL(url)
  }

  const formatDate = (s: string) => new Date(s).toLocaleString('es-PE')

  return (
    <div>
      <PageHeader
        title="Logs de auditoría"
        subtitle="Trazabilidad de acciones y eventos del sistema"
      />

      <SectionDivider label="Filtros" />
      <SectionCard
        title="Filtros"
        description="Refine los registros por fecha, acción o resultado"
        icon={<IconClipboard className="h-5 w-5" />}
        className="mb-6"
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap items-end gap-4">
            <DateRangePicker
              label="Rango de fechas"
              placeholder="Seleccionar rango de fechas"
              value={{ fromDate: filters.fromDate, toDate: filters.toDate }}
              onChange={(range) =>
                setFilters((f) => ({ ...f, fromDate: range.fromDate, toDate: range.toDate }))
              }
            />
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Acción</label>
              <input
                type="text"
                placeholder="Ej: LOGIN"
                value={filters.action ?? ''}
                onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value || undefined }))}
                className="input-base"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Resultado</label>
              <select
                value={filters.result ?? ''}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, result: (e.target.value || undefined) as AuditLogFilters['result'] }))
                }
                className="input-base"
              >
                <option value="">Todos</option>
                <option value="success">Éxito</option>
                <option value="error">Error</option>
                <option value="denied">Denegado</option>
              </select>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Formato</label>
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value as 'json' | 'csv')}
                className="input-base w-auto min-w-[5.5rem]"
                aria-label="Formato de exportación"
              >
                <option value="json">JSON</option>
                <option value="csv">CSV</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">&nbsp;</label>
              <button
                type="button"
                onClick={handleExport}
                className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-colors hover:bg-sky-600 dark:bg-sky-600 dark:hover:bg-sky-500"
                aria-label="Exportar logs"
              >
                Exportar logs
              </button>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionDivider label="Registros" />
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
                    Fecha/Hora
                  </th>
                  <th className="px-4 py-3 text-left align-middle text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Usuario
                  </th>
                  <th className="px-4 py-3 text-left align-middle text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Acción
                  </th>
                  <th className="px-4 py-3 text-left align-middle text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Recurso
                  </th>
                  <th className="px-4 py-3 text-left align-middle text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Resultado
                  </th>
                  <th className="px-4 py-3 text-left align-middle text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    IP
                  </th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-slate-500 dark:text-slate-400">
                      Todavía no hay registros.
                    </td>
                  </tr>
                ) : (
                  logs.map((e) => (
                    <tr key={e.id} className="border-b border-slate-100 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/50">
                      <td className="whitespace-nowrap px-4 py-3 align-middle text-slate-600 dark:text-slate-300">
                        {formatDate(e.timestamp)}
                      </td>
                      <td className="px-4 py-3 align-middle font-medium text-slate-800 dark:text-slate-100">{e.userName}</td>
                      <td className="px-4 py-3 align-middle font-medium text-slate-800 dark:text-slate-100">{e.action}</td>
                      <td className="px-4 py-3 align-middle text-slate-600 dark:text-slate-300">
                        {e.resource}
                        {e.resourceId ? ` (${e.resourceId})` : ''}
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <span
                          className={
                            e.result === 'success'
                              ? 'text-sky-600 dark:text-sky-400'
                              : e.result === 'denied'
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-amber-600 dark:text-amber-400'
                          }
                        >
                          {e.result === 'success' ? 'Éxito' : e.result === 'denied' ? 'Denegado' : 'Error'}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-middle text-slate-500 dark:text-slate-400">{e.ip ?? '-'}</td>
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
