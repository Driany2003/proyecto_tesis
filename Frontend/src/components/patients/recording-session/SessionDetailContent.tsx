import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { getRecording, patchRecordingNotes, type RecordingListItem } from '@/api/recordings'
import { BTN_SECONDARY } from './constants'
import { ParkinsonProbabilityBlock } from './ParkinsonProbabilityBlock'
import { SessionCharts } from './SessionCharts'
import { formatSessionDate, statusBadgeClass, statusLabel } from './utils'

type Props = {
  patientId: string
  recordingId: string
}

export function SessionDetailContent({ patientId, recordingId }: Props) {
  const queryClient = useQueryClient()

  const detailQuery = useQuery({
    queryKey: ['recording', patientId, recordingId],
    queryFn: () => getRecording(patientId, recordingId),
    enabled: !!recordingId,
    staleTime: 30_000,
  })

  const r: RecordingListItem | undefined = detailQuery.data
  const processing = r && (r.status === 'processing' || r.status === 'pending')

  const [considerations, setConsiderations] = useState('')
  const [annotations, setAnnotations] = useState('')
  const [complications, setComplications] = useState('')

  useEffect(() => {
    setConsiderations(r?.noteConsiderations ?? '')
    setAnnotations(r?.noteAnnotations ?? '')
    setComplications(r?.noteComplications ?? '')
  }, [r?.id, r?.noteConsiderations, r?.noteAnnotations, r?.noteComplications])

  const saveNotes = useMutation({
    mutationFn: () =>
      patchRecordingNotes(patientId, recordingId, {
        noteConsiderations: considerations,
        noteAnnotations: annotations,
        noteComplications: complications,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recordings', patientId] })
      queryClient.invalidateQueries({ queryKey: ['recording', patientId, recordingId] })
    },
  })

  if (detailQuery.isLoading) {
    return (
      <p className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">Cargando detalle de la sesión…</p>
    )
  }

  if (detailQuery.isError) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-red-600 dark:text-red-400">{(detailQuery.error as Error).message}</p>
        <button
          type="button"
          className={`${BTN_SECONDARY} mt-3`}
          onClick={() => void detailQuery.refetch()}
        >
          Reintentar
        </button>
      </div>
    )
  }

  if (!r) {
    return null
  }

  return (
    <div className="space-y-6">
      <header className="border-b border-slate-200/90 pb-4 dark:border-slate-600/80">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Sesión seleccionada
        </p>
        <p className="mt-1 font-mono text-xs text-slate-600 dark:text-slate-300">{r.id}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadgeClass(r.status)}`}
          >
            {statusLabel(r.status)}
          </span>
        </div>
        <dl className="mt-3 space-y-1.5 text-sm">
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-slate-500 dark:text-slate-400">Fecha del registro</dt>
            <dd className="font-medium text-slate-900 dark:text-slate-100">{formatSessionDate(r.createdAt)}</dd>
          </div>
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-slate-500 dark:text-slate-400">Duración</dt>
            <dd className="font-medium tabular-nums text-slate-900 dark:text-slate-100">{r.durationSeconds}s</dd>
          </div>
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-slate-500 dark:text-slate-400">Médico</dt>
            <dd className="font-medium text-slate-900 dark:text-slate-100">
              {r.physicianName?.trim() || 'No registrado'}
            </dd>
          </div>
        </dl>
        {r.processedAt && (
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Análisis listo {formatSessionDate(r.processedAt)}
          </p>
        )}
      </header>

      <section className="rounded-xl border border-slate-200 bg-white/80 p-4 dark:border-slate-600 dark:bg-slate-900/50">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Audio de la grabación
        </h3>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Archivo original de voz usado para el análisis (misma toma enviada al pipeline). Si el reproductor falla por
          tiempo de enlace, use «Renovar enlace».
        </p>
        {r.audioAvailable ? (
          <>
            {r.audioUrl ? (
              <div className="mt-3">
                <audio key={r.audioUrl} controls className="h-10 w-full max-w-full" src={r.audioUrl} />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <p className="text-[11px] text-slate-400">
                    Enlace ~{r.audioUrlExpiresInMinutes ?? '—'} min
                  </p>
                  <button type="button" className={BTN_SECONDARY} onClick={() => void detailQuery.refetch()}>
                    Renovar enlace
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  No se generó el enlace en esta carga. Pulse reintentar.
                </p>
                <button type="button" className={BTN_SECONDARY} onClick={() => void detailQuery.refetch()}>
                  Reintentar
                </button>
              </div>
            )}
          </>
        ) : (
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">No hay audio asociado a esta sesión.</p>
        )}
      </section>

      {processing && (
        <div className="flex gap-3 rounded-lg border border-sky-200/90 bg-sky-50/90 px-3 py-2.5 dark:border-sky-800/60 dark:bg-sky-950/35">
          <span className="mt-0.5 h-2 w-2 shrink-0 animate-pulse rounded-full bg-sky-500" aria-hidden />
          <p className="text-sm leading-relaxed text-sky-950 dark:text-sky-100">
            <strong>En análisis.</strong> Cuando termine, aquí aparecerán la probabilidad y los gráficos. Actualice la
            página o vuelva más tarde.
          </p>
        </div>
      )}

      {r.status === 'completed' && r.pParkinson != null && (
        <ParkinsonProbabilityBlock pParkinson={r.pParkinson} riskBand={r.riskBand} />
      )}

      {r.status === 'failed' && r.errorMessage && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          {r.errorMessage}
        </p>
      )}

      {r.status === 'completed' && r.charts && <SessionCharts charts={r.charts} />}

      {r.status === 'completed' && !r.charts && (
        <p className="text-sm text-slate-500 dark:text-slate-500">
          Sin gráficos guardados (sesión anterior al callback o pipeline sin gráficos).
        </p>
      )}

      <section className="border-t border-slate-200 pt-5 dark:border-slate-600">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Notas de la sesión</h3>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          Consideraciones, anotaciones y complicaciones (quedan guardadas solo en esta grabación).
        </p>
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Consideraciones</span>
            <textarea
              value={considerations}
              onChange={(e) => setConsiderations(e.target.value)}
              rows={3}
              className="input-base min-h-[72px] w-full resize-y"
              placeholder="Ej. contexto clínico, medicación relevante para la sesión…"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Anotaciones</span>
            <textarea
              value={annotations}
              onChange={(e) => setAnnotations(e.target.value)}
              rows={3}
              className="input-base min-h-[72px] w-full resize-y"
              placeholder="Observaciones durante la grabación…"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Complicaciones</span>
            <textarea
              value={complications}
              onChange={(e) => setComplications(e.target.value)}
              rows={3}
              className="input-base min-h-[72px] w-full resize-y"
              placeholder="Incidencias o complicaciones durante la toma…"
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={saveNotes.isPending}
            onClick={() => saveNotes.mutate()}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:opacity-50 dark:bg-sky-600 dark:hover:bg-sky-500"
          >
            {saveNotes.isPending ? 'Guardando…' : 'Guardar notas'}
          </button>
          {saveNotes.isSuccess && (
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Guardado</span>
          )}
        </div>
        {saveNotes.isError && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">{(saveNotes.error as Error).message}</p>
        )}
      </section>
    </div>
  )
}
