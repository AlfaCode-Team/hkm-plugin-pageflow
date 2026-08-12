import { useCallback, useEffect, useState } from "react";
import { router } from "@pageflow/react";

export interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  reload: () => void;
}

/**
 * Fetch data that is NOT part of the initial page payload.
 *
 * In a Pageflow app most data arrives as page props, so reach for this only when
 * it genuinely cannot: search-as-you-type, a lazily opened panel, a polled
 * widget. For forms use `useForm`; for page props use `usePage`.
 *
 * It performs a partial visit — `only: [...]` — so the server sends just those
 * props rather than re-rendering the page.
 *
 * ```ts
 * const { data, loading } = useApi<Row[]>("/admin/search", ["results"]);
 * ```
 */
export function useApi<T>(path: string, only: string[] = []): UseApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  const onlyKey = only.join(",");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    router.visit(path, {
      method: "get",
      only,
      preserveState: true,
      preserveScroll: true,
      onSuccess: (page) => {
        if (cancelled) return;
        const key = only[0] as keyof typeof page.props;
        setData((key ? page.props[key] : page.props) as T);
      },
      onError: (errors) => {
        if (cancelled) return;
        const messages = Object.values(errors ?? {}).flat().filter(Boolean);
        setError(new Error(messages.join(" ") || "Request failed"));
      },
      onFinish: () => {
        if (!cancelled) setLoading(false);
      },
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, onlyKey, tick]);

  return { data, loading, error, reload };
}

export default useApi;
