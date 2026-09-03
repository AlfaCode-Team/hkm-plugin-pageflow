import { router as Router } from '@pageflow/core'


export const router = Router
export { configureCsrf, csrfToken, csrfHeaderName, setCsrfToken, type CsrfConfig } from '@pageflow/core'
export { installCsrfAutoRefresh, type CsrfAutoRefreshOptions } from '@pageflow/core'
export { precognitiveValidate, normalizeErrors, type Errors } from '@pageflow/core'
export { registerPageflowSW, clearPageflowSWCache, type ServiceWorkerOptions } from '@pageflow/core'
export { default as usePrecognition } from './usePrecognition'
export type { PrecognitionHelpers, UsePrecognitionOptions } from './usePrecognition'
export { default as AppErrorBoundary } from './AppErrorBoundary'
export { default as Can } from './Can'
export type { CanProps } from './Can'
export { default as createPageflowApp } from './createPageflowApp'
export { default as Deferred } from './Deferred'
export { default as Form } from './Form'
export type { PageflowFormProps as PageflowFormComponentProps, FormRenderProps } from './Form'
export { default as Head } from './Head'
export { default as useAuth } from './useAuth'
export type { AuthHelpers, PageflowAuth } from './useAuth'
export { default as useDirtyGuard } from './useDirtyGuard'
export type { DirtyGuardOptions } from './useDirtyGuard'
export { default as useFlushOnIdentityChange } from './useFlushOnIdentityChange'
export { default as useReactiveProps } from './useReactiveProps'
export type { UseReactivePropsOptions } from './useReactiveProps'
export type { PageflowLinkProps } from './Link'
export type { PageflowFormProps } from './useForm'
export type { SetDataByObject } from './useForm'
export type { SetDataByMethod } from './useForm'
export type { SetDataByKeyValuePair } from './useForm'
export type { SetDataAction } from './useForm'
export { default as Link } from './Link'
export { default as useForm } from './useForm'
export { default as usePage } from './usePage'
/**
 * The page context itself, so a page can be rendered OUTSIDE a running app.
 *
 * `usePage()` throws "must be used within the Pageflow component" when the
 * context is empty, and the only thing that supplied it was <App>, which needs
 * a router, a history and a live document. That made every Pageflow page
 * untestable as a component: the one thing a component test must do — render it
 * with props — is exactly what the hook refuses.
 *
 * Provide it with the page object the server sends, which is what <App> passes
 * (`current.page`), and what a ground fixture dumps verbatim:
 *
 *   import { PageContext } from '@pageflow/react'
 *   import fixture from '../__fixtures__/user-index.json'
 *
 *   render(
 *     <PageContext.Provider value={fixture}>
 *       <Page />
 *     </PageContext.Provider>,
 *   )
 */
export { default as PageContext } from './PageContext'
export { default as usePoll } from './usePoll'
export { default as usePrefetch } from './usePrefetch'
export { default as useRemember } from './useRemember'
export { default as WhenVisible } from './WhenVisible'
