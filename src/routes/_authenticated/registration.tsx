import { createFileRoute, Link } from "@tanstack/react-router"
import { useState, useMemo } from "react"
import {
  useRegistrationWindows,
  useRegistrationApplications,
  useCreateRegistrationWindow,
  useUpdateRegistrationWindow,
  useOpenRegistrationWindow,
  useCloseRegistrationWindow,
  useApproveMember,
} from "../../lib/queries"
import { ApiError } from "../../lib/http"
import { formatNaira } from "../../lib/money"
import type {
  RegistrationWindow,
  CreateRegistrationWindowInput,
} from "../../lib/types/registration"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CardSkeleton } from "@/components/ui/table-skeleton"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  UserAdd01Icon,
  CheckmarkCircle02Icon,
  CancelSquareIcon,
  PencilEdit01Icon,
} from "@hugeicons/core-free-icons"

export const Route = createFileRoute("/_authenticated/registration")({
  component: RegistrationPage,
})

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"

/**
 * Openness as applicants experience it.
 *
 * `state` is only the manual override — a window can be 'open' and still shut
 * because its period has not started, has ended, or it is full. This mirrors
 * getActiveWindow() on the server; the two must agree or admins will be told
 * the portal is live while applicants are turned away.
 */
type LiveStatus = "Draft" | "Open" | "Scheduled" | "Ended" | "Full" | "Closed"

function liveStatus(w: RegistrationWindow): LiveStatus {
  if (w.state === "closed") return "Closed"
  if (w.state === "draft") return "Draft"
  const now = Date.now()
  if (now < new Date(w.opens_at).getTime()) return "Scheduled"
  if (now > new Date(w.closes_at).getTime()) return "Ended"
  if (w.capacity !== null && w.applications_count >= w.capacity) return "Full"
  return "Open"
}

const STATUS_STYLES: Record<LiveStatus, string> = {
  Open: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  Scheduled: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  Draft: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
  Full: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  Ended: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  Closed: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400",
}

function StatusBadge({ status }: { status: LiveStatus }) {
  return (
    <Badge
      variant="outline"
      className={`text-[10px] font-black uppercase ${STATUS_STYLES[status]}`}
    >
      {status}
    </Badge>
  )
}

const dateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  })

