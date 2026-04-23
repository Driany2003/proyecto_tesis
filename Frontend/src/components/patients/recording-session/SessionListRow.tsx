import type { RecordingSummary } from '@/api/recordings'
import { formatSessionDate, parkinsonRiskPresentation, statusBadgeClass, statusLabel } from './utils'

type Props = {
  r: RecordingSummary
  selected: boolean
  isLatest?: boolean
  onSelect: () => void
}

export function SessionListRow({ r, selected, isLatest, onSelect }: Props) {
  const processing = r.status === 'processing' || r.status === 'pending'
  const probStyles =
    r.status === 'completed' && r.pParkinson != null
      ? parkinsonRiskPresentation(r.pParkinson, r.riskBand).styles
      : null

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={`w-full rounded-xl border px-3 py-3 text-left transition ${
          selected
            ? 'border-sky-500 bg-sky-50 ring-2 ring-sky-200 dark:border-sky-500 dark:bg-sky-950/40 dark:ring-sky-900/60'
            : processing
              ? 'border-sky-200/80 bg-white hover:bg-sky-50/50 dark:border-sky-800 dark:bg-slate-900 dark:hover:bg-sky-950/20'
              : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:hover:bg-slate-800/80'
        }`}
      >
        <div className="flex flex-wrap items-center gap-1.5">
          {isLatest && (
            <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-sky-900 dark:bg-sky-900/60 dark:text-sky-100">
              Reciente
            </span>
          )}
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusBadgeClass(r.status)}`}>
            {statusLabel(r.status)}
          </span>
        </div>
        <p className="mt-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Fecha</p>
        <p className="text-sm font-semibold leading-snug text-slate-900 dark:text-slate-100">
          {formatSessionDate(r.createdAt)}
        </p>
        <p className="mt-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Médico</p>
        <p className="truncate text-sm text-slate-800 dark:text-slate-200" title={r.physicianName ?? undefined}>
          {r.physicianName?.trim() || '—'}
        </p>
        <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
          <span className="tabular-nums">{r.durationSeconds}s</span>
          {r.status === 'completed' && r.pParkinson != null && probStyles && (
            <>
              {' '}
              ·{' '}
              <span className={`font-bold tabular-nums ${probStyles.number}`}>
                {(r.pParkinson * 100).toFixed(1)}%
              </span>
              {r.riskBand ? (
                <span className="font-medium text-slate-600 dark:text-slate-300"> ({r.riskBand})</span>
              ) : null}
            </>
          )}
        </p>
      </button>
    </li>
  )
}
