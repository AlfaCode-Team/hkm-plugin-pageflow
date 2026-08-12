export type TableFilter = {
  id: string;
  value: string | number | boolean | (string | number)[];
};

export type TableSort = {
  id: string;
  desc: boolean;
};

export type TableQueryState = {
  /** 1-based page number. */
  start: number;
  length: number;
  filters: TableFilter[];
  sorting: TableSort[];
};

/**
 * Server-side table query state, as a plain object you can hand straight to a
 * Pageflow visit.
 *
 * Every mutator returns a NEW instance rather than mutating in place, so it is
 * safe to hold in React state — the 0.3 version mutated internally, which meant
 * `setQuery(q.setPage(2))` handed React the same object reference and no
 * re-render happened.
 */
export class TableQuery {
  private readonly state: TableQueryState;

  constructor(initial?: Partial<TableQueryState>) {
    this.state = {
      start: Math.max(1, initial?.start ?? 1),
      length: Math.max(1, initial?.length ?? 20),
      filters: Array.isArray(initial?.filters) ? [...initial.filters] : [],
      sorting: Array.isArray(initial?.sorting) ? [...initial.sorting] : [],
    };
  }

  static from(initial?: Partial<TableQueryState>): TableQuery {
    return new TableQuery(initial);
  }

  private with(patch: Partial<TableQueryState>): TableQuery {
    return new TableQuery({ ...this.state, ...patch });
  }

  getState(): TableQueryState {
    return {
      ...this.state,
      filters: [...this.state.filters],
      sorting: [...this.state.sorting],
    };
  }

  // ── Pagination ──────────────────────────────────────────────────────────────

  get page(): number {
    return this.state.start;
  }

  get pageSize(): number {
    return this.state.length;
  }

  setPage(page: number): TableQuery {
    return this.with({ start: Math.max(1, page) });
  }

  /** Resets to page 1 — a different page size makes the old offset meaningless. */
  setPageSize(length: number): TableQuery {
    return this.with({ length: Math.max(1, length), start: 1 });
  }

  nextPage(): TableQuery {
    return this.setPage(this.state.start + 1);
  }

  previousPage(): TableQuery {
    return this.setPage(this.state.start - 1);
  }

  /** Zero-based row offset, for a `LIMIT ? OFFSET ?` backend. */
  get offset(): number {
    return (this.state.start - 1) * this.state.length;
  }

  // ── Filtering ───────────────────────────────────────────────────────────────

  getFilter(id: string): TableFilter | undefined {
    return this.state.filters.find((f) => f.id === id);
  }

  /** Set or replace a filter. An empty value removes it. Resets to page 1. */
  setFilter(id: string, value: TableFilter["value"] | null | undefined): TableQuery {
    const rest = this.state.filters.filter((f) => f.id !== id);
    const isEmpty =
      value === null ||
      value === undefined ||
      value === "" ||
      (Array.isArray(value) && value.length === 0);

    return this.with({ filters: isEmpty ? rest : [...rest, { id, value }], start: 1 });
  }

  clearFilters(): TableQuery {
    return this.with({ filters: [], start: 1 });
  }

  // ── Sorting ─────────────────────────────────────────────────────────────────

  getSort(id: string): TableSort | undefined {
    return this.state.sorting.find((s) => s.id === id);
  }

  /**
   * Cycle one column: unsorted → ascending → descending → unsorted.
   * Single-column by default; pass `multi` to append instead of replace.
   */
  toggleSort(id: string, multi = false): TableQuery {
    const existing = this.getSort(id);
    const others = multi ? this.state.sorting.filter((s) => s.id !== id) : [];

    if (!existing) return this.with({ sorting: [...others, { id, desc: false }], start: 1 });
    if (!existing.desc) return this.with({ sorting: [...others, { id, desc: true }], start: 1 });
    return this.with({ sorting: others, start: 1 });
  }

  clearSorting(): TableQuery {
    return this.with({ sorting: [] });
  }

  // ── Serialisation ───────────────────────────────────────────────────────────

  /** Flat params for a Pageflow visit / query string. */
  toParams(): Record<string, string | number> {
    const params: Record<string, string | number> = {
      page: this.state.start,
      per_page: this.state.length,
    };

    for (const filter of this.state.filters) {
      params[`filter[${filter.id}]`] = Array.isArray(filter.value)
        ? filter.value.join(",")
        : String(filter.value);
    }

    if (this.state.sorting.length > 0) {
      params.sort = this.state.sorting
        .map((s) => (s.desc ? `-${s.id}` : s.id))
        .join(",");
    }

    return params;
  }
}
