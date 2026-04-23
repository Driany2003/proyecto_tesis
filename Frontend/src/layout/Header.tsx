import { Link, useLocation, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/auth/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { IconBell } from '@/components/icons/SidebarIcons'
import { getPatient } from '@/api/patients'

const breadcrumbLabels: Record<string, string> = {
  '': 'Inicio',
  patients: 'Pacientes',
  users: 'Usuarios',
  recordings: 'Grabaciones',
  new: 'Nueva grabación',
  settings: 'Configuración',
  thresholds: 'Umbrales de riesgo',
  backups: 'Respaldo',
  audit: 'Logs de auditoría',
  record: 'Grabar voz',
}

const UUID_RE = /^[a-f0-9-]{36}$/i

function Breadcrumbs() {
  const location = useLocation()
  const params = useParams()
  const parts = location.pathname.split('/').filter(Boolean)

  const patientIdFromRoute = params.id
  const { data: patientForCrumb } = useQuery({
    queryKey: ['patient', patientIdFromRoute],
    queryFn: () => getPatient(patientIdFromRoute!),
    enabled: !!patientIdFromRoute && UUID_RE.test(patientIdFromRoute),
  })

  if (parts.length === 0) {
    return (
      <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
        Inicio
      </span>
    )
  }

  const getLabel = (part: string, index: number): string => {
    if (parts[index - 1] === 'patients' && part !== 'patients' && !UUID_RE.test(part)) {
      return breadcrumbLabels[part] ?? part
    }
    if (parts[index - 1] === 'patients' && UUID_RE.test(part)) {
      const name = patientForCrumb?.fullName?.trim()
      return name || '…'
    }
    return breadcrumbLabels[part] ?? part
  }

  return (
    <nav className="flex items-center gap-1 text-sm">
      <Link
        to="/"
        className="text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
      >
        Inicio
      </Link>
      {parts.map((part, i) => (
        <span key={`${part}-${i}`} className="flex items-center gap-1">
          <svg
            className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          {i === parts.length - 1 ? (
            <span
              className="max-w-[min(100%,14rem)] truncate font-medium text-slate-900 dark:text-slate-100"
              title={getLabel(part, i)}
            >
              {getLabel(part, i)}
            </span>
          ) : (
            <Link
              to={`/${parts.slice(0, i + 1).join('/')}`}
              className="max-w-[min(100%,14rem)] truncate text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              title={getLabel(part, i)}
            >
              {getLabel(part, i)}
            </Link>
          )}
        </span>
      ))}
    </nav>
  )
}

export function Header({ onMenuClick }: { onMenuClick?: () => void }) {
  const { logout } = useAuth()
  const { theme, setTheme } = useTheme()

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-card px-4 dark:border-slate-700">
      <button
        type="button"
        onClick={onMenuClick}
        className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-accent hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 md:hidden"
        aria-label="Abrir menú"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <Breadcrumbs />

      <div className="flex-1" />

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setTheme('light')}
          title="Modo claro"
          aria-label="Modo claro"
          className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
            theme === 'light'
              ? 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200'
              : 'text-slate-500 hover:bg-accent hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-amber-300'
          }`}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => setTheme('dark')}
          title="Modo oscuro"
          aria-label="Modo oscuro"
          className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
            theme === 'dark'
              ? 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-amber-300'
              : 'text-slate-500 hover:bg-accent hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
        </button>
      </div>

      <button
        type="button"
        className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-accent hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        aria-label="Notificaciones"
      >
        <IconBell className="h-5 w-5" />
      </button>

      <button
        type="button"
        onClick={() => logout()}
        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
      >
        Salir
      </button>
    </header>
  )
}
