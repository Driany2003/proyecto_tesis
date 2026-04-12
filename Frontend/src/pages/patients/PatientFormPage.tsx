import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createPatient } from '@/api/patients'
import type { PatientFormData } from '@/types/patient'
import { isValidDni } from '@/utils/validation'
import { PageHeader } from '@/layout/PageSection'
import { IconUsers } from '@/components/icons/SidebarIcons'

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

export function PatientFormPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: (data: PatientFormData) => createPatient(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] })
      navigate('/patients')
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
    <div>
      <PageHeader
        title="Nuevo paciente"
        subtitle="Registre los datos del paciente para el seguimiento y análisis de voz."
      />
      <form
        onSubmit={handleSubmit((data: FormValues) => onSubmit(data))}
        className="bg-card max-w-2xl overflow-hidden rounded-xl border border-slate-200 shadow-card dark:border-slate-600"
      >
        <div className="border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-600 dark:bg-slate-800/50 sm:px-5 sm:py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-sky-100 dark:bg-sky-900/40">
              <IconUsers className="h-5 w-5 text-sky-600 dark:text-sky-300" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Datos del paciente</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">Complete los campos obligatorios marcados con *</p>
            </div>
          </div>
        </div>
        <div className="space-y-5 p-4 sm:p-5">
        {mutation.isError && (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/25 dark:text-red-300">
            {errors.root?.message ?? (mutation.error as Error).message}
          </div>
        )}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Nombre completo *
            </label>
            <input
              className="input-base"
              {...register('fullName')}
            />
            {errors.fullName && (
              <p className="mt-1.5 text-sm text-red-600">{errors.fullName.message}</p>
            )}
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">DNI (8 dígitos) *</label>
            <input
              className="input-base"
              maxLength={8}
              {...register('dni')}
            />
            {errors.dni && (
              <p className="mt-1.5 text-sm text-red-600">{errors.dni.message}</p>
            )}
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Edad *</label>
            <input
              type="number"
              min={1}
              max={120}
              className="input-base"
              {...register('age')}
            />
            {errors.age && (
              <p className="mt-1.5 text-sm text-red-600">{errors.age.message}</p>
            )}
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Género *</label>
            <select
              className="input-base"
              {...register('gender')}
            >
              <option value="">Seleccione</option>
              <option value="Masculino">Masculino</option>
              <option value="Femenino">Femenino</option>
              <option value="Otro">Otro</option>
            </select>
            {errors.gender && (
              <p className="mt-1.5 text-sm text-red-600">{errors.gender.message}</p>
            )}
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Historial clínico relevante
          </label>
          <textarea
            rows={2}
            className="input-base"
            {...register('medicalHistory')}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Medicación actual</label>
          <input
            className="input-base"
            {...register('medication')}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Comorbilidades</label>
          <input
            className="input-base"
            {...register('comorbidities')}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Tiempo desde inicio de síntomas (meses)
          </label>
          <input
            type="number"
            min={0}
            className="input-base"
            {...register('symptomsOnsetMonths')}
          />
        </div>
        <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-6 dark:border-slate-600">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-sky-600 disabled:opacity-50 dark:bg-sky-600 dark:hover:bg-sky-500"
          >
            {mutation.isPending ? 'Guardando…' : 'Guardar paciente'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/patients')}
            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Cancelar
          </button>
        </div>
        </div>
      </form>
    </div>
  )
}
