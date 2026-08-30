import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import {
  useMessages,
  useReplyToMessage,
  useUpdateMessageStatus,
} from "../../lib/queries"
import { ApiError } from "../../lib/http"
import type { Message, MessageStatus } from "../../lib/types/messages"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CardSkeleton } from "@/components/ui/table-skeleton"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowLeft01Icon,
  InformationCircleIcon,
  CustomerService01Icon,
  SentIcon,
} from "@hugeicons/core-free-icons"

export const Route = createFileRoute("/_authenticated/communications")({
  component: CommunicationsPage,
})

type StatusTab = "all" | "open" | "in_progress" | "resolved" | "closed"

const statusStyles: Record<string, string> = {
  open: "bg-[#1e55be]/10 text-[#1e55be] dark:bg-[#b2c5ff]/20 dark:text-[#b2c5ff]",
  in_progress:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  resolved:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  closed: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400",
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
}

function CommunicationsPage() {
  const [tab, setTab] = useState<StatusTab>("all")
  const [selected, setSelected] = useState<Message | null>(null)
  const [replyText, setReplyText] = useState("")
  const [mobileView, setMobileView] = useState<"inbox" | "chat" | "context">(
    "inbox"
  )
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const messagesQuery = useMessages()
  const tickets = messagesQuery.data?.data ?? []
  const loading = messagesQuery.isPending
  const error = messagesQuery.error
    ? messagesQuery.error instanceof Error
      ? messagesQuery.error.message
      : "Failed to load tickets"
    : null
  const replyToMessage = useReplyToMessage()
  const updateMessageStatus = useUpdateMessageStatus()

  const sending = replyToMessage.isPending

  const handleReply = async () => {
    if (!selected || !replyText.trim()) return
    try {
      const updated = await replyToMessage.mutateAsync({
        id: selected.id,
        body: replyText,
      })
      setReplyText("")
      // The list is refreshed by the mutation's invalidation; only the open
      // ticket needs setting here.
      setSelected(updated)
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Failed to send reply")
    }
  }

  const handleStatus = async (status: MessageStatus) => {
    if (!selected) return
    try {
      const updated = await updateMessageStatus.mutateAsync({
        id: selected.id,
        status,
      })
      setSelected(updated)
      showToast(`Ticket marked ${status.replace("_", " ")}.`)
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "Failed to update status"
      )
    }
  }

  return (
    <div className="-mx-4 -mt-4 h-[calc(100vh-100px)] sm:-mx-6 sm:-mt-6 sm:h-[calc(100vh-120px)] lg:-mx-8 lg:-mt-8 lg:h-[calc(100vh-140px)]">
      {toast && (
        <div className="fixed right-4 bottom-4 z-50 rounded-lg bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
      <div className="flex h-full">
        {/* Left: ticket list */}
        <section
          className={cn(
            "flex flex-col border-r border-slate-200 bg-white dark:border-slate-700 dark:bg-[#0b1326]",
            "w-full lg:w-[350px] xl:w-[400px]",
            mobileView !== "inbox" && "hidden lg:flex"
          )}
        >
          <div className="p-4 pb-2 sm:p-6 sm:pb-4">
            <div className="mb-4 flex items-center justify-between sm:mb-6">
              <h2 className="text-xl font-extrabold tracking-tight text-[#191c1e] sm:text-2xl dark:text-white">
                Support Tickets
              </h2>
            </div>
            <Tabs value={tab} onValueChange={(v) => setTab(v as StatusTab)}>
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="all" className="text-[10px] sm:text-xs">
                  All
                </TabsTrigger>
                <TabsTrigger value="open" className="text-[10px] sm:text-xs">
                  Open
                </TabsTrigger>
                <TabsTrigger
                  value="in_progress"
                  className="text-[10px] sm:text-xs"
                >
                  Active
                </TabsTrigger>
                <TabsTrigger
                  value="resolved"
                  className="text-[10px] sm:text-xs"
                >
                  Done
                </TabsTrigger>
                <TabsTrigger value="closed" className="text-[10px] sm:text-xs">
                  Closed
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-4">
                <CardSkeleton cards={5} lines={1} />
              </div>
            ) : error ? (
              <p className="p-6 text-center text-sm text-red-500">{error}</p>
            ) : tickets.length === 0 ? (
              <p className="p-6 text-center text-sm text-slate-500">
                No tickets in this view.
              </p>
            ) : (
              tickets.map((ticket) => (
                <button
                  key={ticket.id}
                  onClick={() => {
                    setSelected(ticket)
                    setMobileView("chat")
                  }}
                  className={cn(
                    "w-full border-b border-slate-100 p-3 text-left transition-colors hover:bg-slate-50 sm:p-4 dark:border-slate-700 dark:hover:bg-slate-800/50",
                    selected?.id === ticket.id &&
                      "bg-slate-50 dark:bg-slate-800/50"
                  )}
                >
                  <div className="flex items-start gap-2 sm:gap-3">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#1e55be]/10 text-xs font-bold text-[#1e55be] uppercase sm:h-10 sm:w-10 dark:bg-[#1e55be]/20 dark:text-[#b2c5ff]">
                      {initials(ticket.member_name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <p className="truncate font-bold text-[#191c1e] dark:text-white">
                          {ticket.member_name}
                        </p>
                        <Badge
                          variant="outline"
                          className={`shrink-0 text-[9px] font-black uppercase ${statusStyles[ticket.status] ?? ""}`}
                        >
                          {ticket.status.replace("_", " ")}
                        </Badge>
                      </div>
                      <p className="truncate text-sm font-medium text-[#191c1e] dark:text-slate-200">
                        {ticket.subject}
                      </p>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {ticket.body}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </section>

        {/* Center: thread */}
        <section
          className={cn(
            "flex flex-1 flex-col bg-[#f7f9fb] dark:bg-[#060e20]",
            mobileView !== "chat" && "hidden lg:flex"
          )}
        >
          {selected ? (
            <>
              <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 sm:px-6 sm:py-4 dark:border-slate-700 dark:bg-[#0b1326]">
                <div className="flex items-center gap-2 sm:gap-3">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="lg:hidden"
                    onClick={() => setMobileView("inbox")}
                  >
                    <HugeiconsIcon icon={ArrowLeft01Icon} className="h-5 w-5" />
                  </Button>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1e55be]/10 text-xs font-bold text-[#1e55be] uppercase sm:h-10 sm:w-10 dark:bg-[#1e55be]/20 dark:text-[#b2c5ff]">
                    {initials(selected.member_name)}
                  </div>
                  <div>
                    <p className="font-bold text-[#191c1e] dark:text-white">
                      {selected.member_name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {selected.subject}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="xl:hidden"
                    onClick={() => setMobileView("context")}
                  >
                    <HugeiconsIcon
                      icon={InformationCircleIcon}
                      className="h-5 w-5"
                    />
                  </Button>
                </div>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto p-4 sm:space-y-4 sm:p-6">
                {/* Opening message */}
                <ThreadBubble
                  side="left"
                  name={selected.member_name}
                  body={selected.body}
                  time={selected.created_at}
                />
                {(selected.replies ?? []).map((r) => (
                  <ThreadBubble
                    key={r.id}
                    side={r.sender_type === "admin" ? "right" : "left"}
                    name={
                      r.sender_type === "admin" ? "You" : selected.member_name
                    }
                    body={r.body}
                    time={r.created_at}
                  />
                ))}
              </div>

              <div className="border-t border-slate-200 bg-white p-3 sm:p-4 dark:border-slate-700 dark:bg-[#0b1326]">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="relative flex-1">
                    <Input
                      type="text"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault()
                          handleReply()
                        }
                      }}
                      placeholder="Type your reply…"
                      className="rounded-full border-none bg-slate-100 pr-4 pl-4 focus-visible:ring-2 focus-visible:ring-[#1e55be]/20 dark:bg-slate-800"
                    />
                  </div>
                  <Button
                    size="icon"
                    onClick={handleReply}
                    disabled={sending || !replyText.trim()}
                    className="flex-shrink-0 rounded-full bg-[#1e55be] hover:bg-[#003d9a]"
                  >
                    <HugeiconsIcon icon={SentIcon} className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center">
                <HugeiconsIcon
                  icon={CustomerService01Icon}
                  className="mx-auto mb-3 h-12 w-12 text-slate-300 dark:text-slate-600"
                />
                <p className="text-slate-500 dark:text-slate-400">
                  Select a ticket to view the conversation.
                </p>
              </div>
            </div>
          )}
        </section>

        {/* Right: ticket context + status actions */}
        <section
          className={cn(
            "flex w-[280px] flex-col border-l border-slate-200 bg-white p-4 xl:w-[300px] xl:p-6 dark:border-slate-700 dark:bg-[#0b1326]",
            mobileView !== "context" && "hidden xl:flex"
          )}
        >
          <Button
            variant="ghost"
            className="mb-4 self-start xl:hidden"
            onClick={() => setMobileView("chat")}
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} className="mr-2 h-4 w-4" />
            Back to chat
          </Button>

          {selected ? (
            <div className="space-y-6">
              <div className="text-center">
                <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-[#1e55be]/10 text-xl font-bold text-[#1e55be] uppercase sm:h-20 sm:w-20 dark:bg-[#1e55be]/20 dark:text-[#b2c5ff]">
                  {initials(selected.member_name)}
                </div>
                <h3 className="font-bold text-[#191c1e] dark:text-white">
                  {selected.member_name}
                </h3>
                <Badge
                  variant="outline"
                  className={`mt-2 text-[10px] font-black uppercase ${statusStyles[selected.status] ?? ""}`}
                >
                  {selected.status.replace("_", " ")}
                </Badge>
              </div>

              <Card className="bg-slate-50 dark:bg-slate-800/50">
                <CardContent className="space-y-2 p-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Opened</span>
                    <span className="font-medium text-[#191c1e] dark:text-white">
                      {new Date(selected.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Replies</span>
                    <span className="font-medium text-[#191c1e] dark:text-white">
                      {selected.replies?.length ?? 0}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-2">
                <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                  Update Status
                </p>
                <Button
                  onClick={() => handleStatus("resolved")}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  Mark Resolved
                </Button>
                <Button
                  onClick={() => handleStatus("closed")}
                  variant="outline"
                  className="w-full"
                >
                  Close Ticket
                </Button>
                <Button
                  onClick={() => handleStatus("in_progress")}
                  variant="outline"
                  className="w-full"
                >
                  Mark In Progress
                </Button>
              </div>
            </div>
          ) : (
            <div className="py-10 text-center">
              <HugeiconsIcon
                icon={InformationCircleIcon}
                className="mx-auto mb-3 h-12 w-12 text-slate-300 dark:text-slate-600"
              />
              <p className="text-slate-500 dark:text-slate-400">
                Select a ticket to see its details.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function ThreadBubble({
  side,
  name,
  body,
  time,
}: {
  side: "left" | "right"
  name: string
  body: string
  time: string
}) {
  const isRight = side === "right"
  return (
    <div
      className={cn(
        "flex items-start gap-2 sm:gap-3",
        isRight && "flex-row-reverse"
      )}
    >
      <div
        className={cn(
          "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold uppercase sm:h-8 sm:w-8",
          isRight
            ? "bg-gradient-to-br from-[#1e55be] to-[#003d9a] text-white"
            : "bg-[#1e55be]/10 text-[#1e55be] dark:bg-[#1e55be]/20 dark:text-[#b2c5ff]"
        )}
      >
        {isRight ? (
          <HugeiconsIcon icon={CustomerService01Icon} className="h-4 w-4" />
        ) : (
          initials(name)
        )}
      </div>
      <div className="max-w-[80%] sm:max-w-[70%]">
        <Card
          className={cn(
            "border-none shadow-sm",
            isRight
              ? "rounded-2xl rounded-tr-none bg-[#1e55be]"
              : "rounded-2xl rounded-tl-none"
          )}
        >
          <CardContent className="p-3 sm:p-4">
            <p
              className={cn(
                "text-sm",
                isRight ? "text-white" : "text-[#191c1e] dark:text-white"
              )}
            >
              {body}
            </p>
          </CardContent>
        </Card>
        <span
          className={cn(
            "mt-1 block text-xs text-slate-400",
            isRight && "text-right"
          )}
        >
          {new Date(time).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </div>
  )
}
