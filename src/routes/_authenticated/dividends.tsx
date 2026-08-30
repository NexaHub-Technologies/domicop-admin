import { createFileRoute } from "@tanstack/react-router"
import { useState, useMemo } from "react"
import { dividendsApi } from "../../lib/api/dividends"
import { useDividends } from "../../lib/queries"
import { useQueryClient } from "@tanstack/react-query"
import { createColumnHelper } from "@tanstack/react-table"
import { DataTable, dataTableFeatures } from "../../components/data-table"
import { ApiError } from "../../lib/http"
import type {
  Dividend,
  PreviewDividendResponse,
} from "../../lib/types/dividends"
import { formatNaira } from "../../lib/money"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  CalculatorIcon,
  CheckmarkCircle02Icon,
  CancelSquareIcon,
} from "@hugeicons/core-free-icons"

export const Route = createFileRoute("/_authenticated/dividends")({
  component: DividendsPage,
})

const statusStyles: Record<string, string> = {
  pending: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400",
  processing:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  success:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
}

const helper = createColumnHelper<typeof dataTableFeatures, Dividend>()

function useDividendColumns() {
  return useMemo(
    () =>
      helper.columns([
        helper.accessor((d) => d.profiles.full_name, {
          id: "member",
          header: "Member",
          cell: ({ row }) => (
            <div>
              <p className="text-sm font-bold text-[#191c1e] dark:text-white">
                {row.original.profiles.full_name}
              </p>
              <p className="text-xs text-slate-500">
                {row.original.profiles.member_no}
              </p>
            </div>
          ),
        }),
        helper.accessor("amount", {
          header: "Amount",
          cell: ({ getValue }) => (
            <span className="font-bold text-[#191c1e] dark:text-white">
              {formatNaira(Number(getValue()))}
            </span>
          ),
        }),
        helper.accessor("status", {
          header: "Status",
          cell: ({ getValue }) => (
            <div className="text-right">
              <Badge
                variant="outline"
                className={`text-[10px] font-black uppercase ${statusStyles[getValue() as string] ?? ""}`}
              >
                {getValue()}
              </Badge>
            </div>
          ),
        }),
      ]),
    []
  )
}

