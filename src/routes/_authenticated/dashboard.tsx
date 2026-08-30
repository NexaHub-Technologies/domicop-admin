import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState, useMemo } from "react"
import {
  useReportSummary,
  useMembers,
  useLoans,
  useContributions,
  useUpdateMember,
  useCreateMember,
} from "../../lib/queries"
import { formatNaira } from "../../lib/money"
import { Skeleton } from "@/components/ui/skeleton"
import type { Member } from "../../lib/types/auth"
import { loanMemberName } from "../../lib/types/loans"
import type { Contribution } from "../../lib/types/contributions"
import { contributionMemberName } from "../../lib/types/contributions"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Bar, BarChart, XAxis, YAxis, ResponsiveContainer } from "recharts"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import {
  UserGroupIcon,
  MoneySend01Icon,
  Task01Icon,
  Message02Icon,
  FilterHorizontalIcon,
  ArrowRight01Icon,
  AuctionIcon,
  PencilEdit01Icon,
  ViewIcon,
  CheckmarkCircle02Icon,
  CancelSquareIcon,
} from "@hugeicons/core-free-icons"

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
})

const chartConfig = {
  amount: {
    label: "Contributions",
    color: "hsl(var(--chart-1))",
  },
}

type TimeRange = "6M" | "1Y" | "ALL"

// --- Helpers ---

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

type ChartPoint = { month: string; amount: number }

function aggregateContributions(
  contributions: Contribution[],
  monthsBack: number
): ChartPoint[] {
  const groups = new Map<string, number>()
  const now = new Date()
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    groups.set(key, 0)
  }
  for (const c of contributions) {
    const d = new Date(c.created_at)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    if (groups.has(key)) {
      groups.set(key, (groups.get(key) ?? 0) + c.amount)
    }
  }
  return Array.from(groups.entries()).map(([key, amount]) => {
    const [y, m] = key.split("-")
    const d = new Date(Number(y), Number(m) - 1, 1)
    const label =
      monthsBack > 12
        ? d.toLocaleDateString("en-US", { month: "short", year: "2-digit" })
        : d.toLocaleDateString("en-US", { month: "short" })
    return { month: label, amount }
  })
}

