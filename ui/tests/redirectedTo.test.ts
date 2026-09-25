import { describe, expect, it } from 'vitest'
import { redirectedTo } from '../core/url'

describe('redirectedTo', () => {
  it('is null when the XHR was not redirected', () => {
    expect(redirectedTo('https://app.test/users', 'https://app.test/users')).toBeNull()
    expect(redirectedTo('https://app.test/users', undefined)).toBeNull()
  })

  it('ignores query parameters axios added from the visit data', () => {
    expect(redirectedTo('https://app.test/users', 'https://app.test/users?page=2')).toBeNull()
  })

  it('returns where a redirect led', () => {
    expect(redirectedTo('https://app.test/users', 'https://app.test/login?next=%2Fusers')?.href).toBe('https://app.test/login?next=%2Fusers')
  })
})
