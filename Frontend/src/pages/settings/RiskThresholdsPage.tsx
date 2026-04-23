import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  getRiskThresholds,
  updateRiskThresholds,
  getThresholdHistory,
  resetRiskThresholds,
  DEFAULT_THRESHOLDS,
} from '@/api/settings'
import type { RiskThresholds } from '@/types/settings'
import { PageHeader, SectionCard, SectionCardSimple, SectionDivider } from '@/layout/PageSection'
import { IconChart } from '@/components/icons/SidebarIcons'

const schema = z
  .object({
    lowMax: z.coerce.number().min(0).max(100),
    moderateMin: z.coerce.number().min(0).max(100),
    moderateMax: z.coerce.number().min(0).max(100),
    highMin: z.coerce.number().min(0).max(100),
    alertThreshold: z.coerce.number().min(0).max(100),
    criticalThreshold: z.union([z.coerce.number().min(0).max(100), z.literal('')]),
  })
  .refine((d) => d.lowMax <= d.moderateMin, {
    message: 'El máximo de bajo debe ser ≤ al mínimo de moderado (30 y 30 es válido en la frontera).',
    path: ['moderateMin'],
  })
  .refine((d) => d.moderateMin <= d.moderateMax, {
    message: 'Moderado: el mínimo debe ser ≤ al máximo.',
    path: ['moderateMax'],
  })
  .refine((d) => d.moderateMax <= d.highMin, {
    message: 'El máximo de moderado debe ser ≤ al mínimo de alto (60 y 60 es válido en la frontera).',
    path: ['highMin'],
  })

type FormValues = z.infer<typeof schema>

