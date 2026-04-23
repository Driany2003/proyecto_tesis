import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from './AuthContext'
import { useTheme } from '@/contexts/ThemeContext'

const schema = z.object({
  email: z.string().email('Correo electrónico inválido'),
  password: z.string().min(1, 'Ingrese la contraseña'),
})

type FormData = z.infer<typeof schema>

const LOGIN_IMAGE_URL =
  'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=1200&q=80'

function IconMail({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  )
}

function IconLock({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  )
}

function IconSun({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  )
}

function IconMoon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
  )
}

function IconLoader({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  )
}

function IconEye({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  )
}

function IconEyeOff({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  )
}

export function LoginPage() {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const { login } = useAuth()
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/'

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = async (data: FormData) => {
    setError(null)
    setSuccess(null)
    try {
      await login(data.email, data.password)
      setSuccess('Login exitoso')
      setTimeout(() => navigate(from, { replace: true }), 600)
    } catch (e: unknown) {
      const err = e as { message?: string; response?: { data?: { error?: string; message?: string } } }
      setError(
        err.response?.data?.error ||
          err.response?.data?.message ||
          (err.message && err.message !== 'Network Error' ? err.message : null) ||
          'Credenciales incorrectas'
      )
    }
  }

  return (
    <div className="flex min-h-svh bg-slate-100 dark:bg-slate-950">
      <div className="relative hidden w-full overflow-hidden bg-slate-800 lg:flex lg:w-[42%]">
        <img
          src={LOGIN_IMAGE_URL}
          alt="Entorno clínico"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/50 to-transparent" />
        <div className="relative z-10 flex w-full flex-col justify-end px-10 pb-10 pt-10 xl:px-14 xl:pb-14 xl:pt-14">
          <div className="max-w-md">
            <h2 className="mb-4 text-3xl font-bold leading-tight xl:text-4xl">
              <span className="text-white">Apoyo al </span>
              <span className="text-sky-400">diagnóstico</span>
              <span className="text-white">, una sola </span>
              <span className="text-sky-400">plataforma</span>
            </h2>
            <p className="text-lg font-medium text-white xl:text-xl">
              Evaluación de riesgo · Parkinson · Análisis de voz y seguimiento.
            </p>
          </div>
        </div>
      </div>

      <div className="relative flex flex-1 flex-col items-center justify-center bg-white p-8 dark:bg-slate-900 sm:p-12 lg:p-16">
        <div className="absolute right-6 top-6 flex items-center gap-1 sm:right-8 sm:top-8">
          <button
            type="button"
            onClick={() => setTheme('light')}
            title="Modo claro"
            className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
              theme === 'light'
                ? 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-amber-300'
            }`}
          >
            <IconSun className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setTheme('dark')}
            title="Modo oscuro"
            className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
              theme === 'dark'
                ? 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-amber-300'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <IconMoon className="h-4 w-4" />
          </button>
        </div>

        <div className="w-full max-w-[420px] -translate-y-5">
          <div className="mb-6 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-500 text-2xl font-bold text-white shadow-lg dark:bg-sky-600">
              P
            </div>
          </div>
          <p className="mb-6 text-center text-lg font-semibold text-slate-800 dark:text-slate-100">
            Inicio de sesión
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {success && (
              <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-950/50 dark:text-green-300">
                {success}
              </div>
            )}
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="login-email" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Correo electrónico
              </label>
              <div className="relative">
                <IconMail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 shrink-0 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  placeholder="correo@ejemplo.com"
                  className="block h-11 w-full rounded-lg border border-slate-300 bg-white py-2 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
                  {...register('email')}
                />
              </div>
              {errors.email && (
                <p className="text-sm text-red-600 dark:text-red-400">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="login-password" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Contraseña
              </label>
              <div className="relative">
                <IconLock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 shrink-0 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="block h-11 w-full rounded-lg border border-slate-300 bg-white py-2 pl-10 pr-10 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600 focus:outline-none dark:text-slate-500 dark:hover:text-slate-300"
                >
                  {showPassword ? <IconEyeOff className="h-4 w-4" /> : <IconEye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-sm text-red-600 dark:text-red-400">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-sky-600 text-sm font-semibold text-white shadow-md transition-colors hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 disabled:opacity-50 dark:focus:ring-offset-slate-900"
            >
              {isSubmitting ? (
                <>
                  <IconLoader className="h-4 w-4 animate-spin" />
                  Entrando...
                </>
              ) : (
                'Ingresar'
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-slate-400 dark:text-slate-500">
            Sistema de apoyo al diagnóstico · Parkinson
          </p>
        </div>
      </div>
    </div>
  )
}
