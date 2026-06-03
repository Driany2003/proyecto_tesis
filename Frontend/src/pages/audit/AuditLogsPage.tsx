import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getAuditLogs, exportAuditLogs } from '@/api/audit'
import type { AuditLogFilters } from '@/types/audit'
import { PageHeader, SectionCard, SectionCardSimple, SectionDivider } from '@/layout/PageSection'
import { IconClipboard } from '@/components/icons/SidebarIcons'
import { DateRangePicker } from '@/components/ui/DateRangePicker'

function resultBadge(result: string) {
  const r = result.toUpperCase()
  if (r === 'SUCCESS') return { label: 'Éxito', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' }
  if (r === 'DENIED') return { label: 'Denegado', cls: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300' }
  if (r === 'ERROR') return { label: 'Error', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' }
  return { label: result, cls: 'bg-slate-50 text-slate-700 dark:bg-slate-700 dark:text-slate-300' }
}

function roleBadge(role?: string) {
  if (!role) return null
  const labels: Record<string, string> = { ADMIN: 'Admin', MEDICO: 'Médico', AUDITOR: 'Auditor' }
  return (
    <span className="ml-1.5 inline-flex rounded-full bg-slate-100 px-1.5 py-px text-[10px] font-medium text-slate-500 dark:bg-slate-700 dark:text-slate-400">
      {labels[role] ?? role}
    </span>
  )
}

export function AuditLogsPage() {
  const [filters, setFilters] = useState<AuditLogFilters>({})
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit-logs', filters],
    queryFn: () => getAuditLogs(filters),
  })

  const handleExport = async (format: 'csv' | 'json') => {
    const blob = await exportAuditLogs(filters, format)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.${format}`
    a.click()
    URL.revokeObjectURL(url)
  }

  const formatDate = (s: string) => new Date(s).toLocaleString('es-PE', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  return (
    <div>
      <PageHeader section="Auditoría"
        title="Trazabilidad del sistema"
        subtitle="Registro completo de acciones: inicios de sesión, altas, modificaciones, pipeline de IA y umbrales clínicos"
      />

      <SectionDivider label="Filtros" />
      <SectionCard
        title="Filtrar eventos"
        description="Acote los registros por fecha, acción, resultado o usuario"
        icon={<IconClipboard className="h-5 w-5" />}
        className="mb-6"
      >
        <div className="flex flex-wrap items-end gap-4">
          <DateRangePicker
            label="Rango de fechas"
            placeholder="Seleccionar rango"
            value={{ fromDate: filters.fromDate, toDate: filters.toDate }}
            onChange={(range) =>
              setFilters((f) => ({ ...f, fromDate: range.fromDate, toDate: range.toDate }))
            }
          />
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Acción</label>
            <select
              value={filters.action ?? ''}
              onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value || undefined }))}
              className="input-base"
            >
              <option value="">Todas</option>
              <option value="LOGIN">LOGIN</option>
              <option value="CREATE">CREATE</option>
              <option value="UPDATE">UPDATE</option>
              <option value="UPLOAD">UPLOAD</option>
              <option value="PIPELINE_TRIGGER">PIPELINE_TRIGGER</option>
              <option value="PIPELINE_RESULT">PIPELINE_RESULT</option>
              <option value="PIPELINE_FAILED">PIPELINE_FAILED</option>
              <option value="THRESHOLD_SAVE">THRESHOLD_SAVE</option>
            </select>
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
              <option value="SUCCESS">Éxito</option>
              <option value="ERROR">Error</option>
              <option value="DENIED">Denegado</option>
            </select>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <button
              type="button"
              onClick={() => handleExport('csv')}
              className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-sky-600"
            >
              Exportar CSV
            </button>
          </div>
        </div>
      </SectionCard>

      <SectionDivider label={`${logs.length} registros`} />
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
                  <th className="px-4 py-3 text-left align-middle text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">Fecha</th>
                  <th className="px-4 py-3 text-left align-middle text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">Usuario</th>
                  <th className="px-4 py-3 text-left align-middle text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">Acción</th>
                  <th className="px-4 py-3 text-left align-middle text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">Recurso</th>
                  <th className="px-4 py-3 text-left align-middle text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">Resultado</th>
                  <th className="px-4 py-3 text-left align-middle text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">IP</th>
                  <th className="px-4 py-3 text-right align-middle text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-500 dark:text-slate-400">
                      Sin registros con los filtros actuales.
                    </td>
                  </tr>
                ) : (
                  logs.map((e) => {
                    const badge = resultBadge(e.result)
                    const isExpanded = expandedId === e.id
                    return (
                      <>
                        <tr
                          key={e.id}
                          className="border-b border-slate-100 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/50 cursor-pointer"
                          onClick={() => toggleExpand(e.id)}
                        >
                          <td className="whitespace-nowrap px-4 py-3 align-middle font-mono text-xs text-slate-600 dark:text-slate-300">
                            {formatDate(e.timestamp)}
                          </td>
                          <td className="px-4 py-3 align-middle">
                            <span className="font-medium text-slate-800 dark:text-slate-100">{e.userName ?? 'Sistema'}</span>
                            {e.userRole && roleBadge(e.userRole)}
                            {e.userEmail && (
                              <span className="block text-[11px] text-slate-400">{e.userEmail}</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 align-middle">
                            <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-mono font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                              {e.action}
                            </span>
                          </td>
                          <td className="px-4 py-3 align-middle text-slate-600 dark:text-slate-300">
                            {e.resource}
                            {e.resourceId ? (
                              <span className="ml-1 font-mono text-[11px] text-slate-400">({e.resourceId.slice(0, 12)}…)</span>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 align-middle">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${badge.cls}`}>
                              {badge.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 align-middle font-mono text-xs text-slate-500 dark:text-slate-400">{e.ip ?? '—'}</td>
                          <td className="px-4 py-3 text-right align-middle">
                            <span className="text-xs text-slate-400">{isExpanded ? '▲' : '▼'}</span>
                          </td>
                        </tr>
                        {isExpanded && e.details && (
                          <tr key={`${e.id}-detail`} className="border-b border-slate-100 bg-slate-50/50 dark:border-slate-700 dark:bg-slate-800/50">
                            <td colSpan={7} className="px-6 py-3">
                              <div className="space-y-2">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Detalle</p>
                                <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">{e.details}</p>
                                <div className="flex flex-wrap gap-4 text-[11px] text-slate-400">
                                  <span>ID: {e.id}</span>
                                  {e.userId && <span>UserID: {e.userId}</span>}
                                  {e.resourceId && <span>ResourceID: {e.resourceId}</span>}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
