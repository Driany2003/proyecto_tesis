import type { RecordingCharts } from '@/api/recordings'
import { CHART_LABELS } from './constants'

type Props = {
  charts: RecordingCharts
}

export function SessionCharts({ charts }: Props) {
  const entries = Object.entries(charts).filter(([, url]) => url?.startsWith('http'))
  if (entries.length === 0) return null

  return (
    <div>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Gráficos del análisis
      </p>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {entries.map(([key, url]) => (
          <figure
            key={key}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-600 dark:bg-slate-900"
          >
            <div className="border-b border-slate-100 bg-slate-50 px-3 py-2 text-center text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {CHART_LABELS[key] ?? key}
            </div>
            <a href={url} target="_blank" rel="noopener noreferrer" className="block">
              <img
                src={url}
                alt={CHART_LABELS[key] ?? key}
                className="h-auto w-full object-contain"
                loading="lazy"
              />
            </a>
          </figure>
        ))}
      </div>
    </div>
  )
}
