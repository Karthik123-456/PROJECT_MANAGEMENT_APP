import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate } from 'react-router'
import {
  ApiError,
  apiRequest,
  clearAuthToken,
  getAuthToken,
  registerUnauthorizedHandler,
  setAuthToken,
} from '../api/client.ts'
import type {
  AuthResponse,
  LoginInput,
  RegisterInput,
  User,
} from '../api/types.ts'
import { AuthContext, type AuthContextValue } from './context.ts'

export type AuthStatus =
  | 'loading'
  | 'authenticated'
  | 'anonymous'
  | 'unavailable'

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [user, setUser] = useState<User | null>(null)
  const unauthorizedHandled = useRef(false)
  const validationAttempt = useRef(0)
  const routerState = useRef({ navigate, location })

  useEffect(() => {
    routerState.current = { navigate, location }
  }, [location, navigate])

  const validateSession = useCallback(async () => {
    const attempt = ++validationAttempt.current
    await Promise.resolve()

    if (!getAuthToken()) {
      setUser(null)
      setStatus('anonymous')
      return
    }

    try {
      const result = await apiRequest<{ user: User }>('/auth/me')
      if (attempt === validationAttempt.current) {
        unauthorizedHandled.current = false
        setUser(result.user)
        setStatus('authenticated')
      }
    } catch (error) {
      if (attempt !== validationAttempt.current) {
        return
      }

      if (error instanceof ApiError && error.status === 401) {
        clearAuthToken()
        queryClient.clear()
        setUser(null)
        setStatus('anonymous')
        return
      }

      setUser(null)
      setStatus('unavailable')
    }
  }, [queryClient])

  const handleUnauthorized = useCallback(() => {
    if (unauthorizedHandled.current) {
      return
    }

    unauthorizedHandled.current = true
    clearAuthToken()
    queryClient.clear()
    setUser(null)
    setStatus('anonymous')

    const { location: currentLocation, navigate: currentNavigate } =
      routerState.current
    if (
      currentLocation.pathname !== '/login' &&
      currentLocation.pathname !== '/register'
    ) {
      const from =
        currentLocation.pathname +
        currentLocation.search +
        currentLocation.hash
      currentNavigate('/login', {
        replace: true,
        state: { from },
      })
    }
  }, [queryClient])

  useEffect(() => {
    const unregister = registerUnauthorizedHandler(handleUnauthorized)
    let active = true
    queueMicrotask(() => {
      if (active) {
        void validateSession()
      }
    })

    return () => {
      active = false
      unregister()
      validationAttempt.current += 1
    }
  }, [handleUnauthorized, validateSession])

  const login = useCallback(async (input: LoginInput) => {
    const result = await apiRequest<AuthResponse>('/auth/login', {
      method: 'POST',
      body: input,
    })
    unauthorizedHandled.current = false
    setAuthToken(result.token)
    setUser(result.user)
    setStatus('authenticated')
  }, [])

  const register = useCallback(async (input: RegisterInput) => {
    const result = await apiRequest<AuthResponse>('/auth/register', {
      method: 'POST',
      body: input,
    })
    unauthorizedHandled.current = false
    setAuthToken(result.token)
    setUser(result.user)
    setStatus('authenticated')
  }, [])

  const logout = useCallback(() => {
    clearAuthToken()
    queryClient.clear()
    setUser(null)
    setStatus('anonymous')
    routerState.current.navigate('/login', { replace: true })
  }, [queryClient])

  const retryAuthentication = useCallback(async () => {
    setStatus('loading')
    await validateSession()
  }, [validateSession])

  const value: AuthContextValue = {
    status,
    user,
    login,
    register,
    logout,
    retryAuthentication,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
