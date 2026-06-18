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

export function translateRiskBand(band: string | null): string {
  if (!band) return ''
  const b = band.toLowerCase()
  if (b.includes('high') || b.includes('alto')) return 'Alto'
  if (b.includes('low') || b.includes('bajo') || b.includes('minimal')) return 'Bajo'
  if (b.includes('moderate') || b.includes('moderado')) return 'Moderado'
  return band
}

export type RiskLevel = 'bajo' | 'moderado' | 'alto'

export type RiskStyles = {
  card: string
  badge: string
  number: string
  gaugeStroke: string
  arcId: string
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
          card: '',
          badge: 'bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-800/60',
          number: 'text-slate-900 dark:text-slate-100',
          gaugeStroke: '#ef4444',
          arcId: 'arc-high',
        }
      : level === 'bajo'
        ? {
            card: '',
            badge: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800/60',
            number: 'text-slate-900 dark:text-slate-100',
            gaugeStroke: '#10b981',
            arcId: 'arc-low',
          }
        : {
            card: '',
            badge: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-800/60',
            number: 'text-slate-900 dark:text-slate-100',
            gaugeStroke: '#0ea5e9',
            arcId: 'arc-moderate',
          }

  const levelLabel = level === 'alto' ? 'Alto' : level === 'bajo' ? 'Bajo' : 'Moderado'

  return { pct, level, levelLabel, styles }
}