export function RiskThresholdsPage() {
  const queryClient = useQueryClient()

  const { data: thresholds, isLoading } = useQuery({
    queryKey: ['risk-thresholds'],
    queryFn: getRiskThresholds,
  })

  const { data: history = [] } = useQuery({
    queryKey: ['threshold-history'],
    queryFn: getThresholdHistory,
  })

  const invalidateThresholdQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['risk-thresholds'] })
    queryClient.invalidateQueries({ queryKey: ['threshold-history'] })
  }

  const updateMutation = useMutation({
    mutationFn: ({ values, reason }: { values: RiskThresholds; reason?: string }) =>
      updateRiskThresholds(values, reason),
    onSuccess: invalidateThresholdQueries,
  })

  const resetMutation = useMutation({
    mutationFn: resetRiskThresholds,
    onSuccess: invalidateThresholdQueries,
  })

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as import('react-hook-form').Resolver<FormValues>,
    defaultValues: {
      lowMax: DEFAULT_THRESHOLDS.lowMax,
      moderateMin: DEFAULT_THRESHOLDS.moderateMin,
      moderateMax: DEFAULT_THRESHOLDS.moderateMax,
      highMin: DEFAULT_THRESHOLDS.highMin,
      alertThreshold: DEFAULT_THRESHOLDS.alertThreshold,
      criticalThreshold: DEFAULT_THRESHOLDS.criticalThreshold ?? '',
    },
  })

  const { register, handleSubmit, formState: { errors }, reset } = form

  useEffect(() => {
    if (thresholds) {
      reset({
        lowMax: thresholds.lowMax,
        moderateMin: thresholds.moderateMin,
        moderateMax: thresholds.moderateMax,
        highMin: thresholds.highMin,
        alertThreshold: thresholds.alertThreshold,
        criticalThreshold: thresholds.criticalThreshold ?? '',
      })
    }
  }, [thresholds, reset])

  const onSubmit = (data: FormValues) => {
    const reason = window.prompt('Justificación del cambio (opcional):')
    updateMutation.mutate({
      values: {
        lowMax: data.lowMax,
        moderateMin: data.moderateMin,
        moderateMax: data.moderateMax,
        highMin: data.highMin,
        alertThreshold: data.alertThreshold,
        criticalThreshold:
          data.criticalThreshold === '' ? undefined : Number(data.criticalThreshold),
      },
      reason: reason ?? undefined,
    })
  }

  const handleReset = () => {
    if (
      !window.confirm(
        '¿Restaurar valores por defecto? (bajo ≤30%, moderado 30–60%, alto ≥60%; alerta 70%, crítico 85%)',
      )
    )
      return
    resetMutation.mutate()
  }

  if (isLoading) return (
    <div>
      <PageHeader title="Umbrales de riesgo" subtitle="Configuración de rangos para bajo, moderado y alto riesgo" />
      <SectionCardSimple>
        <p className="py-8 text-center text-slate-500 dark:text-slate-400">Cargando…</p>
      </SectionCardSimple>
    </div>
  )

  return (
    <div>
      <PageHeader
        title="Umbrales de riesgo"
        subtitle="Configuración de rangos para bajo, moderado y alto riesgo"
      />

      <SectionDivider label="Umbrales actuales" />
      <SectionCard
        title="Umbrales actuales"
        description="Porcentajes que definen los rangos de riesgo del modelo"
        icon={<IconChart className="h-5 w-5" />}
        className="mb-6"
      >
        <form onSubmit={handleSubmit((data: FormValues) => onSubmit(data))} className="grid max-w-xl grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-600">Riesgo bajo (máx %)</label>
            <input
              type="number"
              min={0}
              max={100}
              className="input-base"
              {...register('lowMax')}
            />
            {errors.lowMax && (
              <p className="mt-1.5 text-sm text-red-600">{errors.lowMax.message}</p>
            )}
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-600">Riesgo moderado (mín %)</label>
            <input
              type="number"
              min={0}
              max={100}
              className="input-base"
              {...register('moderateMin')}
            />
            {errors.moderateMin && (
              <p className="mt-1.5 text-sm text-red-600">{errors.moderateMin.message}</p>
            )}
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-600">Riesgo moderado (máx %)</label>
            <input
              type="number"
              min={0}
              max={100}
              className="input-base"
              {...register('moderateMax')}
            />
            {errors.moderateMax && (
              <p className="mt-1.5 text-sm text-red-600">{errors.moderateMax.message}</p>
            )}
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-600">Riesgo alto (mín %)</label>
            <input
              type="number"
              min={0}
              max={100}
              className="input-base"
              {...register('highMin')}
            />
            {errors.highMin && (
              <p className="mt-1.5 text-sm text-red-600">{errors.highMin.message}</p>
            )}
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-600">Umbral alertas (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              className="input-base"
              {...register('alertThreshold')}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-600">Umbral crítico (%) opcional</label>
            <input
              type="number"
              min={0}
              max={100}
              placeholder="85"
              className="input-base"
              {...register('criticalThreshold')}
            />
          </div>
          <div className="col-span-2 flex flex-wrap gap-3 pt-2">
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="btn-primary rounded-xl px-5 py-2.5 text-sm shadow-sm disabled:opacity-50"
            >
              Guardar cambios
            </button>
            <button
              type="button"
              onClick={handleReset}
              disabled={resetMutation.isPending}
              className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
            >
              Restaurar valores por defecto
            </button>
          </div>
        </form>
      </SectionCard>

      <SectionDivider label="Historial de configuración" />
      <SectionCard
        title="Historial de configuración"
        description="Cambios realizados en los umbrales"
        icon={<IconChart className="h-5 w-5" />}
      >
        {history.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Aún no hay cambios registrados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="h-12 border-b border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-800/60">
                  <th className="px-4 py-3 text-left align-middle text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Fecha
                  </th>
                  <th className="px-4 py-3 text-left align-middle text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Usuario
                  </th>
                  <th className="px-4 py-3 text-left align-middle text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Valores anteriores
                  </th>
                  <th className="px-4 py-3 text-left align-middle text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Valores nuevos
                  </th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id} className="border-b border-slate-100 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/50">
                    <td className="px-4 py-3 align-middle text-slate-600 dark:text-slate-300">
                      {new Date(h.date).toLocaleString('es-PE')}
                    </td>
                    <td className="px-4 py-3 align-middle font-medium text-slate-800 dark:text-slate-100">{h.userName}</td>
                    <td className="px-4 py-3 align-middle text-slate-500 dark:text-slate-400">
                      Bajo ≤{h.previous.lowMax}%, Mod {h.previous.moderateMin}-{h.previous.moderateMax}%, Alto ≥{h.previous.highMin}%
                    </td>
                    <td className="px-4 py-3 align-middle text-slate-500 dark:text-slate-400">
                      Bajo ≤{h.next.lowMax}%, Mod {h.next.moderateMin}-{h.next.moderateMax}%, Alto ≥{h.next.highMin}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  )
}
