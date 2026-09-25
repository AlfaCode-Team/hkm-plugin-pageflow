# Pageflow

The SPA bridge for the AlfacodeTeam PhpServicePlatform — a fork of **Inertia.js
v2**, rebranded and wired into the kernel, plus platform-native capabilities
Inertia doesn't have (secure realtime, native validation/precognition,
permission-aware UI, offline, end-to-end types).

Write normal server controllers that return a **component name + props**; the
client swaps React components in place — SPA feel, no REST API, no client router.

- **Solves:** `http.pageflow`
- **PHP:** `plugins/Pageflow/`
- **Client:** `plugins/Pageflow/ui/` (`@pageflow/core`, `@pageflow/react`)
- **Full usage guide (PDF):** [`ui/PAGEFLOW_USAGE.pdf`](ui/PAGEFLOW_USAGE.pdf)
- **Architecture/flow guide (PDF):** [`ui/PAGEFLOW_GUIDE.pdf`](ui/PAGEFLOW_GUIDE.pdf)

## Quick start

**1. Env** (`.env`):

```
PAGEFLOW_VERSION="1"
PAGEFLOW_ROOT_VIEW="/abs/path/plugins/Pageflow/resources/views/app.php"
PAGEFLOW_APP_ID="app"
PAGEFLOW_CSRF_COOKIE="hkm_session"   # must be in Cookie's encrypt_exempt
```

**2. Register** the plugin in your project `bootstrap/app.php`
(`Plugins\Pageflow\Provider::class`).

**3. Controller** — inject `PageflowResponder`, return `render()`:

```php
final class UserController
{
    public function __construct(
        private readonly PageflowResponder $pageflow,
        private readonly UserServiceContract $users,
    ) {}

    public function index(Request $request): Response
    {
        return $this->pageflow->render($request, 'Users/Index', 'admin', [
            'users' => $this->users->all(),
        ]);
    }
}
```

**4. Client** (`main.tsx`):

```tsx
import { createPageflowApp, resolvePageComponent, installCsrfAutoRefresh } from '@pageflow/react'
import { createRoot } from 'react-dom/client'

installCsrfAutoRefresh()
createPageflowApp({
  resolve: (name) => resolvePageComponent(name, import.meta.glob('./Pages/**/*.tsx')),
  setup: ({ el, App, props }) => createRoot(el).render(<App {...props} />),
})
```

## Feature map

| Need | Client | Server |
|---|---|---|
| Link between pages | `<Link href>` | route → controller |
| Read controller data | `usePage()` | `render(...)` props |
| Form + validation errors | `useForm()` / `<Form>` | DTO throws `ValidationException` |
| Live validation | `usePrecognition` / `<Form validateOn>` | `pageflow_precognition()` |
| Realtime updates | `useReactiveProps` | `PageflowChannel::touch()` |
| Permission-gated UI | `useAuth()` / `<Can>` | `pageflow_auth` (auto) |
| Set page title | `<Head>` | — |
| SEO head + tab title | automatic (`seoHead` prop) | `seoFor()` / `seoPrivate()` |
| Offline | `registerPageflowSW()` | `render(..., cacheable: true)` |
| Typed props | `usePage<T>()` | `hkm pageflow:types` |
| Your own error dialog | `createPageflowApp({ errorModal })` | kernel error envelope |
| Sign out | `router.logout()` | `/auth/logout` redirects the form back |

## SEO — the reserved `seoHead` prop

A controller passes ONE reserved prop and the whole SEO surface is handled:

```php
return $this->pageflow->render($request, 'Shop/Product', 'project', props: [
    'sku'     => $sku,
    'seoHead' => $this->seoFor(          // Project\…\InteractsWithGraphSeo
        title: $name, description: $desc, path: "/product/{$sku}",
        image: "/img/p/{$sku}.jpg", type: 'product',
    ),
    // auth-gated / token pages: 'seoHead' => $this->seoPrivate('Your profile'),
]);
```

How it flows — no other wiring needed:

- **Full page load** → `seoHead` is the rendered SEO HTML block (title,
  description, canonical, robots, hreflang, OG/Twitter, JSON-LD `@graph`). The
  layout echoes it into `<head>` and STRIPS it from the client boot payload
  (the block contains a literal `</script>`; it must never ride
  `window.initialPage` / `data-page`).
- **XHR navigation** (`X-Pageflow`) → the helpers skip ALL the OG/graph work and
  return just the plain suffixed tab title (`"Product X · Site"`). The React
  `App` syncs `document.title` from it on every navigation — pages do NOT need
  `<Head title>` for titles; the server is the single source of truth. Values
  containing markup are ignored client-side (plain text only).
- Crawlers only ever take the full-load path, so SEO is complete without SSR.

`<Head>` remains available for anything else a page wants to inject into the
head (extra meta, links) — just don't use it for the title on pages that pass
`seoHead`.

