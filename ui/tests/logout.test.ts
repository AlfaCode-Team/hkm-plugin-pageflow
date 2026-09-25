import { afterEach, describe, expect, it, vi } from 'vitest'
import axios from 'axios'
import { router } from '../core'

/**
 * router.logout(): leave with a real form POST that returns to the current page,
 * after dropping caches and refreshing the CSRF token.
 */
describe('router.logout', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    document.querySelectorAll('form, meta[name="csrf-token"]').forEach((n) => n.remove())
  })

  it('refreshes the token, flushes caches, then posts a real form back to this page', async () => {
    window.history.replaceState({}, '', '/editions/42?tab=votes')
    const meta = document.createElement('meta')
    meta.name = 'csrf-token'
    meta.content = 'stale'
    document.head.appendChild(meta)

    const get = vi.spyOn(axios, 'get').mockResolvedValue({ data: { token: 'fresh' } })
    const flush = vi.spyOn(router, 'flushAll')
    const submit = vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => {})

    await router.logout()

    expect(get).toHaveBeenCalledWith('/pageflow/csrf', expect.anything())
    expect(flush).toHaveBeenCalledOnce()
    const form = submit.mock.contexts[0] as HTMLFormElement
    expect(new URL(form.action).pathname).toBe('/auth/logout')
    expect(Object.fromEntries(new FormData(form))).toEqual({ redirectTo: '/editions/42?tab=votes', _csrf_token: 'fresh' })
  })

  it('still signs out with the current token when the refresh endpoint is unavailable', async () => {
    const meta = document.createElement('meta')
    meta.name = 'csrf-token'
    meta.content = 'current'
    document.head.appendChild(meta)
    vi.spyOn(axios, 'get').mockRejectedValue(new Error('404'))
    const submit = vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => {})

    await router.logout('/logout', { redirectTo: '/' })

    const form = submit.mock.contexts[0] as HTMLFormElement
    expect(new URL(form.action).pathname).toBe('/logout')
    expect(Object.fromEntries(new FormData(form))).toEqual({ redirectTo: '/', _csrf_token: 'current' })
  })
})
