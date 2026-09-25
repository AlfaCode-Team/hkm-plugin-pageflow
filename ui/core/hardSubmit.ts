import { csrfFormField, csrfToken, isSameOriginUrl } from './csrf'

type Scalar = string | number | boolean | null | undefined

/**
 * Submit `data` to `url` as a real HTML form POST — a browser navigation, not
 * an XHR. The server's response (normally a redirect) replaces the document,
 * exactly as if the user had pressed a submit button.
 *
 * The CSRF token rides as a form field (`configureCsrf({ formField })`),
 * because a form cannot send headers — and only to a same-origin action, so a
 * cross-origin target never receives it.
 *
 * Values must be scalars, or arrays/objects of scalars, which are flattened to
 * `key[0]` / `key[sub]` the way PHP reads them. A File cannot be carried by a
 * built form, so it throws rather than silently vanishing.
 */
export function hardSubmit(url: string | URL, data: Record<string, unknown> = {}): void {
  if (typeof document === 'undefined') {
    return
  }

  const form = document.createElement('form')
  form.method = 'post'
  form.action = String(url)
  form.style.display = 'none'

  const add = (name: string, value: Scalar) => {
    if (value === undefined || value === null) {
      return
    }
    const input = document.createElement('input')
    input.type = 'hidden'
    input.name = name
    input.value = typeof value === 'boolean' ? (value ? '1' : '0') : String(value)
    form.appendChild(input)
  }

  const walk = (name: string, value: unknown) => {
    if (typeof File !== 'undefined' && (value instanceof File || value instanceof Blob)) {
      throw new Error(`Pageflow: a hard POST cannot carry the file in "${name}". Submit it as a normal visit.`)
    }
    if (Array.isArray(value)) {
      value.forEach((item, i) => walk(`${name}[${i}]`, item))
    } else if (value !== null && typeof value === 'object') {
      Object.entries(value as Record<string, unknown>).forEach(([key, item]) => walk(`${name}[${key}]`, item))
    } else {
      add(name, value as Scalar)
    }
  }

  Object.entries(data).forEach(([key, value]) => walk(key, value))

  const token = csrfToken()
  if (token && isSameOriginUrl(String(url))) {
    add(csrfFormField(), token)
  }

  document.body.appendChild(form)
  form.submit()
}