## Signing out — `router.logout()`

```tsx
<button onClick={() => void router.logout()}>Sign out</button>   // POST /auth/logout, come back here
router.logout('/logout')                                           // a project's own endpoint
```

A sign-out is a **full page load**, never an XHR: it changes who the server is
talking to, so every page object and shared prop in memory belongs to the
outgoing user. `router.logout()`:

1. drops the prefetch cache and the service-worker page cache (both hold pages
   authorised as the outgoing user — this matters on a shared device);
2. fetches a fresh CSRF token from `/pageflow/csrf`, so a tab left open past the
   token's lifetime does not post a stale one and land on a bare 403;
3. submits a real form POST carrying `redirectTo` = the current path.

The endpoint answers the form with a redirect to `redirectTo` (Auth's
`/auth/logout` does, from v1.9.0), which reloads the page as a signed-out
visitor. The admin shell's sidebar sign-out uses it.

It is built on `{ hard: true }` for POST: `router.post(url, data, { hard: true })`
submits a real HTML form — data flattened to `key[0]` / `key[sub]`, the CSRF
token as the `_csrf_token` field (`configureCsrf({ formField })` to rename) — and
the server's response replaces the document. Files cannot be carried and throw;
methods other than GET and POST throw, because a browser form has no others.

## Error dialog — a project draws its own

When a visit gets back something that is not a Pageflow page — the kernel's
error envelope, a PHP error page, a route that answers with plain HTML or JSON —
the router shows an overlay. It is the one piece of UI Pageflow draws itself, so
a project can take it over completely:

```tsx
import { createPageflowApp, type PageflowErrorModalProps } from "@pageflow/react";

function ErrorDialog({ error, onClose }: PageflowErrorModalProps) {
  // Your Dialog, your tokens, your layout. Call onClose() to dismiss.
}

createPageflowApp({ resolve, setup, errorModal: ErrorDialog });
```

`error` is the response, normalised:

| Field | Meaning |
|---|---|
| `status` | HTTP status |
| `kind` | `'json'`, `'html'` or `'text'` |
| `message` | `error.message` from the envelope, or a plain sentence for the status |
| `code` | `error.code` from the envelope, or `null` |
| `html` | the markup when `kind === 'html'` — show it in a **sandboxed iframe** (`sandbox=""`, `srcDoc`), never via `innerHTML` |
| `data` | the body as received |
| `url` | the URL the visit requested |
| `fullPage` | `true` for an ordinary HTML page (2xx/3xx), not an error — ask, then open `url` with `window.location.assign(url)` |

The component is rendered in its own React root on `<body>`, outside the app's
providers — wrap it in whatever it needs. A theme applied as a class on `<html>`
reaches it unchanged.

Not React? `configureErrorModal({ mount(error, host, close) { … } })` from
`@pageflow/core` hands you an empty host element instead; return a cleanup
function to run on close.

Without either, a compact default card is shown: centred, at most 720px wide and
80% of the viewport high, the message up front and the raw response behind
"Details", HTML in a sandboxed iframe. For a `fullPage` response it asks "Open
this page?" and, on yes, loads the URL with a full page load, as a plain link
would.

### Redirects leave the app the way a link would

A visit is never trapped by a redirect it cannot render:

| The visit is redirected to… | What happens |
|---|---|
| another Pageflow page on this origin | rendered in place, as before |
| a non-Pageflow page on this origin | the client does a full page load of the URL the redirect led to — no dialog |
| another origin (host, scheme or port) | `PageflowStage` answers `409` + `X-Pageflow-Location`, and the client does a full page load there. The browser could not follow it inside the XHR (CORS), so the click used to do nothing |

A redirect that ends in an error status is not followed; the error dialog
explains it instead. A listener on the cancellable
`pageflow:invalid` document event still runs first and can suppress the overlay
altogether.

## Security invariants (do not regress)

- **Push signals, pull data** — the reactive channel emits prop key *names* only;
  data is always re-fetched through the authenticated pipeline.
- **CSRF token stays same-origin** and lives only in the `<meta>` tag + the
  throttled `/pageflow/csrf` endpoint (never in page-object JSON or SW cache).
- **Client permission checks are UX only** — the Service layer is the authority.
- **Offline caching is opt-in** — authenticated pages are never cached by default.
- **A non-Pageflow response never runs in the app** — the error overlay shows
  HTML in a sandboxed iframe, never through `innerHTML` or `document.write`.

See the full guide PDFs for cookbook examples, the wire protocol, and the
security hardening ledger.

## Endpoints

| Route | Purpose | Filters |
|---|---|---|
| `GET /pageflow/csrf` | refresh CSRF token | `throttle` |
| `GET /pageflow/stream` | reactive SSE channel (tenant-scoped) | `auth`, `throttle` |

> The SSE stream holds a connection — run it under OpenSwoole, not a small PHP-FPM pool.
