import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { emitApiError } from '../lib/apiEvents'
import type { AuthResponse } from '../types'
import { resolveApiUrl } from './runtimeConfig'

const API_URL = resolveApiUrl()

type RetriableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean
  _retryCount?: number
}

let accessToken: string | null = null
let authUser: AuthResponse['user'] | null = null
let refreshPromise: Promise<AuthResponse> | null = null
let redirectScheduled = false
let proactiveRefreshTimer: number | null = null

// Janela minima (ms) antes do expiry para disparar refresh proativo.
const PROACTIVE_REFRESH_SAFETY_MS = 30_000
// Fracao do lifetime do token usada para agendar o refresh proativo.
const PROACTIVE_REFRESH_FRACTION = 0.8

function decodeJwtExpMs(token: string): number | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
    if (typeof payload.exp === 'number') {
      return payload.exp * 1000
    }
  } catch {
    // token invalido ou nao-JWT: apenas nao agenda refresh proativo
  }
  return null
}

function clearProactiveRefreshTimer() {
  if (proactiveRefreshTimer !== null) {
    window.clearTimeout(proactiveRefreshTimer)
    proactiveRefreshTimer = null
  }
}

function scheduleProactiveRefresh(token: string) {
  clearProactiveRefreshTimer()
  const expMs = decodeJwtExpMs(token)
  if (!expMs) return
  const now = Date.now()
  const lifetime = expMs - now
  if (lifetime <= PROACTIVE_REFRESH_SAFETY_MS) return
  const delay = Math.max(
    PROACTIVE_REFRESH_SAFETY_MS,
    Math.floor(lifetime * PROACTIVE_REFRESH_FRACTION),
  )
  proactiveRefreshTimer = window.setTimeout(() => {
    // Se ainda ha sessao ativa, renova em background. Falhas sao silenciadas aqui;
    // qualquer chamada futura caira no fluxo reativo de 401 -> refresh -> login.
    if (accessToken) {
      refreshAccessToken().catch(() => {})
    }
  }, delay)
}

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
  scheduleProactiveRefresh(auth.accessToken)
}

function clearAuth() {
  accessToken = null
  authUser = null
  clearProactiveRefreshTimer()
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

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  // Se ha um refresh em andamento (reativo ou proativo) e esta request nao e
  // de auth, aguarda o refresh terminar para usar o token novo. Isso evita
  // enviar requests com token expirado durante a janela do refresh.
  if (refreshPromise && !isAuthRoute(config.url)) {
    try {
      await refreshPromise
    } catch {
      // se o refresh falhar o fluxo reativo lida com logout; seguimos com o token atual
    }
  }
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

    // Re-tentativa automatica so e segura para metodos idempotentes. Metodos
    // mutantes (post/put/patch/delete) NAO podem ser reenviados aqui, pois um
    // 5xx/erro de rede pode ter ocorrido APOS a gravacao no servidor — reenviar
    // duplicaria medicoes, lotes e assinaturas.
    const method = (originalRequest.method ?? 'get').toLowerCase()
    const isIdempotent = ['get', 'head', 'options'].includes(method)

    if (
      isIdempotent &&
      (isNetworkError || (status !== undefined && status >= 500)) &&
      retryCount < 3 &&
      !isAuthRoute(originalRequest.url)
    ) {
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

    // Rate-limit da IA (10 analises/min por usuario). O backend responde 429 com
    // header Retry-After (segundos). NAO re-tentamos automaticamente (429 nao e
    // >= 500); apenas avisamos o usuario quanto tempo aguardar.
    if (status === 429) {
      const retryAfterRaw = axiosError.response?.headers?.['retry-after']
      const retryAfter = Number(retryAfterRaw)
      const quando =
        Number.isFinite(retryAfter) && retryAfter > 0
          ? `Aguarde ${retryAfter} segundo${retryAfter === 1 ? '' : 's'} e tente novamente.`
          : 'Aguarde alguns instantes e tente novamente.'
      emitApiError(`Muitas analises em sequencia. ${quando}`)
      return Promise.reject(error)
    }

    if (isNetworkError || (status !== undefined && status >= 500)) {
      emitApiError(extractErrorMessage(axiosError))
    }

    return Promise.reject(error)
  },
)

export { clearAuth, persistAuth }
