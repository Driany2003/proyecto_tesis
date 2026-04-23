import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getPatient } from '@/api/patients'
import { RecordingSessionsPanel } from '@/components/patients/RecordingSessionsPanel'
import { PageHeader, SectionCard } from '@/layout/PageSection'
import { IconUsers, IconMicrophone, IconClipboard, IconChart } from '@/components/icons/SidebarIcons'

export function PatientDetailPage() {
  const { id } = useParams<{ id: string }>()

  const { data: patient, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['patient', id],
    queryFn: () => getPatient(id!),
    enabled: !!id,
  })

  if (isError) {
    const message = error instanceof Error ? error.message : 'No se pudo cargar el paciente.'
    return (
      <SectionCard>
        <div className="space-y-4 py-6 text-center">
          <p className="text-sm font-medium text-red-600 dark:text-red-400">{message}</p>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            {isFetching ? 'Reintentando…' : 'Reintentar'}
          </button>
        </div>
      </SectionCard>
    )
  }

  if (isLoading || !patient) {
    return (
      <SectionCard>
        <p className="py-8 text-center text-slate-500">Cargando…</p>
      </SectionCard>
    )
  }

  const hasClinical =
    !!(patient.medicalHistory?.trim() || patient.medication?.trim() || patient.comorbidities?.trim())

  return (
    <div>
      <PageHeader
        title={patient.fullName}
        subtitle={`DNI ${patient.dni} · ${patient.age} años`}
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              to={`/patients/${patient.id}/record`}
              className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-sky-600 dark:bg-sky-600 dark:hover:bg-sky-500"
            >
              <IconMicrophone className="h-4 w-4" />
              Nueva grabación
            </Link>
            <Link
              to="/patients"
              className="inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Volver
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard
          title="Datos personales"
          description="Identificación del paciente"
          icon={<IconUsers className="h-5 w-5" />}
        >
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-slate-500">DNI</dt>
              <dd className="font-medium text-slate-800 dark:text-slate-100">{patient.dni}</dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500">Edad</dt>
              <dd className="font-medium text-slate-800 dark:text-slate-100">{patient.age}</dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500">Género</dt>
              <dd className="font-medium text-slate-800 dark:text-slate-100">{patient.gender}</dd>
            </div>
          </dl>
        </SectionCard>

        <SectionCard
          title="Información clínica"
          description="Historial y contexto médico"
          icon={<IconClipboard className="h-5 w-5" />}
        >
          {hasClinical ? (
            <div className="space-y-4">
              {patient.medicalHistory?.trim() && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Historial clínico</h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{patient.medicalHistory}</p>
                </div>
              )}
              {patient.medication?.trim() && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Medicación</h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{patient.medication}</p>
                </div>
              )}
              {patient.comorbidities?.trim() && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Comorbilidades</h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{patient.comorbidities}</p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No hay información clínica adicional registrada para este paciente.
            </p>
          )}
        </SectionCard>
      </div>

      <div id="analisis" className="mt-8 scroll-mt-24">
        <SectionCard
          title="Sesiones de análisis"
          description="Elija una sesión en la lista para ver probabilidad, banda de riesgo y gráficos con más detalle."
          icon={<IconChart className="h-5 w-5" />}
        >
          <RecordingSessionsPanel patientId={patient.id} />
        </SectionCard>
      </div>
    </div>
  )
}
