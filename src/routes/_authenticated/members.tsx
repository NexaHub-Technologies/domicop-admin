import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useState, useMemo } from "react"
import { notificationsApi } from "../../lib/api/notifications"
import { ApiError } from "../../lib/http"
import type { Member } from "../../lib/types/auth"
import type { CreateMemberInput } from "../../lib/types/members"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { createColumnHelper } from "@tanstack/react-table"
import { DataTable, dataTableFeatures } from "../../components/data-table"
import { Button } from "@/components/ui/button"
import {
  useMembers,
  usePendingApplications,
  useApproveMember,
  useUpdateMember,
  useCreateMember,
} from "../../lib/queries"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Bar, BarChart, ResponsiveContainer, XAxis } from "recharts"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  UserAdd01Icon,
  FilterHorizontalIcon,
  PencilEdit01Icon,
  ViewIcon,
  Task01Icon,
  Megaphone01Icon,
  Search01Icon,
  CheckmarkCircle02Icon,
  CancelSquareIcon,
  ArrowRight01Icon,
  ArrowLeft01Icon,
} from "@hugeicons/core-free-icons"

export const Route = createFileRoute("/_authenticated/members")({
  component: MembersPage,
})

type StatusFilter = "all" | "active" | "pending" | "suspended"

const chartConfig = {
  value: {
    label: "Members",
    color: "hsl(var(--chart-1))",
  },
}

const PAGE_SIZE = 25

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

// Membership growth over the last 6 months, from members' created_at.
function computeGrowth(members: Member[]) {
  const groups = new Map<string, number>()
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    groups.set(`${d.getFullYear()}-${d.getMonth()}`, 0)
  }
  for (const m of members) {
    const d = new Date(m.created_at)
    const key = `${d.getFullYear()}-${d.getMonth()}`
    if (groups.has(key)) groups.set(key, (groups.get(key) ?? 0) + 1)
  }
  return Array.from(groups.entries()).map(([key, value]) => {
    const [y, mo] = key.split("-")
    const d = new Date(Number(y), Number(mo), 1)
    return { month: d.toLocaleDateString("en-US", { month: "short" }), value }
  })
}

const helper = createColumnHelper<typeof dataTableFeatures, Member>()

/**
 * Columns are built once per page render and memoised — a fresh array each
 * render re-creates the table instance and loses its sorting state.
 */
