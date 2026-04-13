import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { emitApiError } from '../lib/apiEvents'
import type { AuthResponse } from '../types'

const configuredApiUrl = import.meta.env.VITE_API_URL?.trim()
const API_URL = import.meta.env.DEV ? '/api' : configuredApiUrl || 'http://localhost:8080/api'

type RetriableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean
  _retryCount?: number
}

let accessToken: string | null = null
let authUser: AuthResponse['user'] | null = null
let refreshPromise: Promise<AuthResponse> | null = null
let redirectScheduled = false

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
})

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function isAuthRoute(url?: string) {
  return Boolean(
    url &&
      ['/auth/login', '/auth/refresh', '/auth/logout', '/auth/forgot-password', '/auth/reset-password'].some((path) =>
        url.includes(path),
      ),
  )
}

function redirectToLogin() {
  if (redirectScheduled) {
    return
  }
  redirectScheduled = true
  clearAuth()
  window.location.href = '/login'
  window.setTimeout(() => {
    redirectScheduled = false
  }, 500)
}

function extractErrorMessage(error: AxiosError) {
  const responseMessage = (error.response?.data as { message?: string } | undefined)?.message
  if (responseMessage) {
    return responseMessage
  }
  if (!error.response) {
    return 'Falha de rede ao comunicar com o servidor.'
  }
  if (error.response.status >= 500) {
    return 'O servidor falhou ao processar a solicitacao. Tente novamente em instantes.'
  }
  return 'Nao foi possivel concluir a solicitacao.'
}

export function getAuthSnapshot() {
  return {
    accessToken,
    user: authUser,
  }
}

function persistAuth(auth: AuthResponse) {
  accessToken = auth.accessToken
  authUser = auth.user
}

function clearAuth() {
  accessToken = null
  authUser = null
}

async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = axios
      .post<AuthResponse>(`${API_URL}/auth/refresh`, undefined, { withCredentials: true })
      .then((response) => {
        persistAuth(response.data)
        return response.data
      })
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const axiosError = error as AxiosError
    const originalRequest = axiosError.config as RetriableRequestConfig | undefined

    if (!originalRequest) {
      return Promise.reject(error)
    }

    const status = axiosError.response?.status
    const isNetworkError = !axiosError.response
    const retryCount = originalRequest._retryCount ?? 0

    if ((isNetworkError || (status !== undefined && status >= 500)) && retryCount < 3 && !isAuthRoute(originalRequest.url)) {
      originalRequest._retryCount = retryCount + 1
      await wait(250 * 2 ** retryCount)
      return api(originalRequest)
    }

    if (status === 401 && !originalRequest._retry && !isAuthRoute(originalRequest.url)) {
      originalRequest._retry = true
      try {
        const auth = await refreshAccessToken()
        originalRequest.headers.Authorization = `Bearer ${auth.accessToken}`
        return api(originalRequest)
      } catch {
        redirectToLogin()
      }
    }

    if (isNetworkError || (status !== undefined && status >= 500)) {
      emitApiError(extractErrorMessage(axiosError))
    }

    return Promise.reject(error)
  },
)

export { clearAuth, persistAuth }
