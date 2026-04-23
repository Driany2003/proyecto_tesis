export function formatSessionDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export function statusBadgeClass(status: string): string {
  if (status === 'completed') {
    return 'bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-200 dark:ring-emerald-800'
  }
  if (status === 'failed') {
    return 'bg-red-100 text-red-900 ring-1 ring-red-200 dark:bg-red-950/50 dark:text-red-200 dark:ring-red-800'
  }
  return 'bg-amber-100 text-amber-950 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-100 dark:ring-amber-800'
}

export function statusLabel(status: string): string {
  if (status === 'processing') return 'Procesando'
  if (status === 'completed') return 'Completado'
  if (status === 'failed') return 'Error'
  if (status === 'pending') return 'Pendiente'
  return status
}

type RiskLevel = 'bajo' | 'moderado' | 'alto'

type RiskStyles = {
  card: string
  barBg: string
  barFill: string
  badge: string
  number: string
  hint: string
}

export function parkinsonRiskPresentation(p: number, riskBand: string | null) {
  const pct = Math.round(p * 1000) / 10
  const band = (riskBand || '').toLowerCase()

  let level: RiskLevel = 'moderado'
  if (band.includes('high') || band.includes('alto') || p >= 0.7) level = 'alto'
  else if (band.includes('low') || band.includes('bajo') || band.includes('minimal') || p < 0.4) level = 'bajo'

  const styles: RiskStyles =
    level === 'alto'
      ? {
          card: 'border-red-200/90 bg-gradient-to-br from-red-50 via-white to-rose-50/80 dark:border-red-900/50 dark:from-red-950/40 dark:via-slate-900 dark:to-rose-950/30',
          barBg: 'bg-red-100/80 dark:bg-red-950/50',
          barFill: 'bg-gradient-to-r from-red-500 to-rose-600',
          badge: 'bg-red-100 text-red-900 ring-red-200 dark:bg-red-950/80 dark:text-red-100 dark:ring-red-800',
          number: 'text-red-700 dark:text-red-200',
          hint: 'text-red-800/90 dark:text-red-200/90',
        }
      : level === 'bajo'
        ? {
            card: 'border-emerald-200/90 bg-gradient-to-br from-emerald-50 via-white to-teal-50/80 dark:border-emerald-900/40 dark:from-emerald-950/35 dark:via-slate-900 dark:to-teal-950/25',
            barBg: 'bg-emerald-100/80 dark:bg-emerald-950/50',
            barFill: 'bg-gradient-to-r from-emerald-500 to-teal-600',
            badge: 'bg-emerald-100 text-emerald-900 ring-emerald-200 dark:bg-emerald-950/80 dark:text-emerald-100 dark:ring-emerald-800',
            number: 'text-emerald-800 dark:text-emerald-200',
            hint: 'text-emerald-900/90 dark:text-emerald-100/90',
          }
        : {
            card: 'border-amber-200/90 bg-gradient-to-br from-amber-50 via-white to-orange-50/70 dark:border-amber-900/45 dark:from-amber-950/35 dark:via-slate-900 dark:to-orange-950/25',
            barBg: 'bg-amber-100/80 dark:bg-amber-950/50',
            barFill: 'bg-gradient-to-r from-amber-500 to-orange-500',
            badge: 'bg-amber-100 text-amber-950 ring-amber-200 dark:bg-amber-950/80 dark:text-amber-100 dark:ring-amber-800',
            number: 'text-amber-900 dark:text-amber-100',
            hint: 'text-amber-950/90 dark:text-amber-100/90',
          }

  const levelLabel =
    level === 'alto' ? 'Riesgo estimado alto' : level === 'bajo' ? 'Riesgo estimado bajo' : 'Riesgo estimado moderado'

  return { pct, level, levelLabel, styles }
}
