import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { ApiError } from '../../api/client.ts'
import type { ValidationIssue } from '../../api/types.ts'
import { useAuth } from '../../auth/useAuth.ts'

type AuthMode = 'login' | 'register'
type FieldName = 'name' | 'email' | 'password'
type FieldErrors = Partial<Record<FieldName, string>>

interface AuthFormProps {
  mode: AuthMode
}

interface FormValues {
  name: string
  email: string
  password: string
}

const EMPTY_VALUES: FormValues = { name: '', email: '', password: '' }
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function passwordByteLength(password: string): number {
  return new TextEncoder().encode(password).length
}

function validate(values: FormValues, mode: AuthMode): FieldErrors {
  const errors: FieldErrors = {}
  const email = values.email.trim()

  if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) {
    errors.email = 'Enter a valid email address.'
  }

  if (mode === 'register') {
    const name = values.name.trim()
    if (name.length < 1 || name.length > 100) {
      errors.name = 'Name must be between 1 and 100 characters.'
    }
    if (values.password.length < 8) {
      errors.password = 'Password must be at least 8 characters.'
    }
  } else if (values.password.length === 0) {
    errors.password = 'Password is required.'
  }

  if (passwordByteLength(values.password) > 72) {
    errors.password = 'Password is too long'
  }

  return errors
}

function issueField(issue: ValidationIssue): FieldName | undefined {
  const parts =
    typeof issue.path === 'string' ? issue.path.split('.') : issue.path
  const field = parts.at(-1)
  return field === 'name' || field === 'email' || field === 'password'
    ? field
    : undefined
}

function serverErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return 'Something went wrong. Please try again.'
  }
  if (error.status === 401 && error.code === 'INVALID_CREDENTIALS') {
    return 'Invalid email or password.'
  }
  if (error.status === 409 && error.code === 'EMAIL_TAKEN') {
    return 'An account with this email already exists.'
  }
  if (error.status === 429) {
    return 'Too many attempts, try again later.'
  }

  return error.message
}

export function AuthForm({ mode }: AuthFormProps) {
  const { login, register } = useAuth()
  const [values, setValues] = useState<FormValues>(EMPTY_VALUES)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [generalError, setGeneralError] = useState('')
  const [pending, setPending] = useState(false)
  const isRegister = mode === 'register'

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setGeneralError('')

    const validationErrors = validate(values, mode)
    setFieldErrors(validationErrors)
    if (Object.keys(validationErrors).length > 0) {
      return
    }

    setPending(true)
    try {
      const credentials = {
        email: values.email.trim(),
        password: values.password,
      }
      if (isRegister) {
        await register({
          ...credentials,
          name: values.name.trim(),
        })
      } else {
        await login(credentials)
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 422 && error.details) {
        const mapped: FieldErrors = {}
        let hasUnmappedIssue = false
        for (const issue of error.details) {
          const field = issueField(issue)
          if (field && (field !== 'name' || isRegister)) {
            mapped[field] = issue.message
          } else {
            hasUnmappedIssue = true
          }
        }
        setFieldErrors(mapped)
        if (hasUnmappedIssue || Object.keys(mapped).length === 0) {
          setGeneralError(error.message)
        }
      } else {
        setGeneralError(serverErrorMessage(error))
      }
    } finally {
      setPending(false)
    }
  }

  function updateField(field: FieldName, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
    setFieldErrors((current) => ({ ...current, [field]: undefined }))
    setGeneralError('')
  }

  const fieldClassName =
    'mt-1 block w-full rounded-md border border-line bg-surface px-3 py-2.5 text-ink shadow-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/40'

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <section className="w-full max-w-md rounded-md border border-line bg-surface p-6 shadow-lg shadow-black/25 sm:p-8">
        <div className="mb-6">
          <p className="text-sm font-semibold text-accent-hover">Project Manager</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink">
            {isRegister ? 'Create your account' : 'Sign in'}
          </h1>
        </div>

        <form noValidate onSubmit={submit} className="space-y-4">
          {generalError && (
            <div
              role="alert"
              aria-live="polite"
              className="rounded-md border border-red-400/40 bg-red-950/40 px-3 py-2 text-sm text-red-200"
            >
              {generalError}
            </div>
          )}

          {isRegister && (
            <div>
              <label
                htmlFor="name"
                className="block text-xs font-semibold text-secondary"
              >
                Full name
              </label>
              <input
                id="name"
                name="name"
                autoComplete="name"
                required
                value={values.name}
                onChange={(event) => updateField('name', event.target.value)}
                aria-invalid={Boolean(fieldErrors.name)}
                aria-describedby={fieldErrors.name ? 'name-error' : undefined}
                className={fieldClassName}
              />
              {fieldErrors.name && (
                <p id="name-error" className="mt-1 text-sm text-red-300">
                  {fieldErrors.name}
                </p>
              )}
            </div>
          )}

          <div>
            <label
              htmlFor="email"
              className="block text-xs font-semibold text-secondary"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={values.email}
              onChange={(event) => updateField('email', event.target.value)}
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? 'email-error' : undefined}
              className={fieldClassName}
            />
            {fieldErrors.email && (
              <p id="email-error" className="mt-1 text-sm text-red-300">
                {fieldErrors.email}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-xs font-semibold text-secondary"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              required
              value={values.password}
              onChange={(event) => updateField('password', event.target.value)}
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={
                fieldErrors.password ? 'password-error' : undefined
              }
              className={fieldClassName}
            />
            {fieldErrors.password && (
              <p id="password-error" className="mt-1 text-sm text-red-300">
                {fieldErrors.password}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-app shadow-sm transition hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending
              ? 'Please wait…'
              : isRegister
                ? 'Create account'
                : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-secondary">
          {isRegister ? 'Already have an account?' : 'New to Project Manager?'}{' '}
          <Link
            to={isRegister ? '/login' : '/register'}
            className="font-semibold text-accent-hover hover:text-accent"
          >
            {isRegister ? 'Sign in' : 'Create an account'}
          </Link>
        </p>
      </section>
    </main>
  )
}
