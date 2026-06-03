import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api'

export const apiClient = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
})

apiClient.interceptors.request.use((config) => {
  if (!(config.data instanceof FormData)) {
    config.headers['Content-Type'] = 'application/json'
  }
  return config
})

let redirecting = false

function handleSessionEnd(reason: string) {
  if (redirecting) return
  redirecting = true
  localStorage.clear()
  sessionStorage.setItem('logout_reason', reason)
  window.location.replace('/login?expired=true')
}

apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status
    const url = err.config?.url || ''

    if (status === 401) {
      if (url.includes('/auth/me') || url.includes('/auth/login')) {
        handleSessionEnd('Tu sesión expiró por inactividad. Ingresa nuevamente.')
      } else {
        handleSessionEnd('Tu sesión expiró o fue cerrada. Ingresa nuevamente para continuar.')
      }
      return Promise.reject(err)
    }

    if (status === 403) {
      const backendMsg = err.response?.data?.error || ''
      if (backendMsg) {
        handleSessionEnd(backendMsg)
      } else {
        handleSessionEnd('No tienes permisos para realizar esta acción. Consulta con un administrador.')
      }
      return Promise.reject(err)
    }

    const backendMsg = err.response?.data?.error || err.response?.data?.message
    if (backendMsg) {
      const enriched = new Error(backendMsg)
      enriched.name = 'BackendError'
      return Promise.reject(enriched)
    }

    return Promise.reject(err)
  }
)
