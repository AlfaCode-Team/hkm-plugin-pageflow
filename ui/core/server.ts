import { createServer, IncomingMessage } from 'http'
import * as process from 'process'
import { PageflowAppResponse, Page } from './types'
import cluster from 'node:cluster';
import { availableParallelism } from 'node:os';

type AppCallback = (page: Page) => PageflowAppResponse
type RouteHandler = (request: IncomingMessage) => Promise<unknown>
type ServerOptions = {
  port?: number
  /** Interface to bind. Defaults to loopback — see the note in the factory. */
  host?: string
  /** Shared secret required by /shutdown. Defaults to PAGEFLOW_SSR_TOKEN. */
  token?: string
  /** Max accepted /render body in bytes. Defaults to 2 MiB. */
  maxBodyBytes?: number
  cluster?: boolean
}
type Port = number

/**
 * Raised by a route to select a non-500 status.
 *
 * Written with an explicit field rather than a TypeScript parameter property:
 * parameter properties require a real transform, so type-STRIPPING loaders
 * (node --experimental-strip-types, esbuild in some modes) reject them.
 */
class HttpError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/**
 * Read the request body, refusing anything over `limit`.
 *
 * The previous version accumulated without a cap, so a single large POST could
 * grow the string until the process died — a trivial denial of service against
 * a server that has no authentication in front of it.
 */
const readableToString: (readable: IncomingMessage, limit: number) => Promise<string> = (readable, limit) =>
  new Promise((resolve, reject) => {
    let data = ''
    let size = 0

    readable.on('data', (chunk) => {
      size += chunk.length
      if (size > limit) {
        reject(new HttpError(413, `Request body exceeds ${limit} bytes.`))
        readable.destroy()
        return
      }
      data += chunk
    })
    readable.on('end', () => resolve(data))
    readable.on('error', (err) => reject(err))
  })

export default (render: AppCallback, options?: Port | ServerOptions): void => {
  const _port = typeof options === 'number' ? options : options?.port ?? 13714;
  const _useCluster = typeof options === 'object' && options?.cluster !== undefined ? options.cluster : false;

  // Bind to LOOPBACK by default. This used to listen on every interface with no
  // authentication whatsoever, so anyone who could reach the port could kill the
  // process via /shutdown or drive arbitrary renders. The SSR server is an
  // internal detail of the PHP application on the same host; it has no reason to
  // be reachable from the network. Override deliberately (a container sidecar may
  // need 0.0.0.0) — and put a network policy in front of it if you do.
  const _host = (typeof options === 'object' && options?.host) || process.env.PAGEFLOW_SSR_HOST || '127.0.0.1';

  // Shared secret for /shutdown. Empty means the route is DISABLED rather than
  // open: an unauthenticated kill switch is worse than no kill switch.
  const _token = (typeof options === 'object' && options?.token) || process.env.PAGEFLOW_SSR_TOKEN || '';

  const _maxBody = (typeof options === 'object' && options?.maxBodyBytes) || 2 * 1024 * 1024;

  const log = (message: string) => {
    console.log(_useCluster && !cluster.isPrimary ? `[${cluster.worker?.id ?? 'N/A'} / ${cluster.worker?.process?.pid ?? 'N/A'}] ${message}` : message)
  }

  if (_useCluster && cluster.isPrimary) {
    log('Primary Pageflow SSR server process started...')

    for (let i = 0; i < availableParallelism(); i++) {
      cluster.fork()
    }

    return
  }

  /** Constant-time compare, so the token cannot be recovered a byte at a time. */
  const tokenMatches = (supplied: string | undefined): boolean => {
    if (!_token || !supplied || supplied.length !== _token.length) return false
    let diff = 0
    for (let i = 0; i < _token.length; i++) diff |= _token.charCodeAt(i) ^ supplied.charCodeAt(i)
    return diff === 0
  }

  const routes: Record<string, RouteHandler> = {
    '/health': async () => ({ status: 'OK', timestamp: Date.now() }),

    '/shutdown': async (request) => {
      if (!tokenMatches(request.headers['x-pageflow-token'] as string | undefined)) {
        // 404, not 403: do not confirm the endpoint exists to an unauthorised caller.
        throw new HttpError(404, 'Not found.')
      }
      // Respond BEFORE exiting, so the caller sees the acknowledgement.
      setTimeout(() => process.exit(0), 10)
      return { status: 'SHUTTING_DOWN' }
    },

    '/render': async (request) => render(JSON.parse(await readableToString(request, _maxBody))),
    '/404': async () => { throw new HttpError(404, 'Not found.') },
  }

  createServer(async (request, response) => {
    // Strip the query string before dispatch: '/health?x=1' used to fall through
    // to the 404 handler.
    // `as` rather than the angle-bracket form: <T>expr is rejected by
    // type-stripping loaders and is invalid in .tsx.
    const path = ((request.url as string) ?? '/').split('?')[0]
    const dispatchRoute = routes[path] || routes['/404']

    let status = 200
    let payload: string

    // Build the body FIRST, then commit the status. The previous order wrote
    // writeHead(200) before awaiting the handler, so a render failure produced
    // "200 OK" with an empty body — the PHP responder could not distinguish a
    // successful empty render from a crashed one, and shipped a blank page.
    try {
      payload = JSON.stringify(await dispatchRoute(request))
    } catch (e) {
      status = e instanceof HttpError ? e.status : 500
      const message = e instanceof Error ? e.message : 'SSR render failed.'

      if (status >= 500) console.error(e)

      payload = JSON.stringify({ error: { status, message } })
    }

    response.writeHead(status, { 'Content-Type': 'application/json', Server: 'Pageflow.js SSR' })
    response.write(payload)
    response.end()
  }).listen(_port, _host, () => log(`Pageflow SSR server started on ${_host}:${_port}.`))

  if (!_token) {
    log('Pageflow SSR: /shutdown is disabled (set PAGEFLOW_SSR_TOKEN to enable it).')
  }

  log(`Starting SSR server on ${_host}:${_port}...`)
}
