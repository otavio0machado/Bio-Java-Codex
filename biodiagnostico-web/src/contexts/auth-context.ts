import { createContext } from 'react'
import type { User } from '../types'

export interface AuthContextValue {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshToken: () => Promise<void>
  restoreSession: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
