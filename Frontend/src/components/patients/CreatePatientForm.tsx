import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createPatient } from '@/api/patients'
import type { PatientFormData } from '@/types/patient'
import { isValidDni } from '@/utils/validation'

const schema = z.object({
  fullName: z.string().min(1, 'Nombre obligatorio'),
  age: z.coerce.number().min(1).max(120),
  gender: z.string().min(1, 'Seleccione género'),
  dni: z
    .string()
    .min(1, 'DNI obligatorio')
    .refine((v) => isValidDni(v), 'DNI debe tener 8 dígitos'),
  medicalHistory: z.string().optional(),
  medication: z.string().optional(),
  comorbidities: z.string().optional(),
  symptomsOnsetMonths: z.optional(z.coerce.number()),
})

type FormValues = z.output<typeof schema>

interface CreatePatientFormProps {
  onSuccess: () => void
  onCancel: () => void
}

export function CreatePatientForm({ onSuccess, onCancel }: CreatePatientFormProps) {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: (data: PatientFormData) => createPatient(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] })
      onSuccess()
    },
  })

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as import('react-hook-form').Resolver<FormValues>,
    defaultValues: {
      fullName: '',
      age: 30,
      gender: '',
      dni: '',
      medicalHistory: '',
      medication: '',
      comorbidities: '',
      symptomsOnsetMonths: undefined,
    },
  })

  const onSubmit = (data: FormValues) => {
    mutation.mutate(data as PatientFormData, {
      onError: (err: unknown) => {
        const ax = err as { response?: { data?: { message?: string } } }
        const msg = ax?.response?.data?.message ?? ''
        if (msg.toLowerCase().includes('dni') && msg.toLowerCase().includes('registrado')) {
          setError('dni', { message: 'DNI ya registrado' })
        } else {
          setError('root', { message: msg || 'Error al guardar' })
        }
      },
    })
  }

  return (
    <form onSubmit={handleSubmit((data: FormValues) => onSubmit(data))} className="p-4 sm:p-5">
      {mutation.isError && (
        <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/25 dark:text-red-300">
          {errors.root?.message ?? (mutation.error as Error).message}
        </div>
      )}
      <div className="space-y-4">
        <div className="form-field">
          <label className="form-label">Nombre completo *</label>
          <input
            className="input-base"
            placeholder="Ej. Juan Pérez"
            {...register('fullName')}
          />
          {errors.fullName && (
            <p className="form-error">{errors.fullName.message}</p>
          )}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="form-field">
            <label className="form-label">DNI (8 dígitos) *</label>
            <input
              className="input-base"
              maxLength={8}
              placeholder="12345678"
              {...register('dni')}
            />
            {errors.dni && (
              <p className="form-error">{errors.dni.message}</p>
            )}
          </div>
          <div className="form-field">
            <label className="form-label">Edad *</label>
            <input
              type="number"
              min={1}
              max={120}
              className="input-base"
              {...register('age')}
            />
            {errors.age && (
              <p className="form-error">{errors.age.message}</p>
            )}
          </div>
        </div>
        <div className="form-field">
          <label className="form-label">Género *</label>
          <select className="input-base" {...register('gender')}>
            <option value="">Seleccione</option>
            <option value="Masculino">Masculino</option>
            <option value="Femenino">Femenino</option>
            <option value="Otro">Otro</option>
          </select>
          {errors.gender && (
            <p className="form-error">{errors.gender.message}</p>
          )}
        </div>
        <div className="form-field">
          <label className="form-label">Historial clínico</label>
          <textarea
            rows={2}
            className="input-base"
            placeholder="Opcional"
            {...register('medicalHistory')}
          />
        </div>
        <div className="form-field">
          <label className="form-label">Medicación actual</label>
          <input
            className="input-base"
            placeholder="Opcional"
            {...register('medication')}
          />
        </div>
        <div className="form-field">
          <label className="form-label">Comorbilidades</label>
          <input
            className="input-base"
            placeholder="Opcional"
            {...register('comorbidities')}
          />
        </div>
        <div className="form-field">
          <label className="form-label">Tiempo desde inicio de síntomas (meses)</label>
          <input
            type="number"
            min={0}
            className="input-base"
            placeholder="Opcional"
            {...register('symptomsOnsetMonths')}
          />
        </div>
      </div>
      <div className="mt-6 flex flex-wrap gap-3 border-t border-slate-200 pt-5 dark:border-slate-600">
        <button
          type="submit"
          disabled={mutation.isPending}
          className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-colors hover:bg-sky-600 disabled:opacity-50 dark:bg-sky-600 dark:hover:bg-sky-500"
        >
          {mutation.isPending ? 'Guardando…' : 'Guardar paciente'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
