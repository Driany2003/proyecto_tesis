import { useAuth } from '@/auth/AuthContext'
import { usePermissionWebSocket } from '@/hooks/usePermissionWebSocket'

export function PermissionGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const { needsReload, dismissReload } = usePermissionWebSocket(user?.role)

  if (!needsReload) return <>{children}</>

  return (
    <>
      <div className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm" />
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-8 shadow-2xl dark:border-amber-800 dark:bg-slate-900">
          <div className="flex flex-col items-center text-center">
            <h2 className="mb-2 text-xl font-bold text-slate-800 dark:text-slate-100">Permisos actualizados</h2>
            <p className="mb-6 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              Un administrador modificó los permisos de tu rol. Para aplicar los cambios, necesitas recargar la sesión.
            </p>
            <button
              onClick={() => {
                dismissReload()
                window.location.replace('/login')
              }}
              className="rounded-xl bg-sky-500 px-6 py-3 text-sm font-semibold text-white shadow-md transition-colors hover:bg-sky-600"
            >
              Cerrar sesión y actualizar
            </button>
            <p className="mt-3 text-xs text-slate-400">
              No podrás continuar usando el sistema hasta que actualices.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
