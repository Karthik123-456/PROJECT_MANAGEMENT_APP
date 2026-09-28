import { createContext } from 'react'
import type { LoginInput, RegisterInput, User } from '../api/types.ts'
import type { AuthStatus } from './AuthContext.tsx'

export interface AuthContextValue {
  status: AuthStatus
  user: User | null
  login: (input: LoginInput) => Promise<void>
  register: (input: RegisterInput) => Promise<void>
  logout: () => void
  retryAuthentication: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
