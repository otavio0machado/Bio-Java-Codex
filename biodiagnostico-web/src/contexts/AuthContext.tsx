import {
  startTransition,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { clearAuth } from '../services/api'
import { authService } from '../services/authService'
import type { LoginRequest, User } from '../types'
import { AuthContext, type AuthContextValue } from './auth-context'

interface InitialAuthState {
  user: User | null
  refreshToken: string | null
  needsRefresh: boolean
}

function parseStoredUser(storedUser: string | null) {
  if (!storedUser) {
    return null
  }

  try {
    return JSON.parse(storedUser) as User
  } catch {
    clearAuth()
    return null
  }
}

function getInitialAuthState(): InitialAuthState {
  const accessToken = sessionStorage.getItem('accessToken')
  const user = parseStoredUser(sessionStorage.getItem('authUser'))

  if (accessToken && user) {
    return {
      user,
      refreshToken: null,
      needsRefresh: false,
    }
  }

  const refreshToken = sessionStorage.getItem('refreshToken')
  return {
    user: null,
    refreshToken,
    needsRefresh: Boolean(refreshToken),
  }
}

export function AuthProvider({ children }: PropsWithChildren) {
  const navigate = useNavigate()
  const initialAuthState = useRef(getInitialAuthState()).current
  const [user, setUser] = useState<User | null>(initialAuthState.user)
  const [isLoading, setIsLoading] = useState(initialAuthState.needsRefresh)

  const restoreSession = async () => {
    const accessToken = sessionStorage.getItem('accessToken')
    const storedUser = parseStoredUser(sessionStorage.getItem('authUser'))

    if (accessToken && storedUser) {
      startTransition(() => {
        setUser(storedUser)
        setIsLoading(false)
      })
      return
    }

    const storedRefreshToken = sessionStorage.getItem('refreshToken')
    if (!storedRefreshToken) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)

    try {
      const auth = await authService.refreshToken({ refreshToken: storedRefreshToken })
      startTransition(() => {
        setUser(auth.user)
      })
    } catch {
      clearAuth()
      startTransition(() => {
        setUser(null)
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!initialAuthState.refreshToken || initialAuthState.user) {
      return
    }

    let isCancelled = false

    authService
      .refreshToken({ refreshToken: initialAuthState.refreshToken })
      .then((auth) => {
        if (isCancelled) {
          return
        }

        startTransition(() => {
          setUser(auth.user)
        })
      })
      .catch(() => {
        clearAuth()
        if (isCancelled) {
          return
        }

        startTransition(() => {
          setUser(null)
        })
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoading(false)
        }
      })

    return () => {
      isCancelled = true
    }
  }, [initialAuthState.refreshToken, initialAuthState.user])

  const login = async (email: string, password: string) => {
    setIsLoading(true)

    try {
      const auth = await authService.login({ email, password } satisfies LoginRequest)
      startTransition(() => {
        setUser(auth.user)
      })
      navigate('/dashboard')
    } finally {
      setIsLoading(false)
    }
  }

  const logout = () => {
    clearAuth()
    startTransition(() => {
      setUser(null)
    })
    navigate('/login')
  }

  const refreshToken = async () => {
    const token = sessionStorage.getItem('refreshToken')
    if (!token) {
      logout()
      return
    }

    const auth = await authService.refreshToken({ refreshToken: token })
    startTransition(() => {
      setUser(auth.user)
    })
  }

  const value: AuthContextValue = {
    user,
    isAuthenticated: Boolean(user),
    isLoading,
    login,
    logout,
    refreshToken,
    restoreSession,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
