import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
// Imported as the singleton, not the class: core/index.ts constructs it, and
// core/router.ts imports back from core/index.ts — reaching for the class
// directly trips that cycle before Router is defined.
import { router } from '../core'

// jsdom refuses to navigate, so `location` is stubbed. The stub records what was
// assigned rather than acting on it, which is exactly what we want to assert.
const reload = vi.fn()
const replace = vi.fn()
let assigned: string[] = []
let original: Location

function atPage(current: string): void {
  const url = new URL(current)

  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: {
      get href() {
        return url.href
      },
      set href(next: string) {
        assigned.push(next)
      },
      origin: url.origin,
      pathname: url.pathname,
      search: url.search,
      hash: url.hash,
      toString: () => url.href,
      reload,
      replace,
    },
  })
}

/** hardVisit is protected; the public door is visit(url, { hard: true }). */
function hardVisit(href: string, options: Record<string, unknown> = {}): void {
  router.visit(href, { hard: true, ...options })
}

beforeEach(() => {
  original = window.location
  assigned = []
  reload.mockClear()
  replace.mockClear()
})

afterEach(() => {
  Object.defineProperty(window, 'location', { configurable: true, writable: true, value: original })
})

describe('router.visit(url, { hard: true })', () => {
  it('assigns a different document and does not reload it', () => {
    atPage('https://app.test/dashboard')
    hardVisit('/reports')

    expect(assigned).toEqual(['https://app.test/reports'])
    expect(reload).not.toHaveBeenCalled()
    expect(replace).not.toHaveBeenCalled()
  })

  it('resolves a relative href against the current page', () => {
    atPage('https://app.test/a/b')
    hardVisit('../c')

    expect(assigned).toEqual(['https://app.test/c'])
  })

  it('carries an absolute cross-origin href through untouched', () => {
    atPage('https://app.test/dashboard')
    hardVisit('https://elsewhere.example/x')

    expect(assigned).toEqual(['https://elsewhere.example/x'])
  })

  it('uses replace() when asked, leaving no history entry', () => {
    atPage('https://app.test/dashboard')
    hardVisit('/reports', { replace: true })

    expect(replace).toHaveBeenCalledWith('https://app.test/reports')
    expect(assigned).toEqual([])
  })

  it('reloads when the target IS the current page', () => {
    atPage('https://app.test/dashboard')
    hardVisit('/dashboard')

    expect(reload).toHaveBeenCalledTimes(1)
  })

  // The regression this ordering exists for: reloading first would re-fetch the
  // OLD url and silently drop the requested hash.
  it('sets the hash BEFORE reloading when only the hash differs', () => {
    atPage('https://app.test/terms')
    hardVisit('/terms#clause-4')

    expect(assigned).toEqual(['https://app.test/terms#clause-4'])
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('honours replace on a hash-only move, and still reloads', () => {
    atPage('https://app.test/terms')
    hardVisit('/terms#clause-4', { replace: true })

    expect(replace).toHaveBeenCalledWith('https://app.test/terms#clause-4')
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('refuses a non-GET visit instead of silently dropping the body', () => {
    atPage('https://app.test/dashboard')

    expect(() => hardVisit('/reports', { method: 'post', data: { a: 1 } })).toThrow(/only valid on a GET visit/)
    expect(assigned).toEqual([])
    expect(replace).not.toHaveBeenCalled()
    expect(reload).not.toHaveBeenCalled()
  })
})
