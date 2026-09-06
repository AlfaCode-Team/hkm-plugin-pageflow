import { beforeEach, describe, expect, it } from 'vitest'
import shouldIntercept from '../core/shouldIntercept'

// jsdom's default origin. Anything else is a third party.
const ORIGIN = window.location.origin

/** Build the subset of a click event that shouldIntercept actually reads. */
function click(el: HTMLElement, overrides: Partial<Parameters<typeof shouldIntercept>[0]> = {}) {
  return {
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    button: 0,
    defaultPrevented: false,
    target: el,
    currentTarget: el,
    ...overrides,
  } as Parameters<typeof shouldIntercept>[0]
}

function anchor(attrs: Record<string, string>): HTMLAnchorElement {
  const a = document.createElement('a')
  for (const [k, v] of Object.entries(attrs)) {
    a.setAttribute(k, v)
  }
  return a
}

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('shouldIntercept — the user asking for the browser', () => {
  it('intercepts an ordinary same-origin left click', () => {
    expect(shouldIntercept(click(anchor({ href: '/dashboard' })))).toBe(true)
  })

  it.each(['altKey', 'ctrlKey', 'metaKey', 'shiftKey'] as const)('declines on %s', (key) => {
    expect(shouldIntercept(click(anchor({ href: '/dashboard' }), { [key]: true }))).toBe(false)
  })

  it('declines a middle click', () => {
    expect(shouldIntercept(click(anchor({ href: '/dashboard' }), { button: 1 }))).toBe(false)
  })

  it('declines an already-handled event', () => {
    expect(shouldIntercept(click(anchor({ href: '/dashboard' }), { defaultPrevented: true }))).toBe(false)
  })
})

describe('shouldIntercept — links the browser owns', () => {
  it('declines a cross-origin href', () => {
    expect(shouldIntercept(click(anchor({ href: 'https://elsewhere.example/x' })))).toBe(false)
  })

  it('declines a protocol-relative cross-origin href', () => {
    expect(shouldIntercept(click(anchor({ href: '//elsewhere.example/x' })))).toBe(false)
  })

  it('declines a download', () => {
    expect(shouldIntercept(click(anchor({ href: '/resource/9/download', download: '' })))).toBe(false)
  })

  it('declines a link aimed at another browsing context', () => {
    expect(shouldIntercept(click(anchor({ href: '/terms', target: '_blank' })))).toBe(false)
  })

  it.each(['mailto:hi@example.com', 'tel:+254700000000', 'sms:+254700000000'])(
    'declines the %s scheme',
    (href) => {
      expect(shouldIntercept(click(anchor({ href })))).toBe(false)
    },
  )
})

describe('shouldIntercept — links Pageflow can still serve', () => {
  it('intercepts an absolute same-origin href', () => {
    expect(shouldIntercept(click(anchor({ href: `${ORIGIN}/dashboard` })))).toBe(true)
  })

  it('intercepts target="_self"', () => {
    expect(shouldIntercept(click(anchor({ href: '/terms', target: '_self' })))).toBe(true)
  })

  it('intercepts a same-page hash link, as before', () => {
    expect(shouldIntercept(click(anchor({ href: '#section-2' })))).toBe(true)
  })

  it('intercepts an anchor with no href at all', () => {
    expect(shouldIntercept(click(anchor({})))).toBe(true)
  })

  it('intercepts a non-anchor element regardless of what it carries', () => {
    const button = document.createElement('button')
    button.setAttribute('download', '')
    expect(shouldIntercept(click(button))).toBe(true)
  })

  it('declines inside a contentEditable region', () => {
    const a = anchor({ href: '/dashboard' })
    const editable = document.createElement('div')
    editable.contentEditable = 'true'
    Object.defineProperty(editable, 'isContentEditable', { value: true })
    expect(shouldIntercept(click(a, { target: editable }))).toBe(false)
  })
})
