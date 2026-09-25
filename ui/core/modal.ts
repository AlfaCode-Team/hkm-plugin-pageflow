/**
 * The overlay shown when a Pageflow visit gets back something that is not a
 * Pageflow page — an error envelope, a PHP error page, a route that returns
 * plain HTML or JSON.
 *
 * ── A PROJECT OWNS THE LOOK ────────────────────────────────────────────────
 * This is the one piece of UI the router draws by itself, so it is the one
 * place a project could not restyle. `configureErrorModal({ mount })` hands the
 * whole thing over: Pageflow normalises the response into a
 * {@link PageflowErrorResponse}, gives the project an empty host element, and
 * gets out of the way. The project renders its own dialog into it — its own
 * components, design tokens and layout — and calls `close()` when done.
 *
 *     configureErrorModal({
 *       mount(error, host, close) {
 *         const root = createRoot(host)
 *         root.render(<ErrorDialog error={error} onClose={close} />)
 *         return () => root.unmount()
 *       },
 *     })
 *
 * React projects pass `errorModal: ErrorDialog` to createPageflowApp instead,
 * which does exactly the above.
 *
 * Without a mount, a compact default card is shown: centred, at most 720px wide
 * and 80% of the viewport high, with the server's message up front and the raw
 * response behind "Details". It replaces a full-screen iframe that covered the
 * whole app with a raw dump.
 *
 * An ordinary HTML page (2xx/3xx — `fullPage`) is not treated as a failure: the
 * card asks "Open this page?" and, on yes, loads it with a full page load, the
 * way a plain link would. A visit that was REDIRECTED to such a page never
 * reaches this overlay at all — Response follows the redirect itself.
 *
 * A listener on the cancellable `pageflow:invalid` event still runs FIRST and
 * can suppress this entirely (see Response::handleNonPageflowResponse).
 */

/** A non-Pageflow response, normalised for display. */
export type PageflowErrorResponse = {
  /** HTTP status of the response (0 when unknown). */
  status: number
  /** What the body turned out to be. */
  kind: 'html' | 'json' | 'text'
  /** The body as received: parsed JSON for `json`, the markup/text otherwise. */
  data: unknown
  /** The markup, when `kind === 'html'` — render it in a sandboxed iframe, never innerHTML. */
  html: string | null
  /** `error.code` from the kernel's error envelope, when present. */
  code: string | null
  /** `error.message` from the envelope, or a generic sentence for the status. */
  message: string
  /** The URL the visit requested. */
  url: string
  /**
   * True when the response is an ordinary web page (HTML, 2xx/3xx) rather than
   * an error — a link to something this app does not render. Offer to open
   * `url` with a full page load (`window.location.assign(url)`), the way a
   * plain anchor would, instead of reporting a failure.
   */
  fullPage: boolean
}

/**
 * Render the error into `host`, an empty element Pageflow has appended to
 * <body>. Call `close` to dismiss it. May return a cleanup function, which runs
 * on close before the host is removed (unmount a React root there).
 */
export type ErrorModalMount = (
  error: PageflowErrorResponse,
  host: HTMLElement,
  close: () => void,
) => void | (() => void)

export type ErrorModalConfig = {
  /** Project-owned renderer. `null` restores the default card. */
  mount: ErrorModalMount | null
}

const config: ErrorModalConfig = { mount: null }

/** Hand the error overlay to the project. See the module docblock. */
export function configureErrorModal(overrides: Partial<ErrorModalConfig>): void {
  Object.assign(config, overrides)
}

const GENERIC: Record<number, string> = {
  401: 'You need to sign in to continue.',
  403: 'You do not have permission to do that.',
  404: 'That page could not be found.',
  419: 'Your session expired. Refresh the page and try again.',
  429: 'Too many requests. Wait a moment and try again.',
  500: 'Something went wrong on our side.',
  502: 'The server is unreachable right now.',
  503: 'The service is temporarily unavailable.',
}

/** Normalise a raw response body into what a renderer needs. */
export function describeErrorResponse(data: unknown, status = 0, url = ''): PageflowErrorResponse {
  const isObject = typeof data === 'object' && data !== null
  const text = typeof data === 'string' ? data : ''
  const kind: PageflowErrorResponse['kind'] = isObject ? 'json' : /<[a-z!/][\s\S]*>/i.test(text) ? 'html' : 'text'

  const envelope = isObject ? (data as { error?: { code?: unknown; message?: unknown } }).error : undefined
  const code = typeof envelope?.code === 'string' ? envelope.code : null
  const fromEnvelope = typeof envelope?.message === 'string' && envelope.message !== '' ? envelope.message : null
  const fullPage = kind === 'html' && status >= 200 && status < 400

  return {
    status,
    kind,
    data,
    html: kind === 'html' ? text : null,
    code,
    message: fullPage
      ? 'This link opens a page that is not part of the app.'
      : fromEnvelope ?? GENERIC[status] ?? (status >= 500 ? GENERIC[500] : 'The server sent a response this page cannot display.'),
    url,
    fullPage,
  }
}

let host: HTMLElement | null = null
let cleanup: (() => void) | null = null
let previousOverflow = ''
let escapeListener: ((event: KeyboardEvent) => void) | null = null

