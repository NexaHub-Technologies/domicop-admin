import { useState } from "react"
import {
  columnFilteringFeature,
  createFilteredRowModel,
  filterFn_includesString,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  createPaginatedRowModel,
  createSortedRowModel,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { TableSkeleton } from "@/components/ui/table-skeleton"
import { Button } from "@/components/ui/button"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ArrowUpDownIcon,
} from "@hugeicons/core-free-icons"

/**
 * Features this app's tables use, registered once.
 *
 * v9 requires features to be declared explicitly rather than inferred from
 * which `getXRowModel` you passed — registering `rowSortingFeature` is what
 * creates the sorting state and APIs at all. Row-model slots sit inside the
 * same call, after the feature that needs them.
 */
export const dataTableFeatures = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  // v9 does not bundle the comparators — a column resolving `sortFn: 'auto'`
  // to an unregistered function silently falls back to a basic comparator, so
  // clicking a header appears to do nothing. Register what the app's columns
  // actually need: text and member numbers, amounts, and dates.
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    text: sortFn_text,
    basic: sortFn_basic,
    datetime: sortFn_datetime,
  },
  // globalFilteringFeature builds on columnFilteringFeature — v9 says so in
  // the type error rather than failing at runtime.
  columnFilteringFeature,
  globalFilteringFeature,
  filteredRowModel: createFilteredRowModel(),
  filterFns: { includesString: filterFn_includesString },
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
})

/**
 * The app's one table.
 *
 * TanStack Table is headless: it owns sorting, filtering and pagination as
 * state and renders nothing. The markup stays shadcn's `Table`, so the pages
 * look as they did — what goes away is the hand-rolled `useMemo` filter, the
 * `slice()` pagination and the page arithmetic each page had its own slightly
 * different copy of.
 *
 * Pages that page on the SERVER (members, loans, contributions) leave
 * `pageSize` unset and keep their own controls; this then only renders, sorts
 * and filters the page it was handed. Mixing the two would paginate a page.
 */
export function DataTable<T extends { id: string }>({
  columns,
  data,
  loading,
  error,
  globalFilter,
  emptyMessage = "No results found",
  pageSize,
  rowClassName,
  onRowClick,
  skeletonWidths,
}: {
  // `columns` must be built with the module's column helper and memoised by the
  // caller — a fresh array each render re-creates the table.
  columns: any[]
  data: T[]
  loading?: boolean
  error?: string | null
  globalFilter?: string
  emptyMessage?: string
  pageSize?: number
  rowClassName?: (row: T) => string
  onRowClick?: (row: T) => void
  skeletonWidths?: string[]
}) {
  const [sorting, setSorting] = useState<any>([])

  // Sorting and the global filter are controlled here; pagination is left to
  // the table, so it is read back through the selector — v9 has no getState().
  const table = useTable(
    {
      features: dataTableFeatures,
      columns,
      data,
      state: { sorting, globalFilter: globalFilter ?? "" },
      onSortingChange: setSorting,
      getRowId: (row: T) => row.id,
      ...(pageSize ? { initialState: { pagination: { pageSize } } } : {}),
    } as any,
    (state: any) => ({ pagination: state.pagination })
  )

  const rows = table.getRowModel().rows

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((group: any) => (
              <TableRow
                key={group.id}
                className="bg-slate-50/50 hover:bg-slate-50/50 dark:bg-slate-800/50 dark:hover:bg-slate-800/50"
              >
                {group.headers.map((header: any) => {
                  const canSort = header.column.getCanSort?.()
                  const sorted = header.column.getIsSorted?.()
                  return (
                    <TableHead key={header.id} className="whitespace-nowrap">
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler?.()}
                          className="inline-flex items-center gap-1 hover:text-[#003d9a] dark:hover:text-[#b2c5ff]"
                        >
                          <table.FlexRender header={header} />
                          <HugeiconsIcon
                            icon={ArrowUpDownIcon}
                            className={`h-3 w-3 ${
                              sorted
                                ? "text-[#003d9a] dark:text-[#b2c5ff]"
                                : "opacity-40"
                            }`}
                          />
                        </button>
                      ) : (
                        <table.FlexRender header={header} />
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableSkeleton
                rows={8}
                cols={columns.length}
                widths={skeletonWidths}
              />
            ) : error ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="py-8 text-center text-red-500"
                >
                  {error}
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="py-8 text-center text-slate-500"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row: any) => (
                <TableRow
                  key={row.id}
                  onClick={
                    onRowClick ? () => onRowClick(row.original) : undefined
                  }
                  className={`transition-all hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                    onRowClick ? "cursor-pointer" : ""
                  } ${rowClassName?.(row.original) ?? ""}`}
                >
                  {row.getAllCells().map((cell: any) => (
                    <TableCell key={cell.id}>
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Client-side pager, only when this table owns its pagination. */}
      {pageSize && !loading && rows.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Page {(table.state as any).pagination.pageIndex + 1} of{" "}
            {table.getPageCount()} · {table.getFilteredRowModel().rows.length}{" "}
            results
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="text-xs sm:text-sm"
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} className="mr-1 h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="text-xs sm:text-sm"
            >
              Next
              <HugeiconsIcon icon={ArrowRight01Icon} className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
