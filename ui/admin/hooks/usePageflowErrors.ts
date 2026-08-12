import { useEffect, useRef } from "react";
import { router } from "@pageflow/core";
import { toast } from "sonner";

export interface PageflowErrorOptions {
  /**
   * Toast VALIDATION errors too. Default **false** — see the note below.
   *
   * Turn it on for a surface whose mutations go through bare `router.post`
   * calls rather than `useForm`/`<Form>`, where nothing else renders them.
   */
  validationToasts?: boolean;
  /** Replace the default toast. Receives the flattened messages. */
  onError?: (messages: string[], errors: Record<string, string | string[]>) => void;
  /** Toast title for validation errors. */
  title?: string;
  /** Surface transport-level failures (network down, 5xx). Default true. */
  reportExceptions?: boolean;
}

/**
 * Surface Pageflow visit failures, without double-reporting.
 *
 * **Why validation errors are silent by default.** A 422 travels two paths at
 * once: `core/http/response.ts` calls `fireErrorEvent(scopedErrors)` AND the
 * visit's own `onError`, which is what `useForm`/`<Form>` use to populate
 * `form.errors` and render a message under each field. A global listener that
 * also toasted would fire on every failed form submission in the application —
 * the message the user is already reading, repeated in the corner. Inline, next
 * to the input that is wrong, is the better place for it, so this hook stays out
 * of the way and only reports what nothing else will.
 *
 * **Exceptions are reported.** A network failure or a 5xx has no field to attach
 * itself to and no form state to land in, so without a toast it is completely
 * silent.
 *
 * **Stale errors are dropped.** A user who clicks twice can receive the first
 * visit's errors after the second has started — an error about a page they have
 * left. The router's `error` event carries no visit reference, so this
 * correlates by sequence: it records how many visits had begun when the error
 * arrived and drops it if a newer one started in the meantime.
 *
 * Mounted once by `AdminLayout`/`AuthLayout`; a page never calls it.
 */
export function usePageflowErrors(options: PageflowErrorOptions = {}): void {
  // Read through a ref so an inline options object does not resubscribe the
  // router listeners on every render.
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    let started = 0;

    const offStart = router.on("start", () => {
      started += 1;
    });

    const offError = router.on("error", (event) => {
      const { validationToasts = false, onError } = optionsRef.current;
      if (!validationToasts && !onError) return;

      const seenAt = started;

      // Defer one macrotask: if another visit starts in this tick, the error
      // belongs to a page the user has already left.
      setTimeout(() => {
        if (started !== seenAt) return;

        const errors = (event.detail?.errors ?? {}) as Record<string, string | string[]>;
        const messages = Object.values(errors)
          .flat()
          .filter((m): m is string => typeof m === "string" && m.length > 0);

        if (messages.length === 0) return;

        if (onError) {
          onError(messages, errors);
          return;
        }

        toast.error(optionsRef.current.title ?? "Could not complete that", {
          description:
            messages.length === 1
              ? messages[0]
              : `${messages[0]} (+${messages.length - 1} more)`,
        });
      }, 0);
    });

    const offException = router.on("exception", (event) => {
      if (optionsRef.current.reportExceptions === false) return;

      const message =
        event.detail?.exception instanceof Error
          ? event.detail.exception.message
          : "The server could not be reached.";

      toast.error("Request failed", { description: message });
    });

    return () => {
      offStart();
      offError();
      offException();
    };
  }, []);
}

export default usePageflowErrors;
