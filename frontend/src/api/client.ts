import type { ValidationIssue } from './types.ts'

// localStorage survives reloads but is JavaScript-readable; httpOnly cookies reduce XSS token theft but require CSRF defenses.
const TOKEN_STORAGE_KEY = 'agile.token'
const GENERIC_ERROR_MESSAGE = 'The request could not be completed.'
const API_BASE_URL =
  import.meta.env.VITE_API_URL?.trim().replace(/\/+$/, '') || '/api/v1'

let memoryToken: string | null = null
let unauthorizedHandler: (() => void) | null = null

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details: ValidationIssue[] | undefined

  constructor(
    status: number,
    code: string,
    message: string,
    details?: ValidationIssue[],
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

export function getAuthToken(): string | null {
  if (memoryToken !== null) {
    return memoryToken
  }

  try {
    memoryToken = window.localStorage.getItem(TOKEN_STORAGE_KEY)
  } catch {
    return memoryToken
  }

  return memoryToken
}

export function setAuthToken(token: string): void {
  memoryToken = token

  try {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token)
  } catch {
    // Keep the current session in memory if persistent storage is unavailable.
  }
}

export function clearAuthToken(): void {
  memoryToken = null

  try {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY)
  } catch {
    // The in-memory token is still cleared if persistent storage is unavailable.
  }
}

export function registerUnauthorizedHandler(
  handler: () => void,
): () => void {
  unauthorizedHandler = handler
  return () => {
    if (unauthorizedHandler === handler) {
      unauthorizedHandler = null
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isValidationIssue(value: unknown): value is ValidationIssue {
  if (!isRecord(value) || typeof value.message !== 'string') {
    return false
  }

  return (
    typeof value.path === 'string' ||
    (Array.isArray(value.path) &&
      value.path.every(
        (part): part is string | number =>
          typeof part === 'string' || typeof part === 'number',
      ))
  )
}

function readErrorEnvelope(
  payload: unknown,
  status: number,
): ApiError {
  if (isRecord(payload) && isRecord(payload.error)) {
    const error = payload.error

    if (
      typeof error.code === 'string' &&
      typeof error.message === 'string'
    ) {
      const details = Array.isArray(error.details)
        ? error.details.filter(isValidationIssue)
        : undefined
      return new ApiError(status, error.code, error.message, details)
    }
  }

  return new ApiError(status, 'REQUEST_FAILED', GENERIC_ERROR_MESSAGE)
}

function isPublicAuthRequest(path: string): boolean {
  const pathname = path.split('?')[0].replace(/\/+$/, '')
  return pathname === '/auth/login' || pathname === '/auth/register'
}

export interface ApiRequestOptions {
  method?: string
  body?: unknown
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const headers = new Headers({ Accept: 'application/json' })
  const token = getAuthToken()

  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json')
  }
  if (token && !isPublicAuthRequest(path)) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body:
        options.body === undefined
          ? undefined
          : JSON.stringify(options.body),
    })
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', "Can't reach the server.")
  }

  if (response.status === 401 && !isPublicAuthRequest(path)) {
    unauthorizedHandler?.()
  }

  if (response.status === 204) {
    return undefined as T
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new ApiError(
      response.status,
      'INVALID_RESPONSE',
      GENERIC_ERROR_MESSAGE,
    )
  }

  if (!response.ok) {
    throw readErrorEnvelope(payload, response.status)
  }

  return payload as T
}
