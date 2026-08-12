import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

/**
 * Client-side list state for a resource page: search, status filter, pagination
 * and row CRUD.
 *
 * In HKM 0.3 six product pages each re-implemented this inline, and each carried
 * the same two defects — a page strip that always rendered 1…7 regardless of the
 * current page, and deletes that read the items array from the enclosing render
 * (`setItems(items.filter(…))`) inside an async callback, so a delete landing
 * after any other mutation resurrected the stale list. Both are fixed here once.
 *
 * Rows are held locally because these endpoints return the mutated row rather
 * than re-rendering the page. `addItem`/`updateItem`/`removeItem` are functional
 * updates, which is what makes them safe to call from a response handler.
 */
export interface ResourceListOptions<T> {
  /** Initial rows, normally straight off the page props. */
  initial: T[];
  /** Stable identity for a row. Defaults to `item.id`. */
  getId?: (item: T) => string;
  /** Fields the toolbar input searches. */
  searchFields: (item: T) => (string | undefined | null)[];
  /** Field the status chips filter on. Omit for a list with no chips. */
  getStatus?: (item: T) => string;
  /** Rows per page. Default 10. */
  pageSize?: number;
  /**
   * Adopt a new `initial` when the server sends one. Default **true**.
   *
   * This matters more than it looks. `router.post/put/patch` all default to
   * `preserveState: true`, and `resourceRequest` sets it explicitly — which
   * means the page component is NOT remounted after a mutation, so a plain
   * `useState(initial)` would keep serving the rows captured on first mount
   * while `props.rows` moved on. A `router.reload({ only: ['rows'] })` would
   * appear to do nothing.
   *
   * Set `false` only when the page deliberately owns the list locally and must
   * not have optimistic edits overwritten by a partial reload.
   */
  syncOnPropChange?: boolean;
}

export interface ResourceList<T> {
  items: T[];
  filtered: T[];
  paginated: T[];

  search: string;
  setSearch: (value: string) => void;

  status: string;
  setStatus: (value: string) => void;

  page: number;
  setPage: (page: number) => void;
  totalPages: number;

  /** `all` plus one entry per distinct status value. */
  counts: Record<string, number>;

  addItem: (item: T) => void;
  updateItem: (id: string, item: T) => void;
  removeItem: (id: string) => void;
  setItems: Dispatch<SetStateAction<T[]>>;
}

export function useResourceList<T>({
  initial,
  getId = (item) => String((item as { id?: unknown }).id ?? ""),
  searchFields,
  getStatus,
  pageSize = 10,
  syncOnPropChange = true,
}: ResourceListOptions<T>): ResourceList<T> {
  const [items, setItems] = useState<T[]>(initial ?? []);
  const [search, setSearchRaw] = useState("");
  const [status, setStatusRaw] = useState("all");
  const [page, setPage] = useState(1);

  // Adopt server-sent rows without an effect. React's documented "adjusting
  // state when props change" pattern: set during render, guarded by the last
  // value seen, so the component re-renders immediately with the new list
  // instead of painting the stale one first and correcting it a frame later.
  const lastInitialRef = useRef(initial);
  if (syncOnPropChange && initial !== lastInitialRef.current) {
    lastInitialRef.current = initial;
    setItems(initial ?? []);
  }

  // Narrowing the result set while on a later page would otherwise strand the
  // user on an empty page.
  const setSearch = useCallback((value: string) => {
    setSearchRaw(value);
    setPage(1);
  }, []);

  const setStatus = useCallback((value: string) => {
    setStatusRaw(value);
    setPage(1);
  }, []);

  const filtered = useMemo(() => {
    let list = items;

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((item) =>
        searchFields(item).some((field) => field?.toLowerCase().includes(q)),
      );
    }
    if (getStatus && status !== "all") {
      list = list.filter((item) => getStatus(item) === status);
    }
    return list;
    // `searchFields`/`getStatus` are inline arrows at every call site; depending
    // on them would recompute every render for no gain.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, search, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);

  const paginated = useMemo(
    () => filtered.slice((safePage - 1) * pageSize, safePage * pageSize),
    [filtered, safePage, pageSize],
  );

  const counts = useMemo(() => {
    const acc: Record<string, number> = { all: items.length };
    if (getStatus) {
      for (const item of items) {
        const key = getStatus(item);
        acc[key] = (acc[key] ?? 0) + 1;
      }
    }
    return acc;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const addItem = useCallback((item: T) => {
    setItems((prev) => [item, ...prev]);
    setPage(1);
  }, []);

  const updateItem = useCallback(
    (id: string, item: T) =>
      setItems((prev) => prev.map((row) => (getId(row) === id ? item : row))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const removeItem = useCallback(
    (id: string) => setItems((prev) => prev.filter((row) => getId(row) !== id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return {
    items,
    filtered,
    paginated,
    search,
    setSearch,
    status,
    setStatus,
    page: safePage,
    setPage,
    totalPages,
    counts,
    addItem,
    updateItem,
    removeItem,
    setItems,
  };
}
