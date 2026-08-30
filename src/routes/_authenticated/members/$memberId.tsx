import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { useMember, useMemberStatement } from "../../../lib/queries"
import type { StatementEntry } from "../../../lib/types/members"
import { formatNaira } from "../../../lib/money"
import { Skeleton } from "@/components/ui/skeleton"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowLeft01Icon,
  UserRemove01Icon,
  MoneySend01Icon,
  BankIcon,
  Gif01Icon,
} from "@hugeicons/core-free-icons"

export const Route = createFileRoute("/_authenticated/members/$memberId")({
  component: MemberDetailPage,
})

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

// Statement amounts are all in naira.
function formatEntryAmount(entry: StatementEntry): string {
  return formatNaira(entry.amount)
}

const entryIcon: Record<StatementEntry["type"], typeof MoneySend01Icon> = {
  contribution: MoneySend01Icon,
  repayment: MoneySend01Icon,
  loan: BankIcon,
  dividend: Gif01Icon,
}

function MemberDetailPage() {
  const { memberId } = Route.useParams()
  const navigate = useNavigate()

  const [year, setYear] = useState(new Date().getFullYear())

  const memberQuery = useMember(memberId)
  const statementQuery = useMemberStatement(memberId, year)

  const member = memberQuery.data ?? null
  const statement = statementQuery.data ?? null
  const loading = memberQuery.isPending
  const notFound =
    (memberQuery.error as { status?: number } | null)?.status === 404
  const error = memberQuery.error
    ? memberQuery.error instanceof Error
      ? memberQuery.error.message
      : "Failed to load member"
    : null

  if (loading) {
    // Shaped like the real page — avatar card on the left, stat tiles and the
    // statement on the right — so nothing jumps when the data lands.
    return (
      <div className="space-y-8">
        <div className="flex items-center gap-4">
          <Skeleton className="size-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-7 w-56" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="rounded-3xl border border-slate-100 bg-white p-8 dark:border-slate-700 dark:bg-[#0b1326]">
            <div className="mb-6 flex flex-col items-center gap-3">
              <Skeleton className="size-24 rounded-full" />
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3 w-48" />
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
            <div className="space-y-3">
              {Array.from({ length: 8 }, (_, i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
            </div>
          </div>
          <div className="space-y-6 lg:col-span-2">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {Array.from({ length: 3 }, (_, i) => (
                <div
                  key={i}
                  className="rounded-3xl border border-slate-100 bg-white p-6 dark:border-slate-700 dark:bg-[#0b1326]"
                >
                  <Skeleton className="mb-3 h-3 w-24" />
                  <Skeleton className="h-7 w-32" />
                </div>
              ))}
            </div>
            <div className="rounded-3xl border border-slate-100 bg-white p-8 dark:border-slate-700 dark:bg-[#0b1326]">
              <Skeleton className="mb-6 h-5 w-48" />
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="mb-3 h-10 w-full" />
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (notFound || !member) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center">
        <HugeiconsIcon
          icon={UserRemove01Icon}
          className="mb-4 h-16 w-16 text-slate-300 dark:text-slate-600"
        />
        <h2 className="mb-2 text-2xl font-bold text-[#191c1e] dark:text-white">
          Member Not Found
        </h2>
        <p className="text-slate-500 dark:text-slate-400">
          {error ?? "The member you are looking for does not exist."}
        </p>
      </div>
    )
  }

  const years = Array.from(
    { length: 5 },
    (_, i) => new Date().getFullYear() - i
  )

  return (
    <div className="space-y-8">
      {/* Back Button & Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate({ to: "/members" })}
          className="p-2 text-slate-500 transition-colors hover:text-[#1e55be] dark:text-slate-400 dark:hover:text-[#b2c5ff]"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} className="h-6 w-6" />
        </button>
        <div>
          <span className="mb-1 block text-xs font-bold tracking-[0.2em] text-[#003d9a] uppercase dark:text-[#b2c5ff]">
            Member Details
          </span>
          <h2 className="text-3xl font-extrabold tracking-tight text-[#191c1e] dark:text-white">
            {member.full_name}
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Left Column - Profile Info */}
        <div className="rounded-3xl border border-slate-100 bg-white p-8 shadow-sm dark:border-slate-700 dark:bg-[#0b1326]">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-[#1e55be] to-[#003d9a] text-3xl font-bold text-white">
              {getInitials(member.full_name)}
            </div>
            <h3 className="text-xl font-bold text-[#191c1e] dark:text-white">
              {member.full_name}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {member.email}
            </p>
            <span
              className={`mt-3 inline-block rounded-full px-4 py-1.5 text-xs font-bold uppercase ${
                member.status === "active"
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  : member.status === "pending"
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                    : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
              }`}
            >
              {member.status}
            </span>
          </div>

          <div className="space-y-1">
            <DetailRow label="Member No" value={member.member_no || "—"} bold />
            <DetailRow label="Phone" value={member.phone || "—"} />
            <DetailRow label="WhatsApp" value={member.whatsapp_number || "—"} />
            <DetailRow label="Sex" value={member.sex || "—"} />
            <DetailRow
              label="Date of Birth"
              value={
                member.date_of_birth
                  ? new Date(member.date_of_birth).toLocaleDateString()
                  : "—"
              }
            />
            <DetailRow
              label="Marital Status"
              value={member.marital_status || "—"}
            />
            <DetailRow label="Address" value={member.address || "—"} />
            <DetailRow
              label="ID Card No"
              value={member.id_card_number || "—"}
            />
            <DetailRow label="Next of Kin" value={member.next_of_kin || "—"} />
            <DetailRow
              label="Place of Work"
              value={member.place_of_work || "—"}
            />
            <DetailRow
              label="Type of Business"
              value={member.type_of_business || "—"}
            />
            <DetailRow label="Referred By" value={member.referred_by || "—"} />
            <DetailRow
              label="Monthly Subscription"
              value={
                member.monthly_subscription == null
                  ? "—"
                  : formatNaira(Number(member.monthly_subscription), true)
              }
            />
            <DetailRow
              label="Joined"
              value={new Date(member.created_at).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            />
          </div>

          {/* Registration record — only meaningful for members who came
              through the registration portal. */}
          {(member.registration_fee_paid !== undefined ||
            member.signature_url) && (
            <div className="mt-6 border-t border-slate-100 pt-6 dark:border-slate-700">
              <p className="mb-3 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                Registration
              </p>
              <div className="space-y-1">
                <DetailRow
                  label="Fees"
                  value={member.registration_fee_paid ? "Paid" : "Unpaid"}
                  bold
                />
                {member.registration_paid_at && (
                  <DetailRow
                    label="Paid On"
                    value={new Date(
                      member.registration_paid_at
                    ).toLocaleDateString()}
                  />
                )}
                {member.registration_ref && (
                  <DetailRow
                    label="Reference"
                    value={member.registration_ref}
                  />
                )}
              </div>

              {member.signature_url && (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-semibold text-slate-500">
                    Signature
                  </p>
                  <img
                    src={member.signature_url}
                    alt={`Signature of ${member.full_name}`}
                    className="w-full rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column - Stats & Activity */}
        <div className="space-y-6 lg:col-span-2">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <StatCard
              label="Total Contributions"
              value={formatNaira(statement?.summary.total_contributions ?? 0)}
            />
            <StatCard
              label="Total Loans"
              value={formatNaira(statement?.summary.total_loans ?? 0)}
            />
            <StatCard
              label="Dividends Earned"
              value={formatNaira(statement?.summary.total_dividends ?? 0)}
            />
          </div>

          {/* Statement / Activity */}
          <div className="rounded-3xl border border-slate-100 bg-white p-8 shadow-sm dark:border-slate-700 dark:bg-[#0b1326]">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#191c1e] dark:text-white">
                Statement — {year}
              </h3>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            {statement && statement.transactions.length > 0 ? (
              <div className="space-y-4">
                {statement.transactions.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center gap-4 rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1e55be]/10 dark:bg-[#1e55be]/20">
                      <HugeiconsIcon
                        icon={entryIcon[entry.type]}
                        className="h-5 w-5 text-[#1e55be] dark:text-[#b2c5ff]"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-[#191c1e] dark:text-white">
                        {entry.description}
                      </p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {formatEntryAmount(entry)} · {entry.status}
                      </p>
                    </div>
                    <span className="text-sm text-slate-400">
                      {new Date(entry.date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-slate-500 dark:text-slate-400">
                No activity recorded for {year}.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function DetailRow({
  label,
  value,
  bold,
}: {
  label: string
  value: string
  bold?: boolean
}) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-3 dark:border-slate-700">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span
        className={`text-right ${bold ? "font-bold" : "font-medium"} text-[#191c1e] dark:text-white`}
      >
        {value}
      </span>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-[#0b1326]">
      <p className="mb-1 text-xs tracking-wider text-slate-500 uppercase dark:text-slate-400">
        {label}
      </p>
      <p className="text-2xl font-bold text-[#191c1e] dark:text-white">
        {value}
      </p>
    </div>
  )
}
