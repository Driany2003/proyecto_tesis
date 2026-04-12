import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  action?: ReactNode
}

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <div
      className="section-enter flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      style={{ marginBottom: 'var(--section-gap)' }}
    >
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="flex items-center gap-2 flex-shrink-0">{action}</div>}
    </div>
  )
}

interface SectionDividerProps {
  label: string
}

export function SectionDivider({ label }: SectionDividerProps) {
  return (
    <div className="section-enter section-enter-delay-1 pt-4" style={{ marginTop: 'var(--section-gap)' }}>
      <p className="px-3 mb-2 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
        —— {label}
      </p>
    </div>
  )
}

interface SectionCardProps {
  title?: string
  description?: string
  icon?: ReactNode
  children: ReactNode
  className?: string
}

export function SectionCard({ title, description, icon, children, className = '' }: SectionCardProps) {
  return (
    <div
      className={`section-enter section-enter-delay-2 rounded-xl border border-slate-200 bg-white shadow-card dark:border-slate-600 dark:bg-slate-800 overflow-hidden ${className}`}
    >
      {(title || description || icon) && (
        <div className="flex flex-col space-y-1.5 border-b border-slate-200 dark:border-slate-600 px-5 pt-5 pb-4">
          <div className="flex items-center gap-3">
            {icon && (
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-600 dark:bg-sky-900/60 dark:text-sky-300">
                {icon}
              </div>
            )}
            <div className="min-w-0">
              {title && <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h2>}
              {description && <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">{description}</p>}
            </div>
          </div>
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  )
}

export function SectionCardSimple({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`section-enter section-enter-delay-2 rounded-xl border border-slate-200 bg-white p-5 shadow-card dark:border-slate-600 dark:bg-slate-800 ${className}`}
    >
      {children}
    </div>
  )
}
