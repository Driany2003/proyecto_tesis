import { parkinsonRiskPresentation } from './utils'

type Props = {
  pParkinson: number
  riskBand: string | null
}

export function ParkinsonProbabilityBlock({ pParkinson, riskBand }: Props) {
  const { pct, level, levelLabel, styles } = parkinsonRiskPresentation(pParkinson, riskBand)
  const widthPct = Math.min(100, Math.max(0, pct))

  return (
    <section
      className={`overflow-hidden rounded-2xl border p-5 shadow-sm ring-1 ring-black/5 dark:ring-white/5 ${styles.card}`}
      aria-labelledby="parkinson-prob-heading"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p
            id="parkinson-prob-heading"
            className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
          >
            Probabilidad Parkinson (modelo)
          </p>
          <p className="mt-1 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
            Estimación de apoyo; no sustituye la evaluación clínica.
          </p>
        </div>
        <span
          className={`inline-flex w-fit shrink-0 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ring-1 ${styles.badge}`}
        >
          {levelLabel}
        </span>
      </div>

      <div className="mt-5 flex flex-wrap items-end gap-4">
        <div className={`min-w-[7rem] text-5xl font-bold tabular-nums leading-none tracking-tight ${styles.number}`}>
          {pct}
          <span className="text-2xl font-semibold text-slate-400 dark:text-slate-500">%</span>
        </div>
        <div className="min-w-0 flex-1 pb-1">
          <div className={`relative h-4 w-full overflow-hidden rounded-full ${styles.barBg}`}>
            <div
              className={`h-full rounded-full transition-[width] duration-500 ease-out ${styles.barFill}`}
              style={{ width: `${widthPct}%` }}
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Probabilidad ${pct} por ciento`}
            />
          </div>
          <div className="mt-2 flex justify-between text-[10px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </div>
      </div>

      {riskBand && (
        <p className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-slate-500 dark:text-slate-400">Banda del modelo:</span>
          <span className="rounded-md bg-white/90 px-2.5 py-1 font-semibold capitalize text-slate-800 ring-1 ring-slate-200 dark:bg-slate-800/90 dark:text-slate-100 dark:ring-slate-600">
            {riskBand}
          </span>
        </p>
      )}

      <p className={`mt-3 text-xs leading-relaxed ${styles.hint}`}>
        {level === 'alto' &&
          'Valor elevado: correlacionar con síntomas, historia y otros estudios antes de decisiones clínicas.'}
        {level === 'moderado' &&
          'Valor intermedio: conviene integrar con la exploración neurológica y el contexto del paciente.'}
        {level === 'bajo' &&
          'Valor bajo en este modelo: mantener el seguimiento clínico habitual según criterio médico.'}
      </p>
    </section>
  )
}
