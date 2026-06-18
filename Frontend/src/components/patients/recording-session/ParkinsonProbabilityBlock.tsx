import { useMemo } from 'react'
import { parkinsonRiskPresentation, translateRiskBand } from './utils'

type Props = {
  pParkinson: number
  riskBand: string | null
  ciLow?: number | null
  ciHigh?: number | null
}

function CircularGauge({
  pct,
  strokeColor,
  arcId,
}: {
  pct: number
  strokeColor: string
  arcId: string
}) {
  const radius = 70
  const strokeWidth = 10
  const cx = 90
  const cy = 90
  const circumference = Math.PI * radius

  const clampedPct = Math.min(100, Math.max(0, pct))
  const arcLength = (clampedPct / 100) * circumference

  const ticks = useMemo(() => {
    const result: { x1: number; y1: number; x2: number; y2: number }[] = []
    for (let i = 0; i <= 10; i++) {
      const angle = Math.PI + (i / 10) * Math.PI
      const outerR = radius + strokeWidth / 2 + 3
      const innerR = radius + strokeWidth / 2 - 1
      result.push({
        x1: cx + Math.cos(angle) * innerR,
        y1: cy + Math.sin(angle) * innerR,
        x2: cx + Math.cos(angle) * outerR,
        y2: cy + Math.sin(angle) * outerR,
      })
    }
    return result
  }, [])

  return (
    <svg viewBox="0 0 180 115" className="block w-full max-w-[200px]" aria-hidden="true">
      <defs>
        <filter id={`${arcId}-glow`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {ticks.map((t, i) => (
        <line
          key={i}
          x1={t.x1}
          y1={t.y1}
          x2={t.x2}
          y2={t.y2}
          className="stroke-slate-200 dark:stroke-slate-600"
          strokeWidth={i % 5 === 0 ? 1.25 : 0.5}
        />
      ))}

      <path
        d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
        fill="none"
        className="stroke-slate-100 dark:stroke-slate-700/60"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />

      <path
        d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={`${circumference}`}
        strokeDashoffset={circumference - arcLength}
        filter={`url(#${arcId}-glow)`}
        style={{
          transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      />

      <text
        x={cx}
        y={cy - 6}
        textAnchor="middle"
        className="fill-slate-900 dark:fill-slate-100"
        fontSize="26"
        fontWeight="700"
        fontFamily="Inter, system-ui, sans-serif"
      >
        {pct}
      </text>
      <text
        x={cx}
        y={cy + 10}
        textAnchor="middle"
        className="fill-slate-400 dark:fill-slate-500"
        fontSize="11"
        fontWeight="500"
        fontFamily="Inter, system-ui, sans-serif"
      >
        %
      </text>
    </svg>
  )
}

export function ParkinsonProbabilityBlock({ pParkinson, riskBand, ciLow, ciHigh }: Props) {
  const { pct, level, levelLabel, styles } = parkinsonRiskPresentation(pParkinson, riskBand)
  const translatedBand = translateRiskBand(riskBand)

  return (
    <section
      className={`overflow-hidden rounded-xl border border-slate-200 bg-white/80 p-5 shadow-sm dark:border-slate-600 dark:bg-slate-900/50 ${styles.card}`}
      aria-labelledby="parkinson-prob-heading"
    >
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p
            id="parkinson-prob-heading"
            className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
          >
            Probabilidad de Parkinson
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-slate-400 dark:text-slate-500">
            Estimación de apoyo · no sustituye evaluación clínica
          </p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center rounded-full px-3 py-1 text-xs font-semibold ${styles.badge}`}
        >
          {levelLabel}
        </span>
      </div>

      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
        <div className="shrink-0">
          <CircularGauge
            pct={pct}
            strokeColor={styles.gaugeStroke}
            arcId={styles.arcId}
          />
        </div>

        <div className="flex-1 text-center sm:text-left">
          <span className={`text-5xl font-bold tabular-nums leading-none tracking-tight ${styles.number}`}>
            {pct}
            <span className="text-2xl font-medium text-slate-400 dark:text-slate-500">%</span>
          </span>

          {ciLow != null && ciHigh != null && (
            <p className="mt-2 font-mono text-xs text-slate-500 dark:text-slate-400">
              IC 95%: {(ciLow * 100).toFixed(1)}% – {(ciHigh * 100).toFixed(1)}%
            </p>
          )}

          {translatedBand && (
            <p className="mt-3 flex items-center justify-center gap-1.5 text-sm sm:justify-start">
              <span className="text-slate-500 dark:text-slate-400">Clasificación:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{translatedBand}</span>
              {riskBand && riskBand.toLowerCase() !== translatedBand.toLowerCase() && (
                <span className="text-xs text-slate-400 dark:text-slate-500">({riskBand})</span>
              )}
            </p>
          )}

          <div className="mt-4">
            <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700/60">
              <div
                className="h-full rounded-full transition-[width] duration-700 ease-out"
                style={{
                  width: `${Math.min(100, Math.max(0, pct))}%`,
                  backgroundColor: styles.gaugeStroke,
                }}
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Probabilidad ${pct} por ciento`}
              />
            </div>
            <div className="mt-1 flex justify-between text-[10px] font-medium text-slate-400 dark:text-slate-500">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>

          <p className="mt-3 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
            {level === 'alto' &&
              'Valor elevado: correlacionar con síntomas, historia y otros estudios antes de decisiones clínicas.'}
            {level === 'moderado' &&
              'Valor intermedio: integrar con la exploración neurológica y el contexto del paciente.'}
            {level === 'bajo' &&
              'Valor bajo: mantener el seguimiento clínico habitual según criterio médico.'}
          </p>
        </div>
      </div>
    </section>
  )
}
