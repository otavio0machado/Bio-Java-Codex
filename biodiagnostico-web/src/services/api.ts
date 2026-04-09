import axios, { type InternalAxiosRequestConfig } from 'axios'
import type { AuthResponse } from '../types'

const configuredApiUrl = import.meta.env.VITE_API_URL?.trim()
const API_URL = import.meta.env.DEV ? '/api' : configuredApiUrl || 'http://localhost:8080/api'

let refreshPromise: Promise<AuthResponse> | null = null

export const api = axios.create({
  baseURL: API_URL,
})

function getStoredTokens() {
  return {
    accessToken: sessionStorage.getItem('accessToken'),
    refreshToken: sessionStorage.getItem('refreshToken'),
  }
}

function persistAuth(auth: AuthResponse) {
  sessionStorage.setItem('accessToken', auth.accessToken)
  sessionStorage.setItem('refreshToken', auth.refreshToken)
  sessionStorage.setItem('authUser', JSON.stringify(auth.user))
}

function clearAuth() {
  sessionStorage.removeItem('accessToken')
  sessionStorage.removeItem('refreshToken')
  sessionStorage.removeItem('authUser')
}

async function refreshAccessToken() {
  if (!refreshPromise) {
    const { refreshToken } = getStoredTokens()
    refreshPromise = axios
      .post<AuthResponse>(`${API_URL}/auth/refresh`, { refreshToken })
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
  const { accessToken } = getStoredTokens()
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }
    if (error.response?.status === 401 && !originalRequest?._retry) {
      originalRequest._retry = true
      try {
        const auth = await refreshAccessToken()
        originalRequest.headers.Authorization = `Bearer ${auth.accessToken}`
        return api(originalRequest)
      } catch {
        clearAuth()
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  },
)

export { clearAuth, persistAuth }
