import { Skeleton } from "@/components/ui/skeleton"
import { TableCell, TableRow } from "@/components/ui/table"

/**
 * Placeholder rows shaped like the real ones.
 *
 * Tables previously collapsed to a single centred "Loading…" cell, so the page
 * visibly jumped when data arrived — the table grew from one row to twenty and
 * everything below it moved. Rendering the right number of rows at roughly the
 * right widths keeps the layout still.
 *
 * `widths` lets a caller mirror its own column rhythm; anything not specified
 * falls back to a sensible default so most tables need only `cols`.
 */
export function TableSkeleton({
  rows = 6,
  cols,
  widths,
}: {
  rows?: number
  cols: number
  widths?: string[]
}) {
  return (
    <>
      {Array.from({ length: rows }, (_, r) => (
        <TableRow key={r} className="border-slate-100 dark:border-slate-800">
          {Array.from({ length: cols }, (_, c) => (
            <TableCell key={c} className="py-3">
              <Skeleton className={widths?.[c] ?? "h-4 w-24"} />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}

/**
 * Placeholder for a card/list surface, where a table skeleton would be wrong.
 * `lines` is the number of stacked bars inside each card.
 */
export function CardSkeleton({
  cards = 3,
  lines = 2,
}: {
  cards?: number
  lines?: number
}) {
  return (
    <div className="space-y-3">
      {Array.from({ length: cards }, (_, i) => (
        <div
          key={i}
          className="rounded-xl border border-slate-100 p-4 dark:border-slate-800"
        >
          <Skeleton className="mb-3 h-4 w-1/3" />
          {Array.from({ length: lines }, (_, l) => (
            <Skeleton
              key={l}
              className={`mb-2 h-3 ${l === lines - 1 ? "w-1/2" : "w-full"}`}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
