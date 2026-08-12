import { useCallback, useEffect, useRef, useState } from "react";

export type SaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

export interface DebouncedAutosaveOptions<T> {
  /** The value to watch. */
  value: T;
  /** Persist it. Resolve on success, throw/reject on failure. */
  save: (value: T) => Promise<void> | void;
  /** Debounce before saving, in ms. Default 1200. */
  delay?: number;
  /** Pause autosave (e.g. while the form is still loading). Default true. */
  enabled?: boolean;
  /** Equality check. Default `Object.is` — pass a deep compare for object state. */
  isEqual?: (a: T, b: T) => boolean;
}

export interface DebouncedAutosave {
  status: SaveStatus;
  lastSavedAt: Date | null;
  /** Save immediately if dirty — call before navigating away or on ⌘S. */
  flush: () => Promise<void>;
}

/**
 * Debounced autosave for form state.
 *
 * Skips the first run, so mounting a form never immediately persists it. Cancels
 * a pending save on unmount and refuses to overlap saves, so a fast typist
 * cannot have two writes racing for the same record.
 */
export function useDebouncedAutosave<T>({
  value,
  save,
  delay = 1200,
  enabled = true,
  isEqual,
}: DebouncedAutosaveOptions<T>): DebouncedAutosave {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedValueRef = useRef<T>(value);
  const firstRunRef = useRef(true);
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);

  // The latest value/save, so the timer callback never fires against a stale closure.
  const valueRef = useRef(value);
  valueRef.current = value;
  const saveRef = useRef(save);
  saveRef.current = save;

  const equals = isEqual ?? Object.is;

  const performSave = useCallback(async () => {
    if (inFlightRef.current) return;
    const snapshot = valueRef.current;

    inFlightRef.current = true;
    setStatus("saving");
    try {
      await saveRef.current(snapshot);
      lastSavedValueRef.current = snapshot;
      if (mountedRef.current) {
        setStatus("saved");
        setLastSavedAt(new Date());
      }
    } catch {
      if (mountedRef.current) setStatus("error");
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (firstRunRef.current) {
      firstRunRef.current = false;
      lastSavedValueRef.current = value;
      return;
    }
    if (!enabled) return;
    if (equals(value, lastSavedValueRef.current)) return;

    setStatus("pending");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void performSave(), delay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, enabled, delay]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const flush = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!equals(valueRef.current, lastSavedValueRef.current)) await performSave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [performSave]);

  return { status, lastSavedAt, flush };
}

export default useDebouncedAutosave;
