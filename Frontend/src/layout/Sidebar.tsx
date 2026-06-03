import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { ROLES } from '@/constants/roles'
import {
  IconHome,
  IconUsers,
  IconMicrophone,
  IconUserPlus,
  IconChart,
  IconDatabase,
  IconClipboard,
} from '@/components/icons/SidebarIcons'

function IconCollection({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  )
}

function IconPermission({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  )
}

type NavItem = { label: string; path: string; icon: React.ComponentType<{ className?: string }> }

function getNavSections(hasAdmin: boolean, hasMedico: boolean, hasAuditor: boolean): { title: string; items: NavItem[] }[] {
  const principal: NavItem[] = []
  if (hasAdmin || hasMedico) principal.push({ label: 'Inicio', path: '/', icon: IconHome })
  if (hasMedico || hasAdmin) {
    principal.push({ label: 'Pacientes', path: '/patients', icon: IconUsers })
    principal.push({ label: 'Nueva grabación', path: '/recordings/new', icon: IconMicrophone })
    principal.push({ label: 'Recolección', path: '/recoleccion', icon: IconCollection })
  }
  const admin: NavItem[] = hasAdmin
    ? [
        { label: 'Usuarios', path: '/users', icon: IconUserPlus },
        { label: 'Permisos', path: '/permisos', icon: IconPermission },
      ]
    : []
  const config: NavItem[] = hasAdmin
    ? [
        { label: 'Umbrales de riesgo', path: '/settings/thresholds', icon: IconChart },
        { label: 'Respaldo', path: '/backups', icon: IconDatabase },
      ]
    : []
  const audit: NavItem[] = hasAdmin || hasAuditor
    ? [{ label: 'Logs de auditoría', path: '/audit', icon: IconClipboard }]
    : []

  const sections: { title: string; items: NavItem[] }[] = []
  if (principal.length) sections.push({ title: 'Principal', items: principal })
  if (admin.length) sections.push({ title: 'Administración', items: admin })
  if (config.length) sections.push({ title: 'Configuración', items: config })
  if (audit.length) sections.push({ title: 'Auditoría', items: audit })
  return sections
}

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const { user, hasRole } = useAuth()
  const location = useLocation()
  const sections = getNavSections(
    hasRole(ROLES.ADMIN),
    hasRole(ROLES.MEDICO),
    hasRole(ROLES.AUDITOR)
  )

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-500 text-white">
          <span className="text-lg font-bold">P</span>
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">Parkinson</p>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">Apoyo al diagnóstico</p>
        </div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-2 py-4">
        {sections.map((section) => {
          const sectionActive = section.items.some(item =>
            item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path)
          )
          return (
          <div key={section.title}>
            <p className={`mb-2 px-3 text-xs font-semibold uppercase tracking-wider transition-colors ${
              sectionActive
                ? 'text-sky-600 dark:text-sky-400'
                : 'text-slate-500 dark:text-slate-400'
            }`}>
              {section.title}
            </p>
            <div className="space-y-1">
              {section.items.map((item) => {
                const isActive =
                  item.path === '/'
                    ? location.pathname === '/'
                    : location.pathname.startsWith(item.path)
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={onClose}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-sky-500 text-white'
                        : 'text-slate-600 hover:bg-accent hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700/80 dark:hover:text-slate-100'
                    }`}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </NavLink>
                )
              })}
            </div>
          </div>
          )
        })}
      </nav>

      <div className="shrink-0 border-t border-slate-200 p-4 dark:border-slate-700">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-500 text-xs font-semibold text-white">
            {user?.name?.slice(0, 2).toUpperCase() ?? '?'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
              {user?.name ?? 'Usuario'}
            </p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">{user?.email ?? ''}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export function Sidebar({
  variant,
  isOpen,
  onClose,
}: {
  variant: 'desktop' | 'mobile'
  isOpen?: boolean
  onClose?: () => void
}) {
  if (variant === 'desktop') {
    return (
      <aside className="hidden h-full w-64 shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-card dark:border-slate-700 md:flex">
        <SidebarContent />
      </aside>
    )
  }

  return (
    <aside
      className={`fixed left-0 top-0 z-50 flex h-full w-64 max-w-[85vw] flex-col overflow-hidden border-r border-slate-200 bg-card shadow-xl transition-transform duration-300 ease-out dark:border-slate-700 md:hidden ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 px-4 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500 text-white">
            <span className="text-sm font-bold">P</span>
          </div>
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Parkinson</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-accent hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
          aria-label="Cerrar menú"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="flex flex-1 flex-col overflow-hidden">
        <SidebarContent onClose={onClose} />
      </div>
    </aside>
  )
}