/** `datetime-local` needs a naive local string, not the ISO-8601 the API returns. */
function toLocalInput(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function RegistrationPage() {
  const windowsQuery = useRegistrationWindows()
  const windows = windowsQuery.data ?? []
  const loading = windowsQuery.isPending
  // A 404 here means the API server does not have the registration routes —
  // typically a server that predates them. The raw "Route not found" reads as
  // a broken page, so say what it actually is.
  const rawError = windowsQuery.error as (Error & { status?: number }) | null
  const error = rawError
    ? rawError.status === 404
      ? "The registration endpoints are not available on the API server. It may need to be restarted or redeployed."
      : rawError.message
    : null

  const createWindow = useCreateRegistrationWindow()
  const updateWindow = useUpdateRegistrationWindow()
  const openWindowMutation = useOpenRegistrationWindow()
  const closeWindowMutation = useCloseRegistrationWindow()
  const windowAction = openWindowMutation.isPending
    ? ("open" as const)
    : closeWindowMutation.isPending
      ? ("close" as const)
      : null
  const [showForm, setShowForm] = useState(false)
  // is terminal — so the controls lock while the request is in flight rather
  // than sitting live for a second round trip.
  const [editing, setEditing] = useState<RegistrationWindow | null>(null)
  const [toast, setToast] = useState<{
    message: string
    type: "success" | "error"
  } | null>(null)

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  // The server's unique partial index guarantees at most one non-closed row,
  // so "current" is unambiguous rather than a best guess.
  const current = useMemo(
    () => windows.find((w) => w.state !== "closed") ?? null,
    [windows]
  )
  const past = useMemo(
    () => windows.filter((w) => w.state === "closed"),
    [windows]
  )

  const handleSubmit = (input: CreateRegistrationWindowInput) => {
    const done = (msg: string) => {
      showToast(msg, "success")
      setShowForm(false)
      setEditing(null)
    }
    const fail = (err: unknown) =>
      showToast(
        err instanceof ApiError ? err.message : "Failed to save",
        "error"
      )

    if (editing) {
      updateWindow.mutate(
        { id: editing.id, data: input },
        { onSuccess: () => done("Registration window updated."), onError: fail }
      )
    } else {
      createWindow.mutate(input, {
        onSuccess: () =>
          done("Draft window created. Open it when you're ready."),
        onError: fail,
      })
    }
  }

  const handleOpen = (id: string) =>
    openWindowMutation.mutate(id, {
      onSuccess: () =>
        showToast("Registration is now open to applicants.", "success"),
      onError: (err) =>
        showToast(
          err instanceof ApiError ? err.message : "Failed to open",
          "error"
        ),
    })

  const handleClose = (w: RegistrationWindow) => {
    // Closing is terminal on the server. Say so before it happens, not after.
    const ok = window.confirm(
      `Close "${w.name}"? A closed intake cannot be reopened — you would need to create a new one.`
    )
    if (!ok) return
    closeWindowMutation.mutate(w.id, {
      onSuccess: () => showToast("Registration closed.", "success"),
      onError: (err) =>
        showToast(
          err instanceof ApiError ? err.message : "Failed to close",
          "error"
        ),
    })
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

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="mb-2 block text-xs font-bold tracking-[0.2em] text-[#003d9a] uppercase dark:text-[#b2c5ff]">
            Membership
          </span>
          <h2 className="text-2xl font-extrabold tracking-tight text-[#191c1e] sm:text-3xl dark:text-white">
            Registration Portal
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
            New members can only apply while an intake is open. Applicants pay
            the registration and social fees up front and land as pending until
            approved.
          </p>
        </div>
        {!current && (
          <Button
            onClick={() => {
              setEditing(null)
              setShowForm(true)
            }}
            className="bg-gradient-to-br from-[#1e55be] to-[#003d9a] text-white"
          >
            <HugeiconsIcon icon={UserAdd01Icon} className="mr-2 h-4 w-4" />
            New Intake
          </Button>
        )}
      </div>

      {loading ? (
        <CardSkeleton cards={2} lines={3} />
      ) : error ? (
        <p className="py-8 text-center text-red-500">{error}</p>
      ) : (
        <>
          {current ? (
            <CurrentWindowCard
              window={current}
              busy={windowAction}
              onOpen={() => handleOpen(current.id)}
              onClose={() => handleClose(current)}
              onEdit={() => {
                setEditing(current)
                setShowForm(true)
              }}
            />
          ) : (
            <Card>
              <CardContent className="p-6 text-center sm:p-10">
                <p className="font-semibold text-[#191c1e] dark:text-white">
                  No intake scheduled
                </p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  The portal is closed to new members. Create an intake to
                  reopen it.
                </p>
              </CardContent>
            </Card>
          )}

          {current && (
            <ApplicantsTable windowId={current.id} showToast={showToast} />
          )}

          {past.length > 0 && <PastWindowsTable windows={past} />}
        </>
      )}

      {showForm && (
        <WindowFormModal
          window={editing ?? undefined}
          onClose={() => {
            setShowForm(false)
            setEditing(null)
          }}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  )
}

function CurrentWindowCard({
  window: w,
  busy,
  onOpen,
  onClose,
  onEdit,
}: {
  window: RegistrationWindow
  busy: "open" | "close" | null
  onOpen: () => void
  onClose: () => void
  onEdit: () => void
}) {
  const status = liveStatus(w)
  const total = Number(w.registration_fee) + Number(w.social_fee)

  return (
    <Card>
      <CardContent className="space-y-5 p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <h3 className="font-bold text-[#191c1e] dark:text-white">
                {w.name}
              </h3>
              <StatusBadge status={status} />
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {dateTime(w.opens_at)} — {dateTime(w.closes_at)}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              onClick={onEdit}
              className="p-2 text-slate-400 hover:text-[#003d9a] dark:hover:text-[#b2c5ff]"
              title="Edit intake"
            >
              <HugeiconsIcon icon={PencilEdit01Icon} className="h-5 w-5" />
            </button>
            {w.state !== "open" && (
              <Button
                size="sm"
                onClick={onOpen}
                disabled={!!busy}
                className="text-xs"
              >
                {busy === "open" ? "Opening…" : "Open registration"}
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={onClose}
              disabled={!!busy}
              className="text-xs"
            >
              {busy === "close" ? "Closing…" : "Close registration"}
            </Button>
          </div>
        </div>

        {status === "Scheduled" && (
          <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
            Opened, but applicants cannot apply until {dateTime(w.opens_at)}.
          </p>
        )}
        {status === "Ended" && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
            The period ended on {dateTime(w.closes_at)}. Extend the closing date
            or close this intake.
          </p>
        )}
        {status === "Full" && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
            Capacity reached. Raise the cap to accept more applicants.
          </p>
        )}

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat
            label="Applications"
            value={
              w.capacity === null
                ? String(w.applications_count)
                : `${w.applications_count} / ${w.capacity}`
            }
          />
          <Stat
            label="Registration fee"
            value={formatNaira(Number(w.registration_fee), true)}
          />
          <Stat
            label="Social fee"
            value={formatNaira(Number(w.social_fee), true)}
          />
          <Stat label="Total due" value={formatNaira(total, true)} />
        </div>

        <p className="text-xs text-slate-400">
          Monthly subscription range:{" "}
          {formatNaira(Number(w.min_monthly_subscription), true)} —{" "}
          {formatNaira(Number(w.max_monthly_subscription), true)}
        </p>
      </CardContent>
    </Card>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
        {label}
      </p>
      <p className="mt-1 font-bold text-[#191c1e] dark:text-white">{value}</p>
    </div>
  )
}

function ApplicantsTable({
  windowId,
  showToast,
}: {
  windowId: string
  showToast: (m: string, t: "success" | "error") => void
}) {
  const applicationsQuery = useRegistrationApplications(windowId)
  const rows = applicationsQuery.data ?? []
  const loading = applicationsQuery.isPending
  const approveMember = useApproveMember()
  const approving = approveMember.isPending ? approveMember.variables : null

  // Approving invalidates the members keys AND the pending queue, so the row
  // leaves this list without a hand-rolled refetch.
  const handleApprove = (id: string) =>
    approveMember.mutate(id, {
      onSuccess: (approved) =>
        showToast(
          approved.member_no
            ? `Member approved as ${approved.member_no}. They have been notified.`
            : "Member approved. They have been notified.",
          "success"
        ),
      onError: (err) =>
        showToast(
          err instanceof ApiError ? err.message : "Failed to approve",
          "error"
        ),
    })

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold tracking-wider text-slate-500 uppercase">
        Applicants
      </h3>
      {loading ? (
        <CardSkeleton cards={3} lines={1} />
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">
            No applications for this intake yet.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 text-left text-xs text-slate-500 dark:border-slate-700">
                <tr>
                  <th className="px-4 py-3 font-semibold">Applicant</th>
                  <th className="px-4 py-3 font-semibold">Phone</th>
                  <th className="px-4 py-3 font-semibold">Subscription</th>
                  <th className="px-4 py-3 font-semibold">Fees</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Applied</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-slate-100 last:border-0 dark:border-slate-800"
                  >
                    <td className="px-4 py-3">
                      <Link
                        to="/members/$memberId"
                        params={{ memberId: r.id }}
                        className="font-semibold text-[#003d9a] hover:underline dark:text-[#b2c5ff]"
                      >
                        {r.full_name}
                      </Link>
                      <p className="text-xs text-slate-400">{r.email}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {r.phone ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {r.monthly_subscription === null
                        ? "—"
                        : formatNaira(Number(r.monthly_subscription), true)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-black uppercase ${
                          r.registration_fee_paid
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                        }`}
                      >
                        {r.registration_fee_paid ? "Paid" : "Unpaid"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-600 capitalize dark:text-slate-300">
                      {r.status}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(r.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {r.status === "pending" && (
                        <Button
                          size="sm"
                          className="text-xs"
                          disabled={approving === r.id}
                          onClick={() => handleApprove(r.id)}
                        >
                          {approving === r.id ? "Approving…" : "Approve"}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function PastWindowsTable({ windows }: { windows: RegistrationWindow[] }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold tracking-wider text-slate-500 uppercase">
        Past intakes
      </h3>
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-left text-xs text-slate-500 dark:border-slate-700">
              <tr>
                <th className="px-4 py-3 font-semibold">Intake</th>
                <th className="px-4 py-3 font-semibold">Period</th>
                <th className="px-4 py-3 font-semibold">Applications</th>
                <th className="px-4 py-3 font-semibold">Total fee</th>
              </tr>
            </thead>
            <tbody>
              {windows.map((w) => (
                <tr
                  key={w.id}
                  className="border-b border-slate-100 last:border-0 dark:border-slate-800"
                >
                  <td className="px-4 py-3 font-semibold text-[#191c1e] dark:text-white">
                    {w.name}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    {new Date(w.opens_at).toLocaleDateString()} —{" "}
                    {new Date(w.closes_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    {w.applications_count}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    {formatNaira(
                      Number(w.registration_fee) + Number(w.social_fee),
                      true
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}

function WindowFormModal({
  window: w,
  onClose,
  onSubmit,
}: {
  window?: RegistrationWindow
  onClose: () => void
  onSubmit: (input: CreateRegistrationWindowInput) => void
}) {
  const [name, setName] = useState(w?.name ?? "")
  const [opensAt, setOpensAt] = useState(w ? toLocalInput(w.opens_at) : "")
  const [closesAt, setClosesAt] = useState(w ? toLocalInput(w.closes_at) : "")
  const [capacity, setCapacity] = useState(w?.capacity?.toString() ?? "")
  const [registrationFee, setRegistrationFee] = useState(
    String(w?.registration_fee ?? 20000)
  )
  const [socialFee, setSocialFee] = useState(String(w?.social_fee ?? 1000))
  const [minSub, setMinSub] = useState(
    String(w?.min_monthly_subscription ?? 5000)
  )
  const [maxSub, setMaxSub] = useState(
    String(w?.max_monthly_subscription ?? 50000)
  )
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (name.trim().length < 2) return setError("Give the intake a name.")
    if (!opensAt || !closesAt)
      return setError("Set both an opening and a closing date.")
    if (new Date(closesAt) <= new Date(opensAt))
      return setError("The closing date must be after the opening date.")
    if (Number(maxSub) < Number(minSub))
      return setError("The maximum subscription cannot be below the minimum.")

    setError(null)
    onSubmit({
      name: name.trim(),
      // datetime-local is naive local time; the API stores timestamptz, so
      // convert explicitly rather than shipping an ambiguous string.
      opens_at: new Date(opensAt).toISOString(),
      closes_at: new Date(closesAt).toISOString(),
      capacity: capacity.trim() === "" ? null : Number(capacity),
      registration_fee: Number(registrationFee),
      social_fee: Number(socialFee),
      min_monthly_subscription: Number(minSub),
      max_monthly_subscription: Number(maxSub),
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl dark:bg-[#0b1326]">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-[#191c1e] dark:text-white">
            {w ? "Edit Intake" : "New Intake"}
          </h3>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <HugeiconsIcon icon={CancelSquareIcon} className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Intake name">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="2026 Intake"
              className={inputCls}
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Opens">
              <input
                type="datetime-local"
                value={opensAt}
                onChange={(e) => setOpensAt(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Closes">
              <input
                type="datetime-local"
                value={closesAt}
                onChange={(e) => setClosesAt(e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>

          <Field label="Capacity (leave blank for no limit)">
            <input
              type="number"
              min={1}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              placeholder="Unlimited"
              className={inputCls}
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Registration fee (₦)">
              <input
                type="number"
                min={0}
                value={registrationFee}
                onChange={(e) => setRegistrationFee(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Social fee (₦)">
              <input
                type="number"
                min={0}
                value={socialFee}
                onChange={(e) => setSocialFee(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Min monthly subscription (₦)">
              <input
                type="number"
                min={1}
                value={minSub}
                onChange={(e) => setMinSub(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Max monthly subscription (₦)">
              <input
                type="number"
                min={1}
                value={maxSub}
                onChange={(e) => setMaxSub(e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <p className="text-xs text-slate-400">
            New intakes are created as a draft — applicants see nothing until
            you open registration.
          </p>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-gradient-to-br from-[#1e55be] to-[#003d9a] text-white"
            >
              {w ? "Save changes" : "Create draft"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-slate-500">
        {label}
      </label>
      {children}
    </div>
  )
}
