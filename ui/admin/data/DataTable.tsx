import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  MoreHorizontal,
  Pencil,
  Search,
  Trash2,
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@ui/table";
import { Input } from "@ui/input";
import { Button } from "@ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@ui/alert-dialog";
import { cn } from "@lib/utils";

export interface Column<T> {
  key: keyof T | string;
  header: string;
  sortable?: boolean;
  filterable?: boolean;
  filterOptions?: { label: string; value: string }[];
  render?: (item: T) => ReactNode;
  className?: string;
}

export interface FetchDataParams {
  /** Zero-based page index. */
  start: number;
  length: number;
  search: string;
  filters: { key: string; value: string }[];
  sortKey: string | null;
  sortDirection: "asc" | "desc" | null;
}

export interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  /**
   * Stable row identity. Defaults to `item.id`.
   *
   * HKM 0.3 constrained this component to `T extends { $id: string }` — a
   * storage-layer artefact of that codebase. Baking it into the foundation would
   * have forced every Sentinel plugin to name its primary key `$id`.
   */
  getId?: (item: T) => string;

  onView?: (item: T) => void;
  onEdit?: (item: T) => void;
  onDelete?: (item: T) => void;
  /** Extra dropdown entries, rendered between Edit and Delete. */
  customActions?: (item: T) => ReactNode;
  onRowClick?: (item: T) => void;

  searchPlaceholder?: string;
  /** Fields the client-side search looks at. Ignored when `serverSide`. */
  searchKey?: keyof T | (keyof T)[] | string;
  pageSize?: number;
  emptyMessage?: string;

  /** Delegate search/sort/filter/pagination to the server via `onFetchData`. */
  serverSide?: boolean;
  totalRecords?: number;
  loading?: boolean;
  onFetchData?: (params: FetchDataParams) => void;

  /** Let the parent own pagination. */
  disablePagination?: boolean;

  deleteTitle?: string;
  deleteDescription?: string;
}

type SortDirection = "asc" | "desc" | null;

/**
 * A sortable, filterable, paginated table that works in two modes.
 *
 * Client-side (default) filters and paginates `data` in memory. Server-side
 * (`serverSide`) reports every parameter change through `onFetchData` — with the
 * search input debounced — and renders `data` exactly as given.
 */
