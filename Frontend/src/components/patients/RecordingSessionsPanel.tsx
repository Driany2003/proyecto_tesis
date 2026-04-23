import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { listRecordings } from '@/api/recordings'
import { BTN_SECONDARY, RECORDING_PAGE_SIZE } from './recording-session/constants'
import { SessionDetailContent } from './recording-session/SessionDetailContent'
import { SessionListRow } from './recording-session/SessionListRow'

export function RecordingSessionsPanel({ patientId }: { patientId: string }) {
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const location = useLocation()

  const { data: recordings = [], isLoading, isFetching } = useQuery({
    queryKey: ['recordings', patientId],
    queryFn: () => listRecordings(patientId),
    staleTime: 20_000,
    refetchOnWindowFocus: true,
    refetchInterval: (query) => {
      const list = query.state.data ?? []
      const hasProcessing = list.some(
        (r) => r.status === 'processing' || r.status === 'pending'
      )
      return hasProcessing ? 5_000 : false
    },
    refetchIntervalInBackground: false,
  })

  const total = recordings.length
  const totalPages = Math.max(1, Math.ceil(total / RECORDING_PAGE_SIZE))

  useEffect(() => {
    setPage(1)
    setSelectedId(null)
  }, [patientId])

  useEffect(() => {
    if (location.hash === '#analisis') {
      setPage(1)
    }
  }, [location.hash, patientId])

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages))
  }, [totalPages])

  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * RECORDING_PAGE_SIZE
  const pageItems = useMemo(
    () => recordings.slice(start, start + RECORDING_PAGE_SIZE),
    [recordings, start]
  )
  const rangeStart = total === 0 ? 0 : start + 1
  const rangeEnd = Math.min(safePage * RECORDING_PAGE_SIZE, total)

  useEffect(() => {
    if (recordings.length === 0) {
      setSelectedId(null)
      return
    }
    const pageIds = new Set(pageItems.map((r) => r.id))
    setSelectedId((current) => {
      if (current && pageIds.has(current)) return current
      return pageItems[0]?.id ?? null
    })
  }, [recordings, pageItems, safePage])

  return (
    <div>
      {isFetching && !isLoading && (
        <p className="mb-3 text-right text-xs font-medium text-sky-600 dark:text-sky-400">Actualizando…</p>
      )}

      {isLoading ? (
        <p className="text-sm text-slate-500">Cargando sesiones…</p>
      ) : total === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center text-sm text-slate-600 dark:border-slate-600 dark:bg-slate-800/30 dark:text-slate-400">
          No hay grabaciones para este paciente. Use <strong>Nueva grabación</strong> para iniciar una sesión.
        </p>
      ) : (
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="w-full shrink-0 lg:max-w-[min(100%,320px)]">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Lista de sesiones
            </p>
            <ul className="max-h-[min(70vh,520px)] space-y-2 overflow-y-auto pr-1">
              {pageItems.map((r, idx) => (
                <SessionListRow
                  key={r.id}
                  r={r}
                  selected={selectedId === r.id}
                  isLatest={safePage === 1 && idx === 0}
                  onSelect={() => setSelectedId(r.id)}
                />
              ))}
            </ul>

            {totalPages > 1 && (
              <nav
                className="mt-4 flex flex-col gap-2 border-t border-slate-200 pt-4 dark:border-slate-700"
                aria-label="Paginación de sesiones"
              >
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {rangeStart}–{rangeEnd} de {total} · pág. {safePage}/{totalPages}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={BTN_SECONDARY}
                    disabled={safePage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    className={BTN_SECONDARY}
                    disabled={safePage >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Siguiente
                  </button>
                </div>
              </nav>
            )}
          </div>

          <div className="min-h-[280px] flex-1 rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50/90 to-white p-5 shadow-inner dark:border-slate-600 dark:from-slate-900/80 dark:to-slate-900/40">
            {selectedId ? (
              <SessionDetailContent patientId={patientId} recordingId={selectedId} />
            ) : (
              <p className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
                Seleccione una sesión en la lista para ver el detalle del análisis.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