export default {
  /** Show a non-Pageflow response. Replaces any overlay already open. */
  show(data: unknown, status = 0, url = ''): void {
    this.hide()

    const error = describeErrorResponse(data, status, url)

    host = document.createElement('div')
    host.setAttribute('data-pageflow-error', '')
    document.body.appendChild(host)

    const close = () => this.hide()

    if (config.mount) {
      cleanup = config.mount(error, host, close) || null
      return
    }

    renderDefault(error, host, close)
    previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    escapeListener = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close()
      }
    }
    document.addEventListener('keydown', escapeListener)
  },

  hide(): void {
    if (host === null) {
      return
    }

    const done = cleanup
    cleanup = null
    try {
      done?.()
    } finally {
      host.remove()
      host = null

      if (escapeListener) {
        document.removeEventListener('keydown', escapeListener)
        document.body.style.overflow = previousOverflow
        escapeListener = null
      }
    }
  },
}

/** The default card — plain DOM, no dependencies, inherits the page's font. */
function renderDefault(error: PageflowErrorResponse, into: HTMLElement, close: () => void): void {
  const backdrop = el('div', {
    position: 'fixed', inset: '0', zIndex: '200000', display: 'flex', alignItems: 'center',
    justifyContent: 'center', padding: '16px', backgroundColor: 'rgba(15, 23, 42, .45)',
  })
  backdrop.addEventListener('click', (event) => event.target === backdrop && close())

  const card = el('div', {
    width: '100%', maxWidth: '720px', maxHeight: '80vh', display: 'flex', flexDirection: 'column',
    backgroundColor: '#fff', color: '#0f172a', borderRadius: '12px', overflow: 'hidden',
    boxShadow: '0 20px 50px rgba(15, 23, 42, .25)', font: 'inherit',
  })
  card.setAttribute('role', 'alertdialog')
  card.setAttribute('aria-modal', 'true')
  card.setAttribute('aria-labelledby', 'pageflow-error-title')

  const header = el('div', { display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '20px 20px 12px' })
  const heading = el('div', { flex: '1', minWidth: '0' })
  const title = el('h2', { margin: '0', fontSize: '16px', fontWeight: '600' })
  title.id = 'pageflow-error-title'
  title.textContent = error.fullPage
    ? 'Open this page?'
    : error.status ? `Something went wrong (${error.status})` : 'Something went wrong'
  const message = el('p', { margin: '6px 0 0', fontSize: '14px', color: '#475569', overflowWrap: 'anywhere' })
  message.textContent = error.message
  heading.append(title, message)

  const dismiss = el('button', {
    border: '0', background: 'transparent', cursor: 'pointer', fontSize: '20px',
    lineHeight: '1', color: '#64748b', padding: '2px 6px',
  })
  dismiss.type = 'button'
  dismiss.setAttribute('aria-label', 'Close')
  dismiss.textContent = '×'
  dismiss.addEventListener('click', close)
  header.append(heading, dismiss)
  card.append(header)

  if (error.fullPage) {
    // Not an error: the link leads to a page this app does not render. Ask,
    // then go there with a full page load — exactly what a plain <a> does.
    const footer = el('div', {
      display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', padding: '0 20px 20px',
    })
    const target = el('code', {
      flex: '1 1 100%', fontSize: '12px', color: '#475569', overflowWrap: 'anywhere', marginBottom: '8px',
    })
    target.textContent = error.url
    const cancel = button('Cancel', false)
    cancel.addEventListener('click', close)
    const proceed = button('Open page', true)
    proceed.addEventListener('click', () => window.location.assign(error.url))
    footer.append(target, el('span', { flex: '1' }), cancel, proceed)
    card.append(footer)
    backdrop.append(card)
    into.append(backdrop)
    proceed.focus()
    return
  }

  if (error.kind === 'html' && error.html) {
    // A full error page reads best as itself. Sandboxed with no scripts, so
    // markup from the response cannot run in (or reach into) the app.
    const frame = el('iframe', { border: '0', borderTop: '1px solid #e2e8f0', width: '100%', height: '60vh' }) as HTMLIFrameElement
    frame.setAttribute('sandbox', '')
    frame.setAttribute('title', 'Server response')
    frame.srcdoc = error.html
    card.append(frame)
  } else {
    const details = el('details', { borderTop: '1px solid #e2e8f0', padding: '12px 20px 16px', overflow: 'auto' })
    const summary = el('summary', { cursor: 'pointer', fontSize: '13px', color: '#64748b' })
    summary.textContent = 'Details'
    const pre = el('pre', {
      margin: '10px 0 0', fontSize: '12px', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', color: '#334155',
    })
    pre.textContent = error.kind === 'json' ? JSON.stringify(error.data, null, 2) : String(error.data ?? '')
    details.append(summary, pre)
    card.append(details)
  }

  backdrop.append(card)
  into.append(backdrop)
  dismiss.focus()
}

function button(label: string, primary: boolean): HTMLButtonElement {
  const node = el('button', {
    font: 'inherit', fontSize: '14px', fontWeight: '500', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer',
    border: primary ? '1px solid #0f172a' : '1px solid #cbd5e1',
    backgroundColor: primary ? '#0f172a' : '#fff', color: primary ? '#fff' : '#0f172a',
  })
  node.type = 'button'
  node.textContent = label

  return node
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, style: Partial<CSSStyleDeclaration>): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  Object.assign(node.style, style)
  return node
}