export function DataTable<T>({
  data,
  columns,
  getId = (item) => String((item as { id?: unknown }).id ?? ""),
  onView,
  onEdit,
  onDelete,
  customActions,
  onRowClick,
  searchPlaceholder = "Search…",
  searchKey,
  pageSize = 10,
  emptyMessage = "No data found.",
  serverSide = false,
  totalRecords,
  loading = false,
  onFetchData,
  disablePagination = false,
  deleteTitle = "Are you sure?",
  deleteDescription = "This cannot be undone. The item will be permanently deleted.",
}: DataTableProps<T>) {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteItem, setDeleteItem] = useState<T | null>(null);

  useEffect(() => {
    if (!serverSide) {
      setDebouncedSearch(searchQuery);
      return;
    }
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery, serverSide]);

  const filterKey = JSON.stringify(filters);

  useEffect(() => {
    if (!serverSide || !onFetchData) return;

    const filterArray = Object.entries(filters)
      .filter(([, value]) => value && value !== "all")
      .map(([key, value]) => ({ key, value }));

    if (debouncedSearch) filterArray.unshift({ key: "search", value: debouncedSearch });

    onFetchData({
      start: currentPage - 1,
      length: pageSize,
      search: debouncedSearch,
      filters: filterArray,
      sortKey,
      sortDirection,
    });
    // `onFetchData` is an inline arrow at most call sites; depending on it would
    // refetch on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverSide, currentPage, pageSize, debouncedSearch, filterKey, sortKey, sortDirection]);

  const searchKeys = useMemo((): (keyof T)[] => {
    if (!searchKey) return [];
    if (Array.isArray(searchKey)) return searchKey;
    if (typeof searchKey === "string" && searchKey.includes(",")) {
      return searchKey.split(",").map((k) => k.trim() as keyof T);
    }
    return [searchKey as keyof T];
  }, [searchKey]);

  const filteredData = useMemo(() => {
    if (serverSide) return data;

    let result = [...data];

    if (searchQuery && searchKeys.length > 0) {
      const query = searchQuery.toLowerCase();
      result = result.filter((item) =>
        searchKeys.some((key) => {
          const value = item[key];
          if (Array.isArray(value)) {
            return value.some((v) => String(v).toLowerCase().includes(query));
          }
          return String(value ?? "").toLowerCase().includes(query);
        }),
      );
    }

    for (const [key, value] of Object.entries(filters)) {
      if (value && value !== "all") {
        result = result.filter((item) => String(item[key as keyof T]) === value);
      }
    }

    if (sortKey && sortDirection) {
      const dir = sortDirection === "asc" ? 1 : -1;
      result.sort((a, b) => {
        const av = a[sortKey as keyof T];
        const bv = b[sortKey as keyof T];
        if (typeof av === "string" && typeof bv === "string") return av.localeCompare(bv) * dir;
        if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
        return 0;
      });
    }

    return result;
  }, [data, searchQuery, searchKeys, filters, sortKey, sortDirection, serverSide]);

  const totalItems = serverSide ? (totalRecords ?? data.length) : filteredData.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const rows = serverSide
    ? data
    : disablePagination
      ? filteredData
      : filteredData.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDirection === "asc") setSortDirection("desc");
      else {
        setSortKey(null);
        setSortDirection(null);
      }
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
    setCurrentPage(1);
  };

  const handleFilterChange = useCallback((key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  }, []);

  const sortIcon = (key: string) => {
    if (sortKey !== key) return <ArrowUpDown className="ml-1 h-4 w-4" aria-hidden="true" />;
    return sortDirection === "asc" ? (
      <ArrowUp className="ml-1 h-4 w-4" aria-hidden="true" />
    ) : (
      <ArrowDown className="ml-1 h-4 w-4" aria-hidden="true" />
    );
  };

  const hasActions = Boolean(onView || onEdit || onDelete || customActions);
  const filterColumns = columns.filter((col) => col.filterable && col.filterOptions);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row">
        {(searchKeys.length > 0 || serverSide) && (
          <div className="relative max-w-sm flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="search"
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-9"
            />
          </div>
        )}

        {filterColumns.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {filterColumns.map((col) => (
              <Select
                key={String(col.key)}
                value={filters[String(col.key)] || "all"}
                onValueChange={(value) => handleFilterChange(String(col.key), value)}
              >
                <SelectTrigger className="w-[150px]" aria-label={`Filter by ${col.header}`}>
                  <SelectValue placeholder={`Filter ${col.header}`} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All {col.header}</SelectItem>
                  {col.filterOptions!.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2" aria-live="polite">
        <p className="text-sm text-muted-foreground">
          Showing {rows.length} of {totalItems} result{totalItems === 1 ? "" : "s"}
        </p>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      <div className="relative rounded-md border">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50">
            <Loader2 className="h-8 w-8 animate-spin" aria-label="Loading" />
          </div>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead
                  key={String(column.key)}
                  aria-sort={
                    sortKey === String(column.key)
                      ? sortDirection === "asc"
                        ? "ascending"
                        : "descending"
                      : undefined
                  }
                  className={cn(column.className, column.sortable && "cursor-pointer select-none")}
                  onClick={() => column.sortable && handleSort(String(column.key))}
                >
                  <div className="flex items-center">
                    {column.header}
                    {column.sortable && sortIcon(String(column.key))}
                  </div>
                </TableHead>
              ))}
              {hasActions && <TableHead className="w-[80px]">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + (hasActions ? 1 : 0)}
                  className="h-24 text-center text-muted-foreground"
                >
                  {loading ? "Loading…" : emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((item, index) => {
                const id = getId(item) || String(index);
                return (
                  <TableRow
                    key={id}
                    onClick={onRowClick ? () => onRowClick(item) : undefined}
                    className={onRowClick ? "cursor-pointer" : undefined}
                  >
                    {columns.map((column) => (
                      <TableCell key={String(column.key)} className={column.className}>
                        {column.render
                          ? column.render(item)
                          : String(item[column.key as keyof T] ?? "")}
                      </TableCell>
                    ))}
                    {hasActions && (
                      // Stop row-click firing when the menu is used.
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              aria-label="Row actions"
                            >
                              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {onView && (
                              <DropdownMenuItem onClick={() => onView(item)}>
                                <Eye className="mr-2 h-4 w-4" aria-hidden="true" />
                                View
                              </DropdownMenuItem>
                            )}
                            {onEdit && (
                              <DropdownMenuItem onClick={() => onEdit(item)}>
                                <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
                                Edit
                              </DropdownMenuItem>
                            )}
                            {customActions?.(item)}
                            {onDelete && (
                              <DropdownMenuItem
                                onClick={() => setDeleteItem(item)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                                Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {!disablePagination && totalPages > 1 && (
        <nav aria-label="Pagination" className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1 || loading}
            >
              <ChevronLeft className="mr-1 h-4 w-4" aria-hidden="true" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages || loading}
            >
              Next
              <ChevronRight className="ml-1 h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </nav>
      )}

      <AlertDialog open={!!deleteItem} onOpenChange={(open) => !open && setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>{deleteDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteItem && onDelete) onDelete(deleteItem);
                setDeleteItem(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
