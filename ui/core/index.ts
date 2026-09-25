import { Router } from './router'

export { configureCsrf, csrfToken, csrfHeaderName, csrfFormField, setCsrfToken, isSameOriginUrl, type CsrfConfig } from './csrf'
export { installCsrfAutoRefresh, refreshCsrfToken, type CsrfAutoRefreshOptions } from './csrfRetry'
export { hardSubmit } from './hardSubmit'
export {
  configureErrorModal,
  describeErrorResponse,
  type ErrorModalConfig,
  type ErrorModalMount,
  type PageflowErrorResponse,
} from './modal'
export { default as createHeadManager } from './head'
export { precognitiveValidate, normalizeErrors, type Errors } from './precognition'
export {
  registerPageflowSW,
  clearPageflowSWCache,
  type ServiceWorkerOptions,
} from './serviceWorker'
export {
  openReactiveStream,
  supportsReactive,
  parseKeys,
  type ReactiveOptions,
  type ReactiveFrame,
} from './reactive'
export { hide as hideProgress, reveal as revealProgress, default as setupProgress } from './progress'
export { default as shouldIntercept } from './shouldIntercept'
export * from './types'
export { hrefToUrl, mergeDataIntoQueryString, urlWithoutHash } from './url'
export { type Router }

export const router = new Router()

export const _Pageflow_ = router