function computeChartData(
  contributions: Contribution[],
  range: TimeRange
): ChartPoint[] {
  const months = range === "6M" ? 6 : range === "1Y" ? 12 : 24
  return aggregateContributions(contributions, months)
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days > 1 ? "s" : ""} ago`
}

// Derive the "System Events" feed from recent contributions (amounts are naira).
function mapContributionActivity(c: Contribution) {
  return {
    id: c.id,
    type: "contribution",
    message: `${contributionMemberName(c)} — ${formatNaira(c.amount)} (${c.payment_status})`,
    time: relativeTime(c.created_at),
    priority: (c.amount > 10000 ? "high" : "normal") as "high" | "normal",
  }
}

function exportMembersToCSV(members: Member[]): string {
  const headers = ["ID", "Name", "Email", "Status", "Join Date"]
  const rows = members.map((m) => [
    m.id,
    m.full_name,
    m.email,
    m.status,
    new Date(m.created_at).toLocaleDateString(),
  ])
  return [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
  ].join("\n")
}

function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" })
  const link = document.createElement("a")
  const url = URL.createObjectURL(blob)
  link.setAttribute("href", url)
  link.setAttribute("download", filename)
  link.style.visibility = "hidden"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// --- Component ---

function DashboardPage() {
  const navigate = useNavigate()

  // Data state
  // Four independent reads. Query runs them in parallel, caches each on its own
  // key, and shares them with the pages that use the same data — the members
  // table here and on /members is now one cache entry, not two fetches.
  const summaryQuery = useReportSummary()
  const membersQuery = useMembers(1, 10)
  const pendingLoansQuery = useLoans(1, 5, "pending")
  const contributionsQuery = useContributions(1, 200)

  const summary = summaryQuery.data ?? null
  const members = membersQuery.data?.data ?? []
  const pendingLoansList = pendingLoansQuery.data?.data ?? []
  const pendingLoansTotal =
    pendingLoansQuery.data?.total ?? pendingLoansList.length
  const contributions = contributionsQuery.data?.data ?? []

  const loading =
    summaryQuery.isPending ||
    membersQuery.isPending ||
    pendingLoansQuery.isPending ||
    contributionsQuery.isPending
  const firstError =
    summaryQuery.error ??
    membersQuery.error ??
    pendingLoansQuery.error ??
    contributionsQuery.error
  const error = firstError
    ? firstError instanceof Error
      ? firstError.message
      : "Failed to load dashboard data"
    : null

  const updateMember = useUpdateMember()
  const createMember = useCreateMember()
  const isMemberPending = (id: string) =>
    updateMember.isPending && updateMember.variables?.id === id
  const addingMember = createMember.isPending

  // UI state
  const [timeRange, setTimeRange] = useState<TimeRange>("6M")
  const [filterStatus, setFilterStatus] = useState<
    "all" | "active" | "pending"
  >("all")
  const [editingMember, setEditingMember] = useState<Member | null>(null)
  const [toast, setToast] = useState<{
    message: string
    type: "success" | "error"
  } | null>(null)
  const [showAddMember, setShowAddMember] = useState(false)

  // Chart data from contributions
  const chartData = useMemo(
    () => computeChartData(contributions, timeRange),
    [contributions, timeRange]
  )

  const yAxisDomain = useMemo(() => {
    if (chartData.length === 0) return [0, 1000]
    const maxAmount = Math.max(...chartData.map((d) => d.amount))
    return [0, Math.ceil(maxAmount / 50000) * 50000]
  }, [chartData])

  // Filtered members (client-side filter on fetched data)
  const filteredMembers = useMemo(() => {
    const filtered =
      filterStatus === "all"
        ? members
        : members.filter((m) => m.status === filterStatus)
    return filtered.slice(0, 5)
  }, [members, filterStatus])

  // Show toast
  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  // Export CSV
  const handleExportMembersCSV = () => {
    const csv = exportMembersToCSV(members)
    downloadCSV(csv, "members_export.csv")
    showToast("Members exported successfully!", "success")
  }

  const handleViewMember = (memberId: string) => {
    navigate({ to: "/members/$memberId", params: { memberId } })
  }

  const handleEditMember = (member: Member) => {
    setEditingMember(member)
  }

  const handleSaveMember = () => {
    if (!editingMember) return
    const edited = editingMember
    // The row updates the moment Save is pressed and Query reverts it if the
    // server refuses, so the table never shows a status that did not stick.
    updateMember.mutate(
      { id: edited.id, data: { status: edited.status } },
      {
        onSuccess: () => {
          setEditingMember(null)
          showToast(`${edited.full_name} updated.`, "success")
        },
        onError: () => showToast("Failed to update member", "error"),
      }
    )
  }

  const handleAddMember = (data: {
    full_name: string
    email: string
    phone: string
    address: string
  }) =>
    // Guarded by the mutation's own pending flag as well as the disabled
    // button: two submits would create two accounts.
    createMember.mutate(
      {
        email: data.email,
        password: "tempPassword123",
        full_name: data.full_name,
        phone: data.phone,
        address: data.address,
      },
      {
        onSuccess: () => {
          showToast(`Member ${data.full_name} added successfully!`, "success")
          setShowAddMember(false)
        },
        onError: () => showToast("Failed to add member", "error"),
      }
    )

  // Approval is no longer a one-click action: it needs terms and the signature
  // of an office-holder (Part C), and a second officer after that. The
  // dashboard sends the reviewer to the loan rather than pretending otherwise.
  const handleReviewLoan = (loanId: string) => {
    navigate({ to: "/loans", search: { id: loanId } })
  }

  const handleOpenApprovalPanel = () => {
    navigate({ to: "/loans" })
  }

  const handleViewLogs = () => {
    navigate({ to: "/logs" })
  }

  // --- Derived stats ---
  const totalMembers = summary?.summary.total_members ?? 0
  const totalContributionsNaira = summary?.contributions.total ?? 0
  const dividendsPaid = summary?.dividends.total_paid ?? 0
  const pendingLoanCount = pendingLoansTotal
  const activityList = useMemo(
    () => contributions.slice(0, 6).map(mapContributionActivity),
    [contributions]
  )

  // --- Loading / Error states ---
  //
  // A single centred spinner used to gate the whole page. On the largest screen
  // in the app that meant staring at nothing, then having every tile, chart and
  // table arrive at once. The skeleton below mirrors the real four sections —
  // header, stat tiles, chart + activity feed, members table + loan queue — so
  // the shape is there from the first paint and nothing shifts when data lands.
  if (loading) {
    return <DashboardSkeleton />
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24">
        <p className="text-sm text-red-600">{error}</p>
        <button
          onClick={() => {
            // Refetch all four, not just one — any of them could be the failure.
            summaryQuery.refetch()
            membersQuery.refetch()
            pendingLoansQuery.refetch()
            contributionsQuery.refetch()
          }}
          className="rounded-lg bg-[#003d9a] px-4 py-2 text-sm font-bold text-white"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6 sm:space-y-8 lg:space-y-10">
      {/* Toast Notification */}
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

      {/* Page Header */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="mb-2 block text-xs font-bold tracking-[0.2em] text-[#003d9a] uppercase dark:text-[#b2c5ff]">
            System Overview
          </span>
          <h2 className="text-2xl font-extrabold tracking-tight text-[#191c1e] sm:text-3xl lg:text-4xl dark:text-white">
            Executive Dashboard
          </h2>
        </div>
        <div className="flex gap-2 sm:space-x-3">
          <button
            onClick={handleExportMembersCSV}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-[#191c1e] shadow-sm transition-colors hover:bg-slate-50 sm:px-4 sm:text-sm dark:border-slate-700 dark:bg-[#0b1326] dark:text-white dark:hover:bg-slate-800"
          >
            Export CSV
          </button>
          <button
            onClick={() => setShowAddMember(true)}
            className="rounded-lg bg-gradient-to-br from-[#1e55be] to-[#003d9a] px-3 py-2 text-xs font-bold text-white shadow-md transition-transform active:scale-95 sm:px-4 sm:text-sm"
          >
            Add New Member
          </button>
        </div>
      </section>

      {/* Key Stats Grid */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
        <StatCard
          icon={UserGroupIcon}
          label="Total Members"
          value={totalMembers.toLocaleString()}
        />
        <StatCard
          icon={MoneySend01Icon}
          label="Total Contributions"
          value={formatNaira(totalContributionsNaira, true)}
        />
        <StatCard
          icon={Task01Icon}
          label="Pending Loans"
          value={pendingLoanCount.toString()}
          badge={pendingLoanCount > 0 ? "URGENT" : undefined}
        />
        <StatCard
          icon={Message02Icon}
          label="Dividends Paid"
          value={formatNaira(dividendsPaid, true)}
          subLabel={`${summary?.dividends.count ?? 0} payouts`}
        />
      </section>

      {/* Main Interactive Section */}
      <section className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3 lg:gap-8">
        {/* Contribution Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-lg sm:text-xl">
                Contribution Trends
              </CardTitle>
              <CardDescription>
                Capital growth trajectory over{" "}
                {timeRange === "6M"
                  ? "6 months"
                  : timeRange === "1Y"
                    ? "12 months"
                    : "24 months"}
              </CardDescription>
            </div>
            <div className="flex rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
              {(["6M", "1Y", "ALL"] as TimeRange[]).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`rounded-md px-2 py-1 text-xs font-bold transition-all sm:px-3 ${
                    timeRange === range
                      ? "bg-[#003d9a] text-white shadow-sm"
                      : "text-slate-500 hover:text-[#191c1e] dark:text-slate-400 dark:hover:text-white"
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-48 sm:h-64">
              <ChartContainer config={chartConfig}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis hide domain={yAxisDomain} />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value) => [
                            `$${Number(value).toLocaleString()}`,
                            "Amount",
                          ]}
                        />
                      }
                    />
                    <Bar
                      dataKey="amount"
                      fill="#1e55be"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </div>
          </CardContent>
        </Card>

        {/* Activity Feed */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">System Events</CardTitle>
          </CardHeader>
          <CardContent>
            {activityList.length === 0 ? (
              <p className="text-sm text-slate-500">No recent activity</p>
            ) : (
              <>
                <div className="space-y-4 sm:space-y-6">
                  {activityList.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex space-x-3 sm:space-x-4"
                    >
                      <div
                        className={`mt-1 h-2 w-2 flex-shrink-0 rounded-full shadow-sm ${
                          activity.priority === "high"
                            ? "bg-[#1e55be]"
                            : activity.type === "system"
                              ? "bg-[#9b3e00]"
                              : "bg-slate-300 dark:bg-slate-600"
                        }`}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#191c1e] dark:text-white">
                          {activity.message}
                        </p>
                        <p className="text-xs text-slate-500 opacity-60 dark:text-slate-400">
                          {activity.time}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={handleViewLogs}
                  className="mt-4 flex items-center justify-center text-sm font-bold text-[#003d9a] transition-all hover:underline sm:mt-6 dark:text-[#b2c5ff]"
                >
                  View Full Logs
                  <HugeiconsIcon
                    icon={ArrowRight01Icon}
                    className="ml-1 h-4 w-4"
                  />
                </button>
              </>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Bottom Layout: Table & Quick Actions */}
      <section className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-4 lg:gap-8">
        {/* Members Table */}
        <Card className="overflow-hidden lg:col-span-3">
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-lg sm:text-xl">Recent Members</CardTitle>
            <div className="relative">
              <HugeiconsIcon
                icon={FilterHorizontalIcon}
                className="absolute top-1/2 left-2 h-4 w-4 -translate-y-1/2 text-slate-400"
              />
              <select
                value={filterStatus}
                onChange={(e) =>
                  setFilterStatus(
                    e.target.value as "all" | "active" | "pending"
                  )
                }
                className="rounded-lg border-none bg-slate-50 py-2 pr-4 pl-8 text-xs font-bold text-[#191c1e] focus:ring-1 focus:ring-[#1e55be]/40 dark:bg-slate-800 dark:text-white"
              >
                <option value="all">Status: All</option>
                <option value="active">Active</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50 hover:bg-slate-50/50 dark:bg-slate-800/50 dark:hover:bg-slate-800/50">
                    <TableHead className="text-[10px] font-black tracking-widest uppercase">
                      ID
                    </TableHead>
                    <TableHead className="text-[10px] font-black tracking-widest uppercase">
                      Identity
                    </TableHead>
                    <TableHead className="text-[10px] font-black tracking-widest uppercase">
                      Status
                    </TableHead>
                    <TableHead className="hidden text-[10px] font-black tracking-widest uppercase sm:table-cell">
                      Joined
                    </TableHead>
                    <TableHead className="text-right text-[10px] font-black tracking-widest uppercase">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMembers.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="py-8 text-center text-slate-500"
                      >
                        No members found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredMembers.map((member) => (
                      <TableRow
                        key={member.id}
                        className={`transition-all hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                          isMemberPending(member.id) ? "opacity-50" : ""
                        }`}
                      >
                        <TableCell className="font-bold text-[#1e55be] dark:text-[#b2c5ff]">
                          #{member.id}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 sm:gap-3">
                            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600 sm:h-8 sm:w-8 dark:bg-slate-700 dark:text-slate-400">
                              {getInitials(member.full_name)}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold text-[#191c1e] dark:text-white">
                                {member.full_name}
                              </p>
                              <p className="hidden truncate text-xs text-slate-500 sm:block dark:text-slate-400">
                                {member.email}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              member.status === "active"
                                ? "default"
                                : member.status === "pending"
                                  ? "secondary"
                                  : "outline"
                            }
                            className={`text-[10px] font-black uppercase ${
                              member.status === "active"
                                ? "bg-[#1e55be]/10 text-[#1e55be] hover:bg-[#1e55be]/20 dark:bg-[#b2c5ff]/20 dark:text-[#b2c5ff]"
                                : member.status === "pending"
                                  ? "bg-[#9b3e00]/10 text-[#9b3e00] hover:bg-[#9b3e00]/20 dark:bg-[#ffb690]/20 dark:text-[#ffb690]"
                                  : ""
                            }`}
                          >
                            {member.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden text-sm text-slate-500 sm:table-cell dark:text-slate-400">
                          {new Date(member.created_at).toLocaleDateString(
                            "en-US",
                            {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            }
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() => handleEditMember(member)}
                              className="p-1 text-slate-400 transition-colors hover:text-[#003d9a] sm:p-2 dark:hover:text-[#b2c5ff]"
                            >
                              <HugeiconsIcon
                                icon={PencilEdit01Icon}
                                className="h-5 w-5"
                              />
                            </button>
                            <button
                              onClick={() => handleViewMember(member.id)}
                              className="p-1 text-slate-400 transition-colors hover:text-[#003d9a] sm:p-2 dark:hover:text-[#b2c5ff]"
                            >
                              <HugeiconsIcon
                                icon={ViewIcon}
                                className="h-5 w-5"
                              />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Loan Queue Quick Access */}
        <Card className="flex flex-col justify-between bg-slate-100 dark:bg-[#0b1326]">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <HugeiconsIcon
                icon={AuctionIcon}
                className="h-5 w-5 text-[#9b3e00]"
              />
              <CardTitle className="text-base sm:text-lg">
                Queue: Loans
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex-1">
            <div className="space-y-3 sm:space-y-4">
              {pendingLoansList.length === 0 ? (
                <p className="text-sm text-slate-500">No pending loans</p>
              ) : (
                pendingLoansList.map((loan, index) => (
                  <div
                    key={loan.id}
                    className={`rounded-xl border border-slate-50 p-3 shadow-sm sm:p-4 dark:border-slate-700 ${
                      index === 0
                        ? "bg-white dark:bg-[#060e20]"
                        : "bg-white/60 opacity-60 dark:bg-[#060e20]/60"
                    }`}
                  >
                    <p className="mb-1 text-xs font-bold text-[#003d9a] dark:text-[#b2c5ff]">
                      REQ #{loan.id}
                    </p>
                    <p className="text-sm font-medium text-[#191c1e] dark:text-white">
                      {formatNaira(
                        loan.amount_approved ?? loan.amount_requested
                      )}{" "}
                      {loan.type
                        ? loan.type.charAt(0).toUpperCase() + loan.type.slice(1)
                        : "Loan"}
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      By: {loanMemberName(loan)}
                    </p>
                    {index === 0 && (
                      // One action, not two: both used to navigate to the same
                      // place once approval became a signing step.
                      <div className="mt-3 flex gap-2 sm:mt-4">
                        <button
                          onClick={() => handleReviewLoan(loan.id)}
                          className="flex-1 rounded-lg bg-[#003d9a] py-1.5 text-[10px] font-black text-white uppercase shadow-sm transition-all hover:brightness-110 sm:py-2"
                        >
                          Review &amp; Sign
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
            <button
              onClick={handleOpenApprovalPanel}
              className="mt-4 w-full rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-bold text-slate-600 shadow-sm transition-all hover:border-[#003d9a]/40 hover:text-[#191c1e] sm:mt-6 sm:py-3 dark:border-slate-700 dark:bg-[#060e20] dark:text-slate-400 dark:hover:text-white"
            >
              Open Approval Panel
            </button>
          </CardContent>
        </Card>
      </section>

      {/* Edit Member Modal */}
      {editingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-[#0b1326]">
            <h3 className="mb-4 text-lg font-bold text-[#191c1e] dark:text-white">
              Edit Member #{editingMember.id}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">
                  Name
                </label>
                <input
                  type="text"
                  value={editingMember.full_name}
                  disabled
                  className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">
                  Email
                </label>
                <input
                  type="email"
                  value={editingMember.email}
                  disabled
                  className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">
                  Status
                </label>
                <select
                  value={editingMember.status}
                  onChange={(e) =>
                    setEditingMember({
                      ...editingMember,
                      status: e.target.value as Member["status"],
                    })
                  }
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="active">Active</option>
                  <option value="pending">Pending</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setEditingMember(null)}
                className="flex-1 rounded-lg border border-slate-200 bg-slate-50 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveMember}
                disabled={isMemberPending(editingMember.id)}
                className="flex-1 rounded-lg bg-[#003d9a] py-2 text-sm font-bold text-white transition-colors hover:brightness-110 disabled:opacity-50"
              >
                {isMemberPending(editingMember.id) ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {showAddMember && (
        <AddMemberModal
          submitting={addingMember}
          onClose={() => setShowAddMember(false)}
          onSubmit={handleAddMember}
        />
      )}

      {/* Footer Spacing */}
      <div className="h-10 sm:h-20"></div>
    </div>
  )
}

// Add Member Modal Component
function AddMemberModal({
  submitting,
  onClose,
  onSubmit,
}: {
  submitting: boolean
  onClose: () => void
  onSubmit: (data: {
    full_name: string
    email: string
    phone: string
    address: string
  }) => void
}) {
  const [full_name, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [address, setAddress] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    if (!full_name || !email || !phone || !address) return
    onSubmit({ full_name, email, phone, address })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-[#0b1326]">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-[#191c1e] dark:text-white">
            Add New Member
          </h3>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <HugeiconsIcon icon={CancelSquareIcon} className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">
              Full Name *
            </label>
            <input
              type="text"
              value={full_name}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              placeholder="John Doe"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">
              Email Address *
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              placeholder="john@example.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">
              Phone *
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              placeholder="+2348000000000"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">
              Address *
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              placeholder="123 Main St"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-200 bg-slate-50 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-lg bg-[#003d9a] py-2 text-sm font-bold text-white transition-colors hover:brightness-110 disabled:opacity-50"
            >
              {submitting ? "Adding…" : "Add Member"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Stat Card Component
function DashboardSkeleton() {
  return (
    <div className="space-y-6 sm:space-y-8 lg:space-y-10">
      {/* Page header */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-10 w-40" />
      </section>

      {/* Key stats */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-[#0b1326]"
          >
            <Skeleton className="mb-4 size-10 rounded-2xl" />
            <Skeleton className="mb-2 h-3 w-24" />
            <Skeleton className="h-7 w-32" />
          </div>
        ))}
      </section>

      {/* Chart + activity feed */}
      <section className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3 lg:gap-8">
        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm lg:col-span-2 dark:border-slate-700 dark:bg-[#0b1326]">
          <Skeleton className="mb-6 h-5 w-48" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-[#0b1326]">
          <Skeleton className="mb-6 h-5 w-32" />
          <div className="space-y-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="size-9 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Members table + loan queue */}
      <section className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-4 lg:gap-8">
        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm lg:col-span-3 dark:border-slate-700 dark:bg-[#0b1326]">
          <Skeleton className="mb-6 h-5 w-40" />
          <div className="space-y-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </div>
        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-[#0b1326]">
          <Skeleton className="mb-6 h-5 w-28" />
          <div className="space-y-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  trend,
  trendType,
  badge,
  subLabel,
}: {
  icon: IconSvgElement
  label: string
  value: string
  trend?: string
  trendType?: "positive" | "negative"
  badge?: string
  subLabel?: string
}) {
  return (
    <Card className="group relative overflow-hidden">
      <CardContent className="p-4 sm:p-6">
        <div className="absolute -top-4 -right-4 h-24 w-24 rounded-full bg-[#1e55be]/5 blur-2xl transition-all group-hover:bg-[#1e55be]/10 dark:bg-[#1e55be]/10 dark:group-hover:bg-[#1e55be]/20"></div>
        <div className="mb-3 flex items-start justify-between sm:mb-4">
          <HugeiconsIcon
            icon={icon}
            className="h-6 w-6 text-[#1e55be] sm:h-8 sm:w-8 dark:text-[#b2c5ff]"
          />
          {trend && (
            <span
              className={
                trendType === "positive"
                  ? "text-xs font-bold text-green-600"
                  : "text-xs font-bold text-red-600"
              }
            >
              {trend}
            </span>
          )}
          {badge && (
            <Badge variant="destructive" className="text-[10px] font-bold">
              {badge}
            </Badge>
          )}
          {subLabel && (
            <span className="text-xs font-bold text-slate-400">{subLabel}</span>
          )}
        </div>
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