function DividendsPage() {
  const [year, setYear] = useState(new Date().getFullYear())

  const [poolAmount, setPoolAmount] = useState<number>(0)
  const [preview, setPreview] = useState<PreviewDividendResponse | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [distributing, setDistributing] = useState(false)
  const [toast, setToast] = useState<{
    message: string
    type: "success" | "error"
  } | null>(null)

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 5000)
  }

  const columns = useDividendColumns()
  const dividendsQuery = useDividends(year)
  const dividends = dividendsQuery.data?.data ?? []
  const loading = dividendsQuery.isPending
  const error = dividendsQuery.error
    ? dividendsQuery.error instanceof Error
      ? dividendsQuery.error.message
      : "Failed to load dividends"
    : null
  const queryClient = useQueryClient()
  // Distribution writes many rows at once, so it refetches rather than
  // guessing — there is nothing predictable to patch optimistically.
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["dividends"] })

  const handlePreview = async () => {
    if (poolAmount <= 0) return
    setPreviewing(true)
    setPreview(null)
    try {
      const res = await dividendsApi.preview({ year, total_amount: poolAmount })
      setPreview(res)
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "Failed to compute preview",
        "error"
      )
    } finally {
      setPreviewing(false)
    }
  }

  const handleDistribute = async () => {
    if (!preview) return
    setDistributing(true)
    try {
      const res = await dividendsApi.distribute({
        year,
        dividends: preview.preview.map((p) => ({
          member_id: p.member_id,
          amount: p.dividend_amount,
        })),
      })
      const processing = res.results.filter(
        (r) => r.status === "processing"
      ).length
      const failed = res.results.filter((r) => r.status === "failed").length
      showToast(
        `Distribution started: ${processing} processing, ${failed} failed.`,
        failed > 0 ? "error" : "success"
      )
      setPreview(null)
      setPoolAmount(0)
      refresh()
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "Failed to distribute",
        "error"
      )
    } finally {
      setDistributing(false)
    }
  }

  const years = Array.from(
    { length: 5 },
    (_, i) => new Date().getFullYear() - i
  )

  return (
    <div className="space-y-6 sm:space-y-8">
      {toast && (
        <div
          className={`fixed right-4 bottom-4 z-50 flex max-w-sm items-center gap-2 rounded-lg px-4 py-3 shadow-lg ${
            toast.type === "success"
              ? "bg-green-600 text-white"
              : "bg-red-600 text-white"
          }`}
        >
          {toast.type === "success" ? (
            <HugeiconsIcon
              icon={CheckmarkCircle02Icon}
              className="h-5 w-5 shrink-0"
            />
          ) : (
            <HugeiconsIcon
              icon={CancelSquareIcon}
              className="h-5 w-5 shrink-0"
            />
          )}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="mb-2 block text-xs font-bold tracking-[0.2em] text-[#003d9a] uppercase dark:text-[#b2c5ff]">
            Distributions
          </span>
          <h2 className="text-2xl font-extrabold tracking-tight text-[#191c1e] sm:text-3xl dark:text-white">
            Dividends
          </h2>
        </div>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="self-start rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Distribution engine */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <HugeiconsIcon
                icon={CalculatorIcon}
                className="h-5 w-5 text-[#1e55be] dark:text-[#b2c5ff]"
              />
              <CardTitle className="text-lg sm:text-xl">
                Distribution Engine
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Total Dividend Pool (₦, naira)
              </label>
              <input
                type="number"
                value={poolAmount || ""}
                onChange={(e) => setPoolAmount(Number(e.target.value))}
                min={0}
                placeholder="100000"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-bold dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <Button
              onClick={handlePreview}
              disabled={previewing || poolAmount <= 0}
              className="w-full bg-gradient-to-br from-[#1e55be] to-[#003d9a] disabled:opacity-50"
            >
              <HugeiconsIcon icon={CalculatorIcon} className="mr-2 h-4 w-4" />
              {previewing ? "Calculating…" : "Preview Distribution"}
            </Button>

            {preview && (
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/50">
                  <span className="text-slate-500">
                    {preview.total_members} members ·{" "}
                    {formatNaira(preview.total_amount)} pool
                  </span>
                  <span className="text-xs text-slate-400">
                    total contrib{" "}
                    {formatNaira(preview.grand_total_contributions)}
                  </span>
                </div>
                <div className="max-h-64 space-y-2 overflow-y-auto">
                  {preview.preview.map((p) => (
                    <div
                      key={p.member_id}
                      className="flex items-center justify-between rounded-lg bg-slate-50 p-2.5 dark:bg-slate-800/50"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[#191c1e] dark:text-white">
                          {p.full_name}
                        </p>
                        <p className="text-xs text-slate-400">
                          {p.member_no} · contrib{" "}
                          {formatNaira(p.contribution_amount)}
                        </p>
                      </div>
                      <p className="text-sm font-bold text-green-600">
                        {formatNaira(p.dividend_amount)}
                      </p>
                    </div>
                  ))}
                </div>
                <Button
                  onClick={handleDistribute}
                  disabled={distributing}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50"
                >
                  {distributing
                    ? "Distributing…"
                    : `Distribute to ${preview.total_members} members`}
                </Button>
                <p className="text-center text-xs text-slate-400">
                  Distribution is not transactional — each transfer is confirmed
                  asynchronously via the Paystack webhook.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dividends history */}
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">
              Dividends — {year}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <DataTable
                columns={columns}
                data={dividends}
                loading={loading}
                error={error}
                emptyMessage={`No dividends recorded for ${year}.`}
                skeletonWidths={["h-8 w-40", "h-4 w-24", "h-5 w-20"]}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
