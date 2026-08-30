import { createFileRoute } from "@tanstack/react-router"
import { useState, useMemo, useEffect } from "react"
import {
  useLoans,
  useLoanDetail,
  useProcessLoan,
  useSignLoan,
  useDisburseLoan,
} from "../../lib/queries"
import { createColumnHelper } from "@tanstack/react-table"
import { DataTable, dataTableFeatures } from "../../components/data-table"
import { ApiError } from "../../lib/http"
import type {
  Loan,
  ProcessLoanInput,
  SignLoanInput,
  OfficerRole,
} from "../../lib/types/loans"
import {
  MIN_TENURE_MONTHS,
  MAX_TENURE_MONTHS,
  loanMemberName,
  loanMemberNo,
} from "../../lib/types/loans"
import { formatNaira } from "../../lib/money"
import { useAuth } from "../../providers/auth-provider"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CardSkeleton } from "@/components/ui/table-skeleton"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  BankIcon,
  MoneySend01Icon,
  Task01Icon,
  CheckmarkCircle02Icon,
  CancelSquareIcon,
  ArrowRight01Icon,
  ArrowLeft01Icon,
} from "@hugeicons/core-free-icons"

export const Route = createFileRoute("/_authenticated/loans")({
  component: LoansPage,
})

type StatusFilter =
  | "all"
  | "pending"
  | "under_review"
  | "approved"
  | "disbursed"
  | "repaying"
  | "closed"
  | "rejected"
  | "disbursement_failed"

const PAGE_SIZE = 25

const statusStyles: Record<string, string> = {
  approved:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  disbursed:
    "bg-[#1e55be]/10 text-[#1e55be] dark:bg-[#b2c5ff]/20 dark:text-[#b2c5ff]",
  pending:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  under_review:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  repaying:
    "bg-[#1e55be]/10 text-[#1e55be] dark:bg-[#b2c5ff]/20 dark:text-[#b2c5ff]",
  closed: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400",
  // A disbursement that failed is the one state an admin has to act on, so it
  // reads as loudly as a rejection rather than falling through unstyled.
  disbursement_failed:
    "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
}

const helper = createColumnHelper<typeof dataTableFeatures, Loan>()

function useLoanColumns(
  onReview: (l: Loan) => void,
  onReject: (id: string) => void,
  onDisburse: (id: string) => void,
  busyId: string | null | undefined
) {
  return useMemo(
    () =>
      helper.columns([
        helper.accessor((l) => loanMemberName(l), {
          id: "member",
          header: "Member",
          cell: ({ row }) => (
            <div>
              <p className="text-sm font-bold text-[#191c1e] dark:text-white">
                {loanMemberName(row.original)}
              </p>
              <p className="text-xs text-slate-500 capitalize dark:text-slate-400">
                {loanMemberNo(row.original)} · {row.original.type}
              </p>
            </div>
          ),
        }),
        helper.accessor((l) => l.amount_approved ?? l.amount_requested, {
          id: "amount",
          header: "Amount",
          cell: ({ row }) => {
            const l = row.original
            return (
              <div className="text-sm font-medium text-[#191c1e] dark:text-white">
                {formatNaira(l.amount_approved ?? l.amount_requested)}
                {l.amount_approved != null &&
                  l.amount_approved !== l.amount_requested && (
                    <span className="block text-xs text-slate-400">
                      req {formatNaira(l.amount_requested)}
                    </span>
                  )}
              </div>
            )
          },
        }),
        helper.accessor("purpose", {
          header: "Purpose",
          cell: ({ getValue }) => (
            <span className="block max-w-[200px] truncate text-sm text-slate-600 dark:text-slate-400">
              {getValue()}
            </span>
          ),
        }),
        helper.accessor("tenure_months", {
          header: "Term",
          cell: ({ getValue }) => (
            <span className="text-sm text-slate-600 dark:text-slate-400">
              {getValue() ?? "—"} mo
            </span>
          ),
        }),
        helper.accessor("status", {
          header: "Status",
          cell: ({ getValue }) => (
            <Badge
              variant="outline"
              className={`text-[10px] font-black uppercase ${statusStyles[getValue() as string] ?? ""}`}
            >
              {String(getValue()).replace("_", " ")}
            </Badge>
          ),
        }),
        helper.display({
          id: "actions",
          header: "",
          cell: ({ row }) => {
            const loan = row.original
            return (
              <div className="flex justify-end gap-1 sm:gap-2">
                {(loan.status === "pending" ||
                  loan.status === "under_review") && (
                  <>
                    <Button
                      size="sm"
                      onClick={() => onReview(loan)}
                      className="bg-[#003d9a] px-2 text-xs hover:bg-[#002d7a] sm:px-3"
                    >
                      Review
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => onReject(loan.id)}
                      className="px-2 text-xs sm:px-3"
                    >
                      Reject
                    </Button>
                  </>
                )}
                {loan.status === "approved" && (
                  <Button
                    size="sm"
                    onClick={() => onDisburse(loan.id)}
                    disabled={busyId === loan.id}
                    className="bg-green-600 px-2 text-xs hover:bg-green-700 sm:px-3"
                  >
                    {busyId === loan.id ? "Disbursing…" : "Disburse"}
                  </Button>
                )}
              </div>
            )
          },
        }),
      ]),
    [onReview, onReject, onDisburse, busyId]
  )
}

