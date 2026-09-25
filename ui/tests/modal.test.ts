import { afterEach, describe, expect, it, vi } from 'vitest'
import modal, { configureErrorModal, describeErrorResponse } from '../core/modal'

/**
 * The overlay for a non-Pageflow response: a compact default, or whatever the
 * project mounts through configureErrorModal().
 */
afterEach(() => {
  modal.hide()
  configureErrorModal({ mount: null })
})

describe('describeErrorResponse', () => {
  it('reads the kernel error envelope', () => {
    const error = describeErrorResponse({ error: { code: 'not_found', message: 'Resource not found.' } }, 404, '/x')

    expect(error).toMatchObject({ kind: 'json', status: 404, code: 'not_found', message: 'Resource not found.', url: '/x', html: null })
  })

  it('recognises an HTML page and falls back to a message for its status', () => {
    const error = describeErrorResponse('<!doctype html><h1>Fatal error</h1>', 500)

    expect(error.kind).toBe('html')
    expect(error.html).toContain('Fatal error')
    expect(error.message).toBe('Something went wrong on our side.')
  })

  it('treats anything else as text', () => {
    expect(describeErrorResponse('just words', 502)).toMatchObject({ kind: 'text', message: 'The server is unreachable right now.' })
  })
})

describe('default card', () => {
  it('is a compact dialog, not a full-screen dump', () => {
    modal.show({ error: { code: 'server_error', message: 'Boom.' } }, 500)

    const dialog = document.querySelector('[data-pageflow-error] [role="alertdialog"]') as HTMLElement
    expect(dialog).not.toBeNull()
    expect(dialog.style.maxWidth).toBe('720px')
    expect(dialog.style.maxHeight).toBe('80vh')
    expect(dialog.textContent).toContain('Boom.')
    expect(dialog.textContent).toContain('(500)')
  })

  it('renders an HTML response in a sandboxed iframe, never into the app', () => {
    modal.show('<h1>Fatal</h1><script>window.pwned = true</script>', 500)

    const frame = document.querySelector('[data-pageflow-error] iframe') as HTMLIFrameElement
    expect(frame.getAttribute('sandbox')).toBe('')
    expect(frame.srcdoc).toContain('<h1>Fatal</h1>')
    expect((window as unknown as { pwned?: boolean }).pwned).toBeUndefined()
  })

  it('closes on Escape and restores scrolling', () => {
    document.body.style.overflow = 'auto'
    modal.show({ error: { message: 'x' } }, 500)
    expect(document.body.style.overflow).toBe('hidden')

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

    expect(document.querySelector('[data-pageflow-error]')).toBeNull()
    expect(document.body.style.overflow).toBe('auto')
  })
})

describe('project-owned modal', () => {
  it('hands the project the normalised error and an empty host, and cleans up on close', () => {
    const cleanup = vi.fn()
    let closer: () => void = () => {}
    const mount = vi.fn((error, host: HTMLElement, close: () => void) => {
      host.innerHTML = '<div class="project-dialog">custom</div>'
      closer = close
      return cleanup
    })
    configureErrorModal({ mount })

    modal.show({ error: { code: 'forbidden', message: 'No.' } }, 403, '/secret')

    expect(mount).toHaveBeenCalledOnce()
    expect(mount.mock.calls[0][0]).toMatchObject({ status: 403, code: 'forbidden', message: 'No.', url: '/secret' })
    expect(document.querySelector('[data-pageflow-error] .project-dialog')).not.toBeNull()
    expect(document.querySelector('[role="alertdialog"]')).toBeNull()

    closer()

    expect(cleanup).toHaveBeenCalledOnce()
    expect(document.querySelector('[data-pageflow-error]')).toBeNull()
  })

  it('replaces an overlay that is already open instead of stacking a second', () => {
    modal.show({ error: { message: 'first' } }, 500)
    modal.show({ error: { message: 'second' } }, 500)

    const hosts = document.querySelectorAll('[data-pageflow-error]')
    expect(hosts).toHaveLength(1)
    expect(hosts[0].textContent).toContain('second')
  })
})

describe('an ordinary HTML page', () => {
  it('is flagged fullPage, not reported as an error', () => {
    const error = describeErrorResponse('<!doctype html><h1>Docs</h1>', 200, 'https://app.test/docs')

    expect(error.fullPage).toBe(true)
    expect(error.message).toBe('This link opens a page that is not part of the app.')
    expect(describeErrorResponse('<h1>Fatal</h1>', 500).fullPage).toBe(false)
    expect(describeErrorResponse({ ok: true }, 200).fullPage).toBe(false)
  })

  it('asks before opening it, and opens it with a full page load', () => {
    const assign = vi.fn()
    const original = window.location
    Object.defineProperty(window, 'location', { configurable: true, value: { ...original, assign } })

    try {
      modal.show('<!doctype html><h1>Docs</h1>', 200, 'https://app.test/docs')

      const dialog = document.querySelector('[data-pageflow-error] [role="alertdialog"]') as HTMLElement
      expect(dialog.textContent).toContain('Open this page?')
      expect(dialog.textContent).toContain('https://app.test/docs')
      expect(dialog.querySelector('iframe')).toBeNull()

      const open = [...dialog.querySelectorAll('button')].find((b) => b.textContent === 'Open page') as HTMLButtonElement
      open.click()

      expect(assign).toHaveBeenCalledWith('https://app.test/docs')
    } finally {
      Object.defineProperty(window, 'location', { configurable: true, value: original })
    }
  })
})
