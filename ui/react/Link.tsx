import {
  CacheForOption,
  FormDataConvertible,
  LinkPrefetchOption,
  mergeDataIntoQueryString,
  Method,
  PendingVisit,
  PreserveStateOption,
  Progress,
  router,
  shouldIntercept,
} from '@pageflow/core'
import { createElement, ElementType, forwardRef, useEffect, useMemo, useRef, useState } from 'react'

const noop = () => undefined

interface BasePageflowLinkProps {
  as?: ElementType
  data?: Record<string, FormDataConvertible>
  href: string | { url: string; method: Method }
  method?: Method
  headers?: Record<string, string>
  onClick?: (event: React.MouseEvent<Element>) => void
  preserveScroll?: PreserveStateOption
  preserveState?: PreserveStateOption
  replace?: boolean
  only?: string[]
  except?: string[]
  onCancelToken?: (cancelToken: import('axios').CancelTokenSource) => void
  onBefore?: () => void
  onStart?: (event: PendingVisit) => void
  onProgress?: (progress: Progress) => void
  onFinish?: (event: PendingVisit) => void
  onCancel?: () => void
  onSuccess?: () => void
  onError?: () => void
  queryStringArrayFormat?: 'indices' | 'brackets'
  async?: boolean
  cacheFor?: CacheForOption | CacheForOption[]
  prefetch?: boolean | LinkPrefetchOption | LinkPrefetchOption[]
  /**
   * Leave this link to the browser: render a plain anchor and let the click
   * cause a real, full page load instead of a Pageflow visit.
   *
   * `shouldIntercept` already hands back the links where an anchor is the ONLY
   * correct behaviour (off-site, `target`, `download`, non-http schemes). This
   * prop is for the other case — a same-origin page you want loaded fresh, with
   * a new document, a new bundle boot and no carried-over client state.
   *
   * A full page load is a GET by definition, so `method` is meaningless here and
   * the browser will GET `href` whatever it says. Prefetching is skipped too:
   * there is nothing to prefetch into.
   */
  hard?: boolean
}

export type PageflowLinkProps = BasePageflowLinkProps &
  Omit<React.HTMLAttributes<HTMLElement>, keyof BasePageflowLinkProps> &
  Omit<React.AllHTMLAttributes<HTMLElement>, keyof BasePageflowLinkProps>

