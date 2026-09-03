import { router } from "@pageflow/react";
import type { RequestPayload } from "@pageflow/core";
import { toast } from "sonner";

/**
 * One mutation against an AJAX endpoint, with the outcome reported honestly.
 *
 * HKM 0.3 had a version of this because its endpoints answered
 * `{ isXError: true, errorMessage }` with an HTTP **200**, so a failed mutation
 * arrived through `onSuccess` and every call site had to remember to check a
 * per-endpoint boolean flag. Sentinel does not do that: `Response::json()`
 * error helpers return a real status code and the envelope
 * `{ error: { code, message, requestId, fields? } }`.
 *
 * So this wrapper is much smaller, and handles the two shapes a Sentinel
 * endpoint can legitimately answer with:
 *
 *   1. a **Pageflow page** whose `errors` prop is populated → `onError`
 *      (what a controller returning `Response::unprocessable([...])` through
 *      the Pageflow responder produces);
 *   2. a Pageflow page carrying the reserved `error` prop — the envelope above
 *      passed through as a prop rather than as a status.
 *
 * Anything else (network failure, 5xx, a non-Pageflow body) surfaces as a
 * transport failure. The point is that no call site has to know which.
 */
export interface ResourceRequestOptions<T> {
  url: string;
  method?: "post" | "put" | "patch" | "delete";
  /** Body. `RequestPayload` so a `FormData` upload works here too. */
  data?: RequestPayload;
  /**
   * Props to request back alongside the outcome. Keep it small — this is a
   * partial reload, and its whole value is not re-rendering the page.
   *
   * NOTE: `error` is always requested and is treated as RESERVED. A page that
   * uses `error` as an ordinary prop name will have it read as a failure
   * envelope; name it something else.
   */
  only?: string[];
  /** Prop holding the mutated row, when the endpoint returns one. */
  resultKey?: string;
  /** Toast shown on success. Omit to stay silent. */
  successMessage?: string;
  /** Toast title used for any failure. */
  failureMessage: string;
  onOk?: (result: T | undefined) => void;
  /** Field-level errors, for putting messages next to inputs. */
  onInvalid?: (errors: Record<string, string | string[]>) => void;
  /** Runs on every outcome — use it to clear a saving flag. */
  onSettled?: () => void;
  /** Suppress the toasts and report through the callbacks only. */
  silent?: boolean;
}

interface SentinelErrorProp {
  code?: string;
  message?: string;
  requestId?: string;
  fields?: Record<string, string | string[]>;
}

export function resourceRequest<T = unknown>({
  url,
  method = "post",
  data,
  only = [],
  resultKey,
  successMessage,
  failureMessage,
  onOk,
  onInvalid,
  onSettled,
  silent = false,
}: ResourceRequestOptions<T>): void {
  const wanted = [...(resultKey ? [resultKey] : []), "error", ...only];

  router.visit(url, {
    method,
    data,
    only: wanted,
    preserveScroll: true,
    preserveState: true,
    replace: false,

    onSuccess: (page) => {
      const envelope = page?.props?.error as SentinelErrorProp | undefined;

      // Shape 2: the endpoint answered 200 with the error envelope as a prop.
      if (envelope?.message || envelope?.code) {
        if (!silent) {
          toast.error(failureMessage, { description: envelope.message ?? envelope.code });
        }
        if (envelope.fields) onInvalid?.(envelope.fields);
        return;
      }

      if (successMessage && !silent) toast.success(successMessage);
      onOk?.(resultKey ? (page?.props?.[resultKey] as T | undefined) : undefined);
    },

    // Shape 1: validation errors in the page's `errors` bag.
    onError: (errors) => {
      const bag = (errors ?? {}) as Record<string, string | string[]>;
      const first = Object.values(bag).flat().find(Boolean);

      if (!silent) {
        toast.error(failureMessage, { description: typeof first === "string" ? first : undefined });
      }
      onInvalid?.(bag);
    },

    onFinish: () => onSettled?.(),
  });
}

/**
 * Copy to the clipboard, telling the truth about whether it worked.
 *
 * `navigator.clipboard` is undefined on insecure origins and its promise rejects
 * when the document is not focused. The call sites this replaces fired a success
 * toast unconditionally and let the rejection go unhandled.
 */
export async function copyToClipboard(
  text: string,
  label = "Copied to clipboard",
): Promise<boolean> {
  try {
    if (!navigator.clipboard) throw new Error("Clipboard unavailable");
    await navigator.clipboard.writeText(text);
    toast.success(label);
    return true;
  } catch {
    toast.error("Could not copy", {
      description: "Your browser blocked clipboard access — copy it manually.",
    });
    return false;
  }
}
