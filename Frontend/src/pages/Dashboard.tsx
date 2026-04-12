import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { ROLES, roleLabel } from '@/constants/roles'
import { PageHeader, SectionCardSimple } from '@/layout/PageSection'
import { IconHome, IconUsers, IconMicrophone } from '@/components/icons/SidebarIcons'

export function Dashboard() {
  const { user, hasRole } = useAuth()

  return (
    <div>
      <PageHeader
        title="Inicio"
        subtitle={`Bienvenido, ${user?.name}. Conectado como ${roleLabel(user?.role ?? '')}.`}
      />

      {hasRole(ROLES.MEDICO, ROLES.ADMIN) && (
        <SectionCardSimple>
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-100">
              <IconHome className="h-6 w-6 text-sky-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Acciones rápidas</h2>
              <p className="text-sm text-slate-500">Acceso directo a las funciones principales</p>
            </div>
          </div>
          <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <li>
              <Link
                to="/patients"
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-sky-200 hover:bg-sky-50/50 hover:shadow"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-100">
                  <IconUsers className="h-5 w-5 text-sky-600" />
                </div>
                <div>
                  <span className="font-medium text-slate-800">Pacientes</span>
                  <p className="text-xs text-slate-500">Buscar o registrar pacientes</p>
                </div>
              </Link>
            </li>
            <li>
              <Link
                to="/recordings/new"
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-sky-200 hover:bg-sky-50/50 hover:shadow"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-100">
                  <IconMicrophone className="h-5 w-5 text-sky-600" />
                </div>
                <div>
                  <span className="font-medium text-slate-800">Nueva grabación</span>
                  <p className="text-xs text-slate-500">Conversación guiada con el paciente</p>
                </div>
              </Link>
            </li>
          </ul>
        </SectionCardSimple>
      )}
    </div>
  )
}
