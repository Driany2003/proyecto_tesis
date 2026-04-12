import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getPatients } from '@/api/patients'
import { PageHeader, SectionCard, SectionCardSimple, SectionDivider } from '@/layout/PageSection'
import { IconUserPlus, IconUsers } from '@/components/icons/SidebarIcons'
import { Modal } from '@/components/ui/Modal'
import { CreatePatientForm } from '@/components/patients/CreatePatientForm'

export function PatientListPage() {
  const [search, setSearch] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['patients', search],
    queryFn: () => getPatients({ search: search || undefined }),
  })
  const patients = Array.isArray(data) ? data : []

  return (
    <div>
      <PageHeader
        title="Pacientes"
        subtitle={patients.length ? `${patients.length} paciente${patients.length !== 1 ? 's' : ''} registrado${patients.length !== 1 ? 's' : ''}` : 'Buscar o registrar pacientes'}
        action={
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/25 transition-all hover:bg-sky-600"
          >
            <IconUserPlus className="h-5 w-5" />
            Nuevo paciente
          </button>
        }
      />

      <SectionDivider label="Filtros" />
      <SectionCard
        title="Buscar pacientes"
        description="Refine por nombre, DNI o ID para encontrar al paciente"
        icon={<IconUsers className="h-5 w-5" />}
        className="mb-6"
      >
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-0 flex-1 sm:max-w-md">
            <label className="form-label mb-1.5 block">Búsqueda</label>
            <input
              type="search"
              placeholder="Nombre, DNI o ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-base"
            />
          </div>
        </div>
      </SectionCard>

      <SectionDivider label="Lista de pacientes" />
      {isLoading ? (
        <SectionCardSimple>
          <p className="py-8 text-center text-slate-500 dark:text-slate-400">Cargando…</p>
        </SectionCardSimple>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card dark:border-slate-600 dark:bg-slate-800 sm:block">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="h-12 border-b border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-800/60">
                    <th className="px-4 py-3 text-left align-middle text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                      Nombre
                    </th>
                    <th className="px-4 py-3 text-left align-middle text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                      DNI
                    </th>
                    <th className="px-4 py-3 text-left align-middle text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                      Edad
                    </th>
                    <th className="px-4 py-3 text-left align-middle text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                      Género
                    </th>
                    <th className="px-4 py-3 text-right align-middle text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {patients.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center text-slate-500 dark:text-slate-400">
                        Todavía no hay registros.
                      </td>
                    </tr>
                  ) : (
                  patients.map((p) => (
                    <tr key={p.id} className="border-b border-slate-100 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/50">
                      <td className="px-4 py-3.5 align-middle">
                        <Link
                          to={`/patients/${p.id}`}
                          className="font-medium text-sky-600 transition-colors hover:text-sky-700 hover:underline dark:text-sky-400 dark:hover:text-sky-300"
                        >
                          {p.fullName}
                        </Link>
                      </td>
                      <td className="px-4 py-3.5 align-middle text-slate-600 dark:text-slate-300">{p.dni}</td>
                      <td className="px-4 py-3.5 align-middle text-slate-600 dark:text-slate-300">{p.age}</td>
                      <td className="px-4 py-3.5 align-middle text-slate-600 dark:text-slate-300">{p.gender}</td>
                      <td className="px-4 py-3.5 text-right align-middle">
                        <Link
                          to={`/patients/${p.id}/record`}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-sky-50 px-3 py-1.5 text-sm font-medium text-sky-600 transition-colors hover:bg-sky-100 dark:bg-sky-900/40 dark:text-sky-300 dark:hover:bg-sky-900/60"
                        >
                          Grabar voz
                        </Link>
                      </td>
                    </tr>
                  ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:hidden">
            {patients.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-card dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400">
                Todavía no hay registros.
              </div>
            ) : (
            patients.map((p) => (
              <Link
                key={p.id}
                to={`/patients/${p.id}`}
                className="block rounded-xl border border-slate-200 bg-white p-4 shadow-card transition-shadow active:scale-[0.99] dark:border-slate-600 dark:bg-slate-800"
              >
                <div className="font-medium text-slate-800 dark:text-slate-100">{p.fullName}</div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
                  <span>DNI {p.dni}</span>
                  <span>{p.age} años</span>
                  <span>{p.gender}</span>
                </div>
                <div className="mt-3 flex justify-end">
                  <span className="rounded-lg bg-sky-50 px-3 py-1.5 text-sm font-medium text-sky-600 dark:bg-sky-900/40 dark:text-sky-300">
                    Grabar voz
                  </span>
                </div>
              </Link>
            ))
            )}
          </div>
        </>
      )}

      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Nuevo paciente"
        subtitle="Registre los datos para el seguimiento y análisis de voz."
        maxWidth="max-w-2xl"
      >
        <CreatePatientForm
          onSuccess={() => setShowCreateModal(false)}
          onCancel={() => setShowCreateModal(false)}
        />
      </Modal>
    </div>
  )
}