function useMemberColumns(
  onApprove: (id: string) => void,
  onEdit: (m: Member) => void,
  isPending: (id: string) => boolean
) {
  return useMemo(
    () =>
      helper.columns([
        helper.accessor("member_no", {
          header: "Member No",
          cell: ({ getValue }) => (
            <span className="font-bold text-[#1e55be] dark:text-[#b2c5ff]">
              {getValue() || "—"}
            </span>
          ),
        }),
        helper.accessor("full_name", {
          header: "Member",
          cell: ({ row }) => (
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600 sm:h-10 sm:w-10 dark:bg-slate-700 dark:text-slate-400">
                {getInitials(row.original.full_name)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-[#191c1e] dark:text-white">
                  {row.original.full_name}
                </p>
                <p className="hidden truncate text-xs text-slate-500 sm:block dark:text-slate-400">
                  {row.original.email}
                </p>
              </div>
            </div>
          ),
        }),
        helper.accessor("status", {
          header: "Status",
          cell: ({ getValue }) => {
            const status = getValue()
            return (
              <Badge
                variant={
                  status === "active"
                    ? "default"
                    : status === "pending"
                      ? "secondary"
                      : "outline"
                }
                className={`text-[10px] font-black uppercase ${
                  status === "active"
                    ? "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400"
                    : status === "pending"
                      ? "bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400"
                      : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
                }`}
              >
                {status}
              </Badge>
            )
          },
        }),
        helper.accessor("phone", {
          header: "Phone",
          cell: ({ getValue }) => (
            <span className="text-sm text-slate-600 dark:text-slate-400">
              {getValue() || "—"}
            </span>
          ),
        }),
        helper.accessor("created_at", {
          header: "Joined",
          cell: ({ getValue }) => (
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {new Date(getValue()).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          ),
        }),
        helper.display({
          id: "actions",
          header: "",
          cell: ({ row }) => {
            const member = row.original
            return (
              <div className="flex justify-end gap-1">
                {member.status === "pending" && (
                  <button
                    onClick={() => onApprove(member.id)}
                    disabled={isPending(member.id)}
                    title="Approve member"
                    className="p-1 text-slate-400 transition-colors hover:text-green-600 disabled:opacity-40 sm:p-2"
                  >
                    <HugeiconsIcon
                      icon={CheckmarkCircle02Icon}
                      className="h-5 w-5"
                    />
                  </button>
                )}
                <Link
                  to="/members/$memberId"
                  params={{ memberId: member.id }}
                  className="p-1 text-slate-400 transition-colors hover:text-[#003d9a] sm:p-2 dark:hover:text-[#b2c5ff]"
                >
                  <HugeiconsIcon icon={ViewIcon} className="h-5 w-5" />
                </Link>
                <button
                  onClick={() => onEdit(member)}
                  className="p-1 text-slate-400 transition-colors hover:text-[#003d9a] sm:p-2 dark:hover:text-[#b2c5ff]"
                >
                  <HugeiconsIcon icon={PencilEdit01Icon} className="h-5 w-5" />
                </button>
              </div>
            )
          },
        }),
      ]),
    [onApprove, onEdit, isPending]
  )
}

function MembersPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState<StatusFilter>("all")
  const [search, setSearch] = useState("")
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingMember, setEditingMember] = useState<Member | null>(null)
  const [showBroadcastModal, setShowBroadcastModal] = useState(false)
  const [toast, setToast] = useState<{
    message: string
    type: "success" | "error"
  } | null>(null)

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  // Two reads, both cached and de-duplicated by Query: the page being browsed,
  // and the whole approval queue. The queue drives the count and the "pending"
  // filter, which were previously derived from whichever 25 rows happened to
  // be loaded.
  const membersQuery = useMembers(page, PAGE_SIZE)
  const pendingQuery = usePendingApplications()

  const members = membersQuery.data?.data ?? []
  const total = membersQuery.data?.total ?? null
  const loading = membersQuery.isPending
  const error = membersQuery.error
    ? membersQuery.error instanceof Error
      ? membersQuery.error.message
      : "Failed to load members"
    : null

  const pendingApplications = pendingQuery.data ?? []
  const pendingUnavailable = pendingQuery.isError

  const approveMember = useApproveMember()
  const updateMember = useUpdateMember()
  const createMember = useCreateMember()
  const isPending = (id: string) =>
    (approveMember.isPending && approveMember.variables === id) ||
    (updateMember.isPending && updateMember.variables?.id === id)

  const columns = useMemberColumns(
    (id) => handleApprove(id),
    (m) => setEditingMember(m),
    (id) => isPending(id)
  )

  // Search and status filter. "pending" reads the full queue rather than the
  // loaded page, so every applicant is reachable; the other filters stay
  // page-scoped because they browse rather than work a queue.
  const filteredMembers = useMemo(() => {
    let result = filter === "pending" ? pendingApplications : members
    if (filter !== "all" && filter !== "pending") {
      result = result.filter((m) => m.status === filter)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (m) =>
          m.full_name.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q) ||
          (m.member_no ?? "").toLowerCase().includes(q)
      )
    }
    return result
  }, [members, pendingApplications, filter, search])

  const growthData = useMemo(() => computeGrowth(members), [members])
  const pendingCount = pendingApplications.length
  const totalPages = total ? Math.ceil(total / PAGE_SIZE) : 1
  // The pending queue arrives whole, so paging through it would be meaningless.
  const paginated = filter !== "pending"

  const handleCreateMember = (input: CreateMemberInput) =>
    createMember.mutate(input, {
      onSuccess: () => {
        showToast(`Member ${input.full_name} created.`, "success")
        setShowCreateModal(false)
      },
      onError: (err) =>
        showToast(
          err instanceof ApiError ? err.message : "Failed to create member",
          "error"
        ),
    })

  const handleUpdateMember = (
    id: string,
    data: { status?: Member["status"]; member_no?: string }
  ) =>
    updateMember.mutate(
      { id, data },
      {
        onSuccess: () => {
          showToast("Member updated.", "success")
          setEditingMember(null)
        },
        onError: (err) =>
          showToast(
            err instanceof ApiError ? err.message : "Failed to update member",
            "error"
          ),
      }
    )

  const handleApprove = (id: string) =>
    approveMember.mutate(id, {
      onSuccess: (approved) => {
        setEditingMember(null)
        showToast(
          approved.member_no
            ? `Member approved as ${approved.member_no}. They have been notified.`
            : "Member approved. They have been notified.",
          "success"
        )
      },
      onError: (err) =>
        showToast(
          err instanceof ApiError ? err.message : "Failed to approve member",
          "error"
        ),
    })

  const handleBroadcast = async (title: string, body: string) => {
    try {
      const res = await notificationsApi.broadcast({ title, body })
      showToast(`Broadcast sent to ${res.sent} members.`, "success")
      setShowBroadcastModal(false)
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "Failed to send broadcast",
        "error"
      )
    }
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {toast && (
        <div
          className={`fixed right-4 bottom-4 z-50 flex items-center gap-2 rounded-lg px-4 py-3 shadow-lg ${
            toast.type === "success"
              ? "bg-green-600 text-white"
              : "bg-red-600 text-white"
          }`}
        >
          {toast.type === "success" ? (
            <HugeiconsIcon icon={CheckmarkCircle02Icon} className="h-5 w-5" />
          ) : (
            <HugeiconsIcon icon={CancelSquareIcon} className="h-5 w-5" />
          )}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end sm:gap-6">
        <div className="space-y-1">
          <p className="text-xs font-bold tracking-widest text-[#003d9a] uppercase dark:text-[#b2c5ff]">
            Administration
          </p>
          <h2 className="text-2xl font-extrabold tracking-tight text-[#191c1e] sm:text-3xl dark:text-white">
            Member Management
          </h2>
          <p className="max-w-md text-sm text-slate-500 dark:text-slate-400">
            Oversee and manage your cooperative&apos;s membership base, approve
            applications, and keep records current.
          </p>
        </div>
        <Button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 self-start bg-gradient-to-br from-[#1e55be] to-[#003d9a] text-white shadow-lg shadow-[#1e55be]/20 hover:brightness-110 sm:self-auto"
        >
          <HugeiconsIcon icon={UserAdd01Icon} className="h-4 w-4" />
          Create New Member
        </Button>
      </div>

      {/* Filter Bar */}
      <Card className="p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-slate-500 sm:px-4 dark:text-slate-400">
            <HugeiconsIcon
              icon={FilterHorizontalIcon}
              className="h-4 w-4 sm:h-5 sm:w-5"
            />
            <span>Status:</span>
          </div>
          {(["all", "active", "pending", "suspended"] as StatusFilter[]).map(
            (status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`rounded-lg px-2 py-1.5 text-xs font-semibold transition-all sm:px-4 sm:py-2 sm:text-sm ${
                  filter === status
                    ? "bg-[#003d9a] text-white"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                }`}
              >
                {status === "all"
                  ? "All Members"
                  : status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            )
          )}
          <div className="relative ml-auto">
            <HugeiconsIcon
              icon={Search01Icon}
              className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              placeholder="Search members..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 py-1.5 pr-3 pl-9 text-xs font-medium text-[#191c1e] placeholder:text-slate-400 focus:border-[#003d9a] focus:outline-none sm:py-2 sm:text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
        </div>
      </Card>

      {/* Members Table — TanStack Table owns sorting; the server owns paging,
          so no pageSize is passed and the controls below stay in charge. */}
      <Card className="overflow-hidden">
        <CardContent className="p-2 sm:p-4">
          <DataTable
            columns={columns}
            data={filteredMembers}
            loading={loading}
            error={error}
            emptyMessage={
              filter === "pending"
                ? pendingUnavailable
                  ? "Pending applications could not be loaded."
                  : "No applications are waiting for approval."
                : "No members found"
            }
            rowClassName={(m) => (isPending(m.id) ? "opacity-50" : "")}
            skeletonWidths={[
              "h-4 w-24",
              "h-8 w-40",
              "h-5 w-16",
              "h-4 w-24",
              "h-4 w-20",
              "h-4 w-16",
            ]}
          />
        </CardContent>
      </Card>

      {/* Pagination — replaced by a queue summary while viewing pending
          applications, which arrive as one unpaginated list. */}
      {paginated ? (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Page {page}
            {total !== null ? ` of ${totalPages} · ${total} members` : ""}
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
      ) : (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {pendingUnavailable
              ? "Pending applications could not be loaded."
              : `Showing all ${pendingCount} pending application${pendingCount === 1 ? "" : "s"}, oldest first.`}
          </p>
          <Button
            onClick={() => setFilter("all")}
            variant="outline"
            size="sm"
            className="text-xs sm:text-sm"
          >
            Back to all members
          </Button>
        </div>
      )}

      {/* Growth + Quick Actions */}
      <section className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base sm:text-lg">
              Membership Growth
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-32 sm:h-40">
              <ChartContainer config={chartConfig}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={growthData}>
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value) => [`${value} members`, "Count"]}
                        />
                      }
                    />
                    <Bar dataKey="value" fill="#1e55be" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-[#1e55be] to-[#003d9a] text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-white sm:text-lg">
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-white/80">
              Manage member operations efficiently
            </p>
            <div className="space-y-2 sm:space-y-3">
              <Button
                onClick={() => setFilter("pending")}
                className="w-full bg-white/10 text-white hover:bg-white/20"
              >
                <HugeiconsIcon icon={Task01Icon} className="mr-2 h-4 w-4" />
                Pending Applications{" "}
                {pendingUnavailable ? "" : `(${pendingCount})`}
              </Button>
              <Button
                onClick={() => setShowBroadcastModal(true)}
                className="w-full bg-white/10 text-white hover:bg-white/20"
              >
                <HugeiconsIcon
                  icon={Megaphone01Icon}
                  className="mr-2 h-4 w-4"
                />
                Member Broadcast
              </Button>
              <Button
                onClick={() => navigate({ to: "/announcements" })}
                className="w-full bg-white/10 text-white hover:bg-white/20"
              >
                <HugeiconsIcon
                  icon={Megaphone01Icon}
                  className="mr-2 h-4 w-4"
                />
                Announcements
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      {showCreateModal && (
        <CreateMemberModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateMember}
        />
      )}

      {editingMember && (
        <EditMemberModal
          member={editingMember}
          onClose={() => setEditingMember(null)}
          onSave={(data) => handleUpdateMember(editingMember.id, data)}
          onApprove={
            editingMember.status === "pending"
              ? () => handleApprove(editingMember.id)
              : undefined
          }
        />
      )}

      {showBroadcastModal && (
        <BroadcastModal
          onClose={() => setShowBroadcastModal(false)}
          onSubmit={handleBroadcast}
        />
      )}
    </div>
  )
}