function LoansPage() {
  const { user } = useAuth()

  const [filter, setFilter] = useState<StatusFilter>("all")
  const [page, setPage] = useState(1)
  const [processing, setProcessing] = useState<Loan | null>(null)
  const [toast, setToast] = useState<{
    message: string
    type: "success" | "error"
  } | null>(null)

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  const loansQuery = useLoans(
    page,
    PAGE_SIZE,
    filter === "all" ? undefined : filter
  )
  const loans = loansQuery.data?.data ?? []
  const total = loansQuery.data?.total ?? null
  const loading = loansQuery.isPending
  const error = loansQuery.error
    ? loansQuery.error instanceof Error
      ? loansQuery.error.message
      : "Failed to load loans"
    : null

  // Query owns cache invalidation for each mutation (see lib/queries.ts), so
  // none of these handlers refetch by hand any more.
  const processLoan = useProcessLoan()
  const signLoan = useSignLoan()
  const disburseLoan = useDisburseLoan()
  const busyId = disburseLoan.isPending ? disburseLoan.variables : null

  useEffect(() => {
    setPage(1)
  }, [filter])

  const stats = useMemo(() => {
    // "Active" now includes repaying: a loan being repaid is outstanding money,
    // and leaving it out understated the total.
    const active = loans.filter(
      (l) =>
        l.status === "approved" ||
        l.status === "disbursed" ||
        l.status === "repaying"
    )
    const activeTotal = active.reduce(
      (sum, l) => sum + (l.amount_approved ?? l.amount_requested),
      0
    )
    const disbursedTotal = loans
      .filter((l) => l.status === "disbursed" || l.status === "repaying")
      .reduce((sum, l) => sum + (l.amount_approved ?? l.amount_requested), 0)
    const pending = loans.filter(
      (l) => l.status === "pending" || l.status === "under_review"
    ).length
    return { activeTotal, disbursedTotal, pending }
  }, [loans])

  const totalPages = total ? Math.ceil(total / PAGE_SIZE) : 1
  const columns = useLoanColumns(
    (l) => setProcessing(l),
    (id) => handleQuickProcess(id, "rejected"),
    (id) => handleDisburse(id),
    busyId
  )

  const handleSign = async (id: string, data: SignLoanInput) => {
    try {
      const res = await signLoan.mutateAsync({ id, data })
      showToast(
        res.awaiting
          ? `Signed. Awaiting the ${res.awaiting}'s signature.`
          : res.message,
        "success"
      )
      setProcessing(null)
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "Failed to sign",
        "error"
      )
    }
  }

  const handleProcess = async (id: string, data: ProcessLoanInput) => {
    try {
      await processLoan.mutateAsync({ id, data })
      showToast(`Loan ${data.status.replace("_", " ")}.`, "success")
      setProcessing(null)
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "Failed to process loan",
        "error"
      )
    }
  }

  const handleQuickProcess = async (
    id: string,
    status: ProcessLoanInput["status"]
  ) => {
    await handleProcess(id, { status })
  }

  const handleDisburse = async (id: string) => {
    try {
      const res = await disburseLoan.mutateAsync(id)
      if (res.status === "disbursed") {
        showToast("Loan disbursed successfully.", "success")
      } else if (res.status === "pending_otp") {
        showToast(res.message || "Awaiting OTP confirmation.", "success")
      } else {
        showToast(res.message || "Disbursement failed.", "error")
      }
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "Failed to disburse",
        "error"
      )
    }
  }

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
            Credit Management
          </span>
          <h2 className="text-2xl font-extrabold tracking-tight text-[#191c1e] sm:text-3xl dark:text-white">
            Loan Management
          </h2>
        </div>
      </div>

      {/* Hero Stats (current view) */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
        <StatCard
          icon={BankIcon}
          iconClass="text-[#1e55be] dark:text-[#b2c5ff]"
          label="Active Loans (page)"
          value={formatNaira(stats.activeTotal, true)}
        />
        <StatCard
          icon={MoneySend01Icon}
          iconClass="text-green-600"
          label="Disbursed (page)"
          value={formatNaira(stats.disbursedTotal, true)}
        />
        <StatCard
          icon={Task01Icon}
          iconClass="text-amber-600"
          label="Pending (page)"
          value={String(stats.pending)}
        />
      </section>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            "all",
            "pending",
            "under_review",
            "approved",
            "disbursed",
            "rejected",
          ] as StatusFilter[]
        ).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-all sm:text-sm ${
              filter === s
                ? "bg-[#003d9a] text-white"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            }`}
          >
            {s.replace("_", " ")}
          </button>
        ))}
      </div>

      {/* Loan Queue */}
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="text-lg sm:text-xl">
            Loan Approval Queue
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <DataTable
              columns={columns}
              data={loans}
              loading={loading}
              error={error}
              emptyMessage="No loans found"
              skeletonWidths={[
                "h-8 w-40",
                "h-4 w-24",
                "h-4 w-32",
                "h-4 w-12",
                "h-5 w-20",
                "h-8 w-28",
              ]}
            />
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Page {page}
          {total !== null ? ` of ${totalPages} · ${total} total` : ""}
        </p>
        <div className="flex gap-2">
          <Button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            variant="outline"
            size="sm"
            disabled={page === 1 || loading}
            className="text-xs sm:text-sm"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} className="mr-1 h-4 w-4" />
            Previous
          </Button>
          <Button
            onClick={() => setPage((p) => p + 1)}
            variant="outline"
            size="sm"
            disabled={page >= totalPages || loading}
            className="text-xs sm:text-sm"
          >
            Next
            <HugeiconsIcon icon={ArrowRight01Icon} className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>

      {processing && (
        <ReviewLoanModal
          loan={processing}
          officerRole={user?.officer_role ?? null}
          onClose={() => setProcessing(null)}
          onProcess={(data) => handleProcess(processing.id, data)}
          onSign={(data) => handleSign(processing.id, data)}
        />
      )}
    </div>
  )
}

function StatCard({
  icon,
  iconClass,
  label,
  value,
}: {
  icon: typeof BankIcon
  iconClass: string
  label: string
  value: string
}) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-4 sm:p-6">
        <HugeiconsIcon icon={icon} className={`mb-3 h-7 w-7 ${iconClass}`} />
        <p className="mb-1 text-xs font-medium text-slate-500 sm:text-sm dark:text-slate-400">
          {label}
        </p>
        <h3 className="text-2xl font-bold text-[#191c1e] sm:text-3xl dark:text-white">
          {value}
        </h3>
      </CardContent>
    </Card>
  )
}

/**
 * Review an application and sign for the cooperative.
 *
 * Approval is Part C of the paper form: the Secretary AND the President each
 * sign. This panel therefore shows the whole application — Part A details,
 * the three guarantors of Part B, and the repayment schedule — because an
 * officer is being asked to put their name to a sum of money, not to click
 * "approve" on a row in a table.
 *
 * The first officer to sign proposes the terms; the second countersigns
 * whatever is on record and cannot alter it, which is why the amount fields
 * become read-only once a signature exists.
 */
function ReviewLoanModal({
  loan,
  officerRole,
  onClose,
  onProcess,
  onSign,
}: {
  loan: Loan
  officerRole: OfficerRole | null
  onClose: () => void
  onProcess: (data: ProcessLoanInput) => Promise<void>
  onSign: (data: SignLoanInput) => Promise<void>
}) {
  const detailQuery = useLoanDetail(loan.id)
  const detail = detailQuery.data ?? null
  const loading = detailQuery.isPending
  const [adminNotes, setAdminNotes] = useState("")
  // One lock for the whole footer: approving, rejecting and sending back for
  // review are mutually exclusive decisions on the same loan, so while any is
  // in flight none of the others should be reachable either.
  const [submitting, setSubmitting] = useState<
    "sign" | "reject" | "review" | null
  >(null)

  const submit = async (
    kind: "sign" | "reject" | "review",
    action: () => Promise<void>
  ) => {
    if (submitting) return
    setSubmitting(kind)
    try {
      await action()
    } finally {
      setSubmitting(null)
    }
  }

  const approvals = (detail?.loan_approvals ?? []).filter(
    (a) => a.action === "approve"
  )
  const proposed = approvals[0] ?? null
  const signedRoles = new Set(approvals.map((a) => a.officer_role))
  const iHaveSigned = officerRole ? signedRoles.has(officerRole) : false
  const bothSigned =
    signedRoles.has("secretary") && signedRoles.has("president")

  // Terms are the first signatory's, once there is one.
  const [amountApproved, setAmountApproved] = useState<number>(
    loan.amount_approved ?? loan.amount_requested
  )
  const [interestRate, setInterestRate] = useState<number>(
    loan.interest_rate ?? 5
  )
  const [tenureMonths, setTenureMonths] = useState<number>(
    Math.min(loan.tenure_months ?? MAX_TENURE_MONTHS, MAX_TENURE_MONTHS)
  )

  useEffect(() => {
    if (!proposed) return
    setAmountApproved(Number(proposed.amount_approved))
    setInterestRate(Number(proposed.interest_rate))
    setTenureMonths(Number(proposed.tenure_months))
  }, [proposed])

  const tenureOutOfRange =
    tenureMonths < MIN_TENURE_MONTHS || tenureMonths > MAX_TENURE_MONTHS
  const termsLocked = !!proposed

  const sign = () => {
    if (tenureOutOfRange) return
    void submit("sign", () =>
      onSign(
        termsLocked
          ? { action: "approve" }
          : {
              action: "approve",
              amount_approved: amountApproved,
              interest_rate: interestRate,
              tenure_months: tenureMonths,
            }
      )
    )
  }

  const inputCls =
    "w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-white"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl dark:bg-[#0b1326]">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-[#191c1e] dark:text-white">
            Loan Application — {loanMemberName(loan)}
          </h3>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <HugeiconsIcon icon={CancelSquareIcon} className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          // The panel is tall; a centred line of text made it look empty and
          // broken while the application loaded.
          <div className="space-y-4 py-2">
            <CardSkeleton cards={3} lines={3} />
          </div>
        ) : (
          <div className="space-y-6">
            {/* --- Sign-off state, first: it governs everything below. --- */}
            <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
              <p className="mb-3 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                Part C — Officer sign-off
              </p>
              <div className="flex flex-wrap gap-4">
                {(["secretary", "president"] as OfficerRole[]).map((role) => {
                  const a = approvals.find((x) => x.officer_role === role)
                  return (
                    <div key={role} className="flex items-center gap-2">
                      <HugeiconsIcon
                        icon={a ? CheckmarkCircle02Icon : CancelSquareIcon}
                        className={`h-5 w-5 ${a ? "text-green-600" : "text-slate-300 dark:text-slate-600"}`}
                      />
                      <div>
                        <p className="text-sm font-semibold text-[#191c1e] capitalize dark:text-white">
                          {role}
                        </p>
                        <p className="text-xs text-slate-500">
                          {a
                            ? `${a.officer_name ?? "Signed"} · ${new Date(a.signed_at).toLocaleDateString()}`
                            : "Awaiting signature"}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
              {!officerRole && (
                <p className="mt-3 rounded bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                  You hold no cooperative office, so you cannot sign this loan.
                  A super admin can assign the Secretary or President role in
                  Settings.
                </p>
              )}
            </div>

            {/* --- Part A --- */}
            <Section title="Part A — Applicant">
              <Detail
                label="Requested"
                value={formatNaira(loan.amount_requested)}
              />
              <Detail label="In words" value={detail?.amount_in_words ?? "—"} />
              <Detail label="Purpose" value={loan.purpose} />
              <Detail
                label="Address"
                value={detail?.applicant_address ?? "—"}
              />
              <Detail label="Bank" value={detail?.applicant_bank_name ?? "—"} />
              <Detail
                label="Account"
                value={detail?.applicant_bank_account ?? "—"}
              />
              <Detail label="Phone" value={detail?.applicant_phone ?? "—"} />
            </Section>

            {/* --- Part B --- */}
            <Section
              title={`Part B — Guarantors (${detail?.loan_guarantors.length ?? 0}/3)`}
            >
              {(detail?.loan_guarantors ?? [])
                .slice()
                .sort((a, b) => a.position - b.position)
                .map((g) => (
                  <div
                    key={g.id}
                    className="col-span-2 rounded border border-slate-100 p-3 dark:border-slate-800"
                  >
                    <p className="text-sm font-bold text-[#191c1e] dark:text-white">
                      {g.position}. {g.full_name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {g.bank_name} · {g.bank_account} · {g.phone}
                    </p>
                    {g.signature_url ? (
                      <img
                        src={g.signature_url}
                        alt={`Signature of ${g.full_name}`}
                        className="mt-2 h-12 rounded border border-slate-200 bg-white p-1 dark:border-slate-700"
                      />
                    ) : (
                      <p className="mt-1 text-xs text-red-500">
                        No signature on file
                      </p>
                    )}
                  </div>
                ))}
              {(detail?.loan_guarantors.length ?? 0) < 3 && (
                <p className="col-span-2 text-xs text-red-500">
                  This application is short of the three guarantors the form
                  requires.
                </p>
              )}
            </Section>

            {/* --- Terms --- */}
            <Section
              title={
                termsLocked
                  ? "Terms (set by the first signatory)"
                  : "Terms to propose"
              }
            >
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">
                  Amount Approved (₦)
                </label>
                <input
                  type="number"
                  value={amountApproved}
                  onChange={(e) => setAmountApproved(Number(e.target.value))}
                  min={1}
                  disabled={termsLocked}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">
                  Interest Rate (%)
                </label>
                <input
                  type="number"
                  value={interestRate}
                  onChange={(e) => setInterestRate(Number(e.target.value))}
                  min={0}
                  max={100}
                  disabled={termsLocked}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">
                  Tenure (months)
                </label>
                <input
                  type="number"
                  value={tenureMonths}
                  onChange={(e) => setTenureMonths(Number(e.target.value))}
                  min={MIN_TENURE_MONTHS}
                  max={MAX_TENURE_MONTHS}
                  step={1}
                  disabled={termsLocked}
                  className={inputCls}
                />
                <p
                  className={`mt-1 text-xs ${tenureOutOfRange ? "text-red-500" : "text-slate-400"}`}
                >
                  {MIN_TENURE_MONTHS}–{MAX_TENURE_MONTHS} months · 1 month
                  grace, then {Math.max(tenureMonths - 1, 0)} installments
                </p>
              </div>
            </Section>

            {/* --- Schedule, once approved --- */}
            {(detail?.loan_installments.length ?? 0) > 0 && (
              <Section title="Part A item 8 — Repayment schedule">
                <div className="col-span-2 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="text-left text-slate-500">
                      <tr>
                        <th className="py-1">#</th>
                        <th className="py-1">Due</th>
                        <th className="py-1">Amount</th>
                        <th className="py-1">Paid</th>
                        <th className="py-1">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail!.loan_installments.map((i) => (
                        <tr
                          key={i.id}
                          className="border-t border-slate-100 dark:border-slate-800"
                        >
                          <td className="py-1">{i.installment_no}</td>
                          <td className="py-1">
                            {new Date(i.due_on).toLocaleDateString()}
                          </td>
                          <td className="py-1">
                            {formatNaira(Number(i.amount))}
                          </td>
                          <td className="py-1">
                            {formatNaira(Number(i.paid_amount))}
                          </td>
                          <td className="py-1 capitalize">{i.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>
            )}

            {detail?.bond_url && (
              <a
                href={detail.bond_url}
                target="_blank"
                rel="noreferrer"
                className="inline-block text-sm font-semibold text-[#003d9a] hover:underline dark:text-[#b2c5ff]"
              >
                Open the Loan Bond (PDF)
                {detail.bond_cancelled_at ? " — cancelled" : ""}
              </a>
            )}

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">
                Admin Notes
              </label>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                rows={2}
                className={inputCls}
              />
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
              <button
                type="button"
                disabled={!!submitting}
                onClick={() =>
                  void submit("review", () =>
                    onProcess({
                      status: "under_review",
                      admin_notes: adminNotes || undefined,
                    })
                  )
                }
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold disabled:opacity-50 dark:border-slate-700 dark:text-white"
              >
                {submitting === "review" ? "Saving…" : "Mark under review"}
              </button>
              <button
                type="button"
                disabled={!!submitting}
                onClick={() =>
                  void submit("reject", () =>
                    onProcess({
                      status: "rejected",
                      admin_notes: adminNotes || undefined,
                    })
                  )
                }
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {submitting === "reject" ? "Rejecting…" : "Reject"}
              </button>
              <button
                type="button"
                onClick={sign}
                disabled={
                  !!submitting ||
                  !officerRole ||
                  iHaveSigned ||
                  bothSigned ||
                  tenureOutOfRange
                }
                className="rounded-lg bg-gradient-to-br from-[#1e55be] to-[#003d9a] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {submitting === "sign"
                  ? "Signing…"
                  : bothSigned
                    ? "Approved"
                    : iHaveSigned
                      ? "You have signed"
                      : proposed
                        ? "Countersign & approve"
                        : "Sign & propose terms"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/** A titled two-column block inside the review panel. */
function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
      <p className="mb-3 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
        {title}
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
        {label}
      </p>
      <p className="text-sm text-[#191c1e] dark:text-white">{value}</p>
    </div>
  )
}
