import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getPatient } from '@/api/patients'
import { PageHeader, SectionCard } from '@/layout/PageSection'
import { IconUsers, IconMicrophone } from '@/components/icons/SidebarIcons'

export function PatientDetailPage() {
  const { id } = useParams<{ id: string }>()

  const { data: patient, isLoading } = useQuery({
    queryKey: ['patient', id],
    queryFn: () => getPatient(id!),
    enabled: !!id,
  })

  if (isLoading || !patient) {
    return (
      <SectionCard>
        <p className="py-8 text-center text-slate-500">Cargando…</p>
      </SectionCard>
    )
  }

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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SectionCard
            title="Datos personales"
            description="Información básica del paciente"
            icon={<IconUsers className="h-5 w-5" />}
          >
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-slate-500">DNI</dt>
                <dd className="font-medium text-slate-800">{patient.dni}</dd>
              </div>
              <div>
                <dt className="text-sm text-slate-500">Edad</dt>
                <dd className="font-medium text-slate-800">{patient.age}</dd>
              </div>
              <div>
                <dt className="text-sm text-slate-500">Género</dt>
                <dd className="font-medium text-slate-800">{patient.gender}</dd>
              </div>
            </dl>
            {patient.medicalHistory && (
              <>
                <h3 className="mt-6 border-t border-slate-200 pt-4 text-sm font-semibold text-slate-900 dark:border-slate-600 dark:text-slate-100">
                  Historial clínico
                </h3>
                <p className="mt-2 text-sm text-slate-600">{patient.medicalHistory}</p>
              </>
            )}
            {patient.medication && (
              <>
                <h3 className="mt-4 text-sm font-semibold text-slate-900 dark:text-slate-100">Medicación</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{patient.medication}</p>
              </>
            )}
            {patient.comorbidities && (
              <>
                <h3 className="mt-4 text-sm font-semibold text-slate-900 dark:text-slate-100">Comorbilidades</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{patient.comorbidities}</p>
              </>
            )}
          </SectionCard>
        </div>
        <div>
          <SectionCard
            title="Sesiones de análisis"
            description="Historial de grabaciones"
          >
            <p className="text-sm text-slate-600 dark:text-slate-400">
              El historial de sesiones y gráficos de evolución se mostrarán aquí cuando existan
              grabaciones asociadas al paciente.
            </p>
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