const Link = forwardRef<unknown, PageflowLinkProps>(
  (
    {
      children,
      as = 'a',
      data = {},
      href,
      method = 'get',
      preserveScroll = false,
      preserveState = null,
      replace = false,
      only = [],
      except = [],
      headers = {},
      queryStringArrayFormat = 'brackets',
      async = false,
      onClick = noop,
      onCancelToken = noop,
      onBefore = noop,
      onStart = noop,
      onProgress = noop,
      onFinish = noop,
      onCancel = noop,
      onSuccess = noop,
      onError = noop,
      prefetch = false,
      cacheFor = 0,
      hard = false,
      ...props
    },
    ref,
  ) => {
    const [inFlightCount, setInFlightCount] = useState(0)
    const hoverTimeout = useRef<number>(null)

    const _method = useMemo(() => {
      return typeof href === 'object' ? href.method : (method.toLowerCase() as Method)
    }, [href, method])

    const _as = useMemo(() => {
      if (typeof as !== 'string') {
        // Custom component
        return as
      }

      // A hard link IS a browser navigation, and only an anchor performs one.
      // A <button> would render with nothing to click through to.
      if (hard) {
        return 'a'
      }

      return _method !== 'get' ? 'button' : as.toLowerCase()
    }, [as, _method, hard])

    const mergeDataArray = useMemo(
      () =>
        mergeDataIntoQueryString(
          _method,
          typeof href === 'object' ? href.url : href || '',
          data,
          queryStringArrayFormat,
        ),
      [href, _method, data, queryStringArrayFormat],
    )

    const url = useMemo(() => mergeDataArray[0], [mergeDataArray])
    const _data = useMemo(() => mergeDataArray[1], [mergeDataArray])

    const baseParams = useMemo(
      () => ({
        data: _data,
        method: _method,
        preserveScroll,
        preserveState: preserveState ?? _method !== 'get',
        replace,
        only,
        except,
        headers,
        async,
      }),
      [_data, _method, preserveScroll, preserveState, replace, only, except, headers, async],
    )

    const visitParams = useMemo(
      () => ({
        ...baseParams,
        onCancelToken,
        onBefore,
        onStart(event) {
          setInFlightCount((count) => count + 1)
          onStart(event)
        },
        onProgress,
        onFinish(event) {
          setInFlightCount((count) => count - 1)
          onFinish(event)
        },
        onCancel,
        onSuccess,
        onError,
      }),
      [baseParams, onCancelToken, onBefore, onStart, onProgress, onFinish, onCancel, onSuccess, onError],
    )

    const doPrefetch = () => {
      router.prefetch(url, baseParams, { cacheFor: cacheForValue })
    }

    const prefetchModes: LinkPrefetchOption[] = useMemo(
      () => {
        // The document is going away on click; a prefetched page object would be
        // thrown out with it.
        if (hard) {
          return []
        }

        if (prefetch === true) {
          return ['hover']
        }

        if (prefetch === false) {
          return []
        }

        if (Array.isArray(prefetch)) {
          return prefetch
        }

        return [prefetch]
      },
      // `hard` joins the deps: it short-circuits the body, so a memo keyed only
      // on `prefetch` would keep serving the pre-`hard` modes.
      Array.isArray(prefetch) ? [...prefetch, hard] : [prefetch, hard],
    )

    const cacheForValue = useMemo(() => {
      if (cacheFor !== 0) {
        // If they've provided a value, respect it
        return cacheFor
      }

      if (prefetchModes.length === 1 && prefetchModes[0] === 'click') {
        // If they've only provided a prefetch mode of 'click',
        // we should only prefetch for the next request but not keep it around
        return 0
      }

      // Otherwise, default to 30 seconds
      return 30_000
    }, [cacheFor, prefetchModes])

    useEffect(() => {
      return () => {
        clearTimeout(hoverTimeout.current)
      }
    }, [])

    useEffect(() => {
      if (prefetchModes.includes('mount')) {
        setTimeout(() => doPrefetch())
      }
    }, prefetchModes)

    const regularEvents = {
      onClick: (event) => {
        onClick(event)

        // Deliberately no preventDefault: the anchor navigates, exactly as it
        // would if Pageflow were not on the page at all.
        if (hard) {
          return
        }

        if (shouldIntercept(event)) {
          event.preventDefault()

          router.visit(url, visitParams)
        }
      },
    }

    const prefetchHoverEvents = {
      onMouseEnter: () => {
        hoverTimeout.current = window.setTimeout(() => {
          doPrefetch()
        }, 75)
      },
      onMouseLeave: () => {
        clearTimeout(hoverTimeout.current)
      },
      onClick: regularEvents.onClick,
    }

    const prefetchClickEvents = {
      onMouseDown: (event) => {
        if (shouldIntercept(event)) {
          event.preventDefault()
          doPrefetch()
        }
      },
      onMouseUp: (event) => {
        // Guarded like its mousedown/click siblings. Unconditional, this handler
        // took the navigation no matter what the other two had decided: a
        // prefetch="click" link that shouldIntercept had just handed back — an
        // off-site href, a target, a download — was hijacked here anyway, and a
        // middle click both visited in place AND opened the new tab.
        if (!shouldIntercept(event)) {
          return
        }

        event.preventDefault()
        router.visit(url, visitParams)
      },
      onClick: (event) => {
        onClick(event)

        if (shouldIntercept(event)) {
          // Let the mouseup event handle the visit
          event.preventDefault()
        }
      },
    }

    const elProps = useMemo(() => {
      if (_as === 'button') {
        return { type: 'button' }
      }

      if (_as === 'a' || typeof _as !== 'string') {
        return { href: url }
      }

      return {}
    }, [_as, url])

    return createElement(
      _as,
      {
        ...props,
        ...elProps,
        ref,
        ...(() => {
          if (prefetchModes.includes('hover')) {
            return prefetchHoverEvents
          }

          if (prefetchModes.includes('click')) {
            return prefetchClickEvents
          }

          return regularEvents
        })(),
        'data-loading': inFlightCount > 0 ? '' : undefined,
      },
      children,
    )
  },
)
Link.displayName = 'PageflowLink'

export default Link
