import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiRequest } from './client.ts'

describe('apiRequest', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('parses the API error envelope', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: 'EMAIL_TAKEN',
              message: 'An account with this email already exists',
              details: [{ path: ['email'], message: 'Email is taken' }],
            },
          }),
          { status: 409, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    )

    await expect(
      apiRequest('/auth/register', {
        method: 'POST',
        body: { email: 'person@example.com', name: 'Person', password: 'password' },
      }),
    ).rejects.toMatchObject({
      name: 'ApiError',
      status: 409,
      code: 'EMAIL_TAKEN',
      details: [{ path: ['email'], message: 'Email is taken' }],
    })
  })

  it('returns a generic ApiError for non-JSON responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('<html>Proxy error</html>', {
          status: 502,
          headers: { 'Content-Type': 'text/html' },
        }),
      ),
    )

    const request = apiRequest('/projects')
    await expect(request).rejects.toBeInstanceOf(ApiError)
    await expect(request).rejects.toMatchObject({
      status: 502,
      code: 'INVALID_RESPONSE',
      message: 'The request could not be completed.',
    })
  })
})
