// The actual event passed to this function could be a native JavaScript event
// or a React synthetic event, so we are picking just the keys needed here (that
// are present in both types).

/**
 * Decide whether Pageflow should take a click over from the browser.
 *
 * Two separate questions, and the second one used to be missing entirely.
 *
 * 1. Did the USER ask for the browser? A modifier key or a middle click means
 *    "open this somewhere else", and an already-prevented event means someone
 *    upstream has handled it.
 *
 * 2. Is this link something Pageflow CAN serve? A Pageflow visit is an XHR that
 *    swaps a page object into the current document. That is the wrong tool — or
 *    no tool at all — for a link that points off-site, names another browsing
 *    context, downloads a file, or speaks a scheme the browser owns. Before,
 *    every one of those was intercepted anyway:
 *
 *      <Link href="https://elsewhere.com">  fetched another origin over XHR
 *      <Link target="_blank">               preventDefault() ate the new tab
 *      <Link href="/f.pdf" download>        pulled the file into memory, no save
 *      <Link href="mailto:a@b.c">           swallowed; no mail client
 *
 *    An anchor already knows what to do with all four. So when the href says the
 *    browser owns this navigation, hand it back.
 *
 * The check applies only to real anchors: a non-GET Link renders a <button>,
 * which has no href to reason about and must always be intercepted.
 */
export default function shouldIntercept(
  event: Pick<
    MouseEvent,
    'altKey' | 'ctrlKey' | 'defaultPrevented' | 'target' | 'currentTarget' | 'metaKey' | 'shiftKey' | 'button'
  >,
): boolean {
  const element = event.currentTarget as HTMLElement | null
  const isLink = element?.tagName.toLowerCase() === 'a'

  const userAskedForTheBrowser =
    (event.target && (event?.target as HTMLElement).isContentEditable) ||
    event.defaultPrevented ||
    (isLink && event.altKey) ||
    (isLink && event.ctrlKey) ||
    (isLink && event.metaKey) ||
    (isLink && event.shiftKey) ||
    (isLink && 'button' in event && event.button !== 0)

  if (userAskedForTheBrowser) {
    return false
  }

  return !isLink || isInterceptableHref(element as HTMLAnchorElement)
}

/**
 * True when a Pageflow visit could actually render this href.
 *
 * Reads the href ATTRIBUTE rather than the resolved `.href` property, so a link
 * with no href at all is distinguishable from one pointing at the current page.
 * A link with no href has nothing for the browser to do either, so it keeps the
 * historical behaviour of being intercepted.
 */
function isInterceptableHref(anchor: HTMLAnchorElement): boolean {
  // The browser saves the file to disk. An XHR would pull it into memory and
  // then drop it on the floor.
  if (anchor.hasAttribute('download')) {
    return false
  }

  // _blank, a named frame, anything but this document — honouring the attribute
  // is the whole reason it was written.
  const target = anchor.getAttribute('target')
  if (target !== null && target !== '' && target !== '_self') {
    return false
  }

  const href = anchor.getAttribute('href')
  if (href === null) {
    return true
  }

  if (typeof window === 'undefined') {
    return true
  }

  let url: URL
  try {
    url = new URL(href, window.location.href)
  } catch {
    // Not a URL the browser can resolve; leave it alone rather than guess.
    return false
  }

  // mailto:, tel:, sms:, blob:, data:, javascript: — the browser owns these and
  // there is no page for Pageflow to swap in.
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return false
  }

  // Another origin cannot answer with a Pageflow page, and asking it to over
  // XHR leaks the request to a third party.
  return url.origin === window.location.origin
}