// Create Member Modal — POST /members
function CreateMemberModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void
  onSubmit: (input: CreateMemberInput) => void
}) {
  const [form, setForm] = useState<CreateMemberInput>({
    email: "",
    password: "",
    full_name: "",
    phone: "",
    address: "",
    next_of_kin: "",
  })

  const set = (k: keyof CreateMemberInput, v: string) =>
    setForm((prev) => ({ ...prev, [k]: v }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.email || !form.password || !form.full_name) return
    onSubmit(form)
  }

  return (
    <ModalShell title="Create New Member" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Full Name *">
          <input
            type="text"
            value={form.full_name}
            onChange={(e) => set("full_name", e.target.value)}
            required
            className={inputCls}
          />
        </Field>
        <Field label="Email Address *">
          <input
            type="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            required
            className={inputCls}
          />
        </Field>
        <Field label="Password *">
          <input
            type="password"
            value={form.password}
            onChange={(e) => set("password", e.target.value)}
            required
            minLength={8}
            className={inputCls}
          />
        </Field>
        <Field label="Phone">
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Address">
          <input
            type="text"
            value={form.address}
            onChange={(e) => set("address", e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Next of Kin">
          <input
            type="text"
            value={form.next_of_kin ?? ""}
            onChange={(e) => set("next_of_kin", e.target.value)}
            className={inputCls}
          />
        </Field>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className={cancelBtnCls}>
            Cancel
          </button>
          <button type="submit" className={submitBtnCls}>
            Create Member
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

// Edit Member Modal — PATCH /members/:id accepts only status + member_no (§4)
function EditMemberModal({
  member,
  onClose,
  onSave,
  onApprove,
}: {
  member: Member
  onClose: () => void
  onSave: (data: { status?: Member["status"]; member_no?: string }) => void
  onApprove?: () => void
}) {
  const [status, setStatus] = useState<Member["status"]>(member.status)
  const [memberNo, setMemberNo] = useState(member.member_no ?? "")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({ status, member_no: memberNo || undefined })
  }

  return (
    <ModalShell title={`Edit ${member.full_name}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Status">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as Member["status"])}
            className={inputCls}
          >
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
        </Field>
        <Field label="Member No">
          <input
            type="text"
            value={memberNo}
            onChange={(e) => setMemberNo(e.target.value)}
            placeholder="DOMICOOP-0007"
            className={inputCls}
          />
        </Field>
        <div className="flex flex-wrap gap-3 pt-2">
          {onApprove && (
            <button
              type="button"
              onClick={onApprove}
              className="flex-1 rounded-lg border border-green-200 bg-green-50 py-2 text-sm font-medium text-green-700 transition-colors hover:bg-green-100 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400"
            >
              Approve
            </button>
          )}
          <button type="button" onClick={onClose} className={cancelBtnCls}>
            Cancel
          </button>
          <button type="submit" className={submitBtnCls}>
            Save Changes
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

// Broadcast Modal — POST /notifications/broadcast
function BroadcastModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void
  onSubmit: (title: string, body: string) => void
}) {
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !body.trim()) return
    onSubmit(title, body)
  }

  return (
    <ModalShell title="Member Broadcast" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Title">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className={inputCls}
          />
        </Field>
        <Field label="Message">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
            rows={4}
            className={inputCls}
            placeholder="Type your message to all active members…"
          />
        </Field>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Sent to all active members (in-app + push).
        </p>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className={cancelBtnCls}>
            Cancel
          </button>
          <button
            type="submit"
            disabled={!title.trim() || !body.trim()}
            className={`${submitBtnCls} disabled:opacity-50`}
          >
            Send Broadcast
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

// --- Small shared modal primitives ---

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
const cancelBtnCls =
  "flex-1 rounded-lg border border-slate-200 bg-slate-50 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
const submitBtnCls =
  "flex-1 rounded-lg bg-[#003d9a] py-2 text-sm font-bold text-white transition-colors hover:brightness-110"

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

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-6 shadow-xl dark:bg-[#0b1326]">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-[#191c1e] dark:text-white">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <HugeiconsIcon icon={CancelSquareIcon} className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
