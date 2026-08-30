import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { notificationsApi } from "../../lib/api/notifications"
import { ApiError } from "../../lib/http"
import type {
  Announcement,
  CreateAnnouncementInput,
} from "../../lib/types/announcements"
import type { BroadcastNotificationInput } from "../../lib/types/notifications"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CardSkeleton } from "@/components/ui/table-skeleton"
import {
  useAnnouncements,
  useCreateAnnouncement,
  useUpdateAnnouncement,
  useDeleteAnnouncement,
} from "../../lib/queries"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Megaphone01Icon,
  Delete01Icon,
  PencilEdit01Icon,
  CheckmarkCircle02Icon,
  CancelSquareIcon,
} from "@hugeicons/core-free-icons"

export const Route = createFileRoute("/_authenticated/announcements")({
  component: AnnouncementsPage,
})

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"

function AnnouncementsPage() {
  const [tab, setTab] = useState<"announcements" | "broadcast">("announcements")
  const [toast, setToast] = useState<{
    message: string
    type: "success" | "error"
  } | null>(null)

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
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

      <div>
        <span className="mb-2 block text-xs font-bold tracking-[0.2em] text-[#003d9a] uppercase dark:text-[#b2c5ff]">
          Outreach
        </span>
        <h2 className="text-2xl font-extrabold tracking-tight text-[#191c1e] sm:text-3xl dark:text-white">
          Announcements & Broadcast
        </h2>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="announcements">Announcements</TabsTrigger>
          <TabsTrigger value="broadcast">Push Broadcast</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "announcements" ? (
        <AnnouncementsTab showToast={showToast} />
      ) : (
        <BroadcastTab showToast={showToast} />
      )}
    </div>
  )
}

// --- Announcements tab (§8) ---
function AnnouncementsTab({
  showToast,
}: {
  showToast: (m: string, t: "success" | "error") => void
}) {
  const announcementsQuery = useAnnouncements()
  const items = announcementsQuery.data ?? []
  const loading = announcementsQuery.isPending
  const error = announcementsQuery.error
    ? announcementsQuery.error instanceof Error
      ? announcementsQuery.error.message
      : "Failed to load announcements"
    : null

  const createAnnouncement = useCreateAnnouncement()
  const updateAnnouncement = useUpdateAnnouncement()
  const deleteAnnouncement = useDeleteAnnouncement()
  const isPending = (id: string) =>
    (updateAnnouncement.isPending && updateAnnouncement.variables?.id === id) ||
    (deleteAnnouncement.isPending && deleteAnnouncement.variables === id)
  const [editing, setEditing] = useState<Announcement | null>(null)
  const [showForm, setShowForm] = useState(false)

  const handleCreate = (input: CreateAnnouncementInput) =>
    createAnnouncement.mutate(input, {
      onSuccess: () => {
        showToast(
          input.published
            ? "Published and broadcast to members."
            : "Draft saved.",
          "success"
        )
        setShowForm(false)
      },
      onError: (err) =>
        showToast(
          err instanceof ApiError ? err.message : "Failed to create",
          "error"
        ),
    })

  const handleUpdate = (id: string, input: CreateAnnouncementInput) =>
    updateAnnouncement.mutate(
      { id, data: input },
      {
        onSuccess: () => {
          showToast("Announcement updated.", "success")
          setEditing(null)
        },
        onError: (err) =>
          showToast(
            err instanceof ApiError ? err.message : "Failed to update",
            "error"
          ),
      }
    )

  // The badge flips the instant it is pressed — the outcome is entirely
  // predictable, so making the admin wait a round trip to see it buys nothing.
  // Query snapshots the list in onMutate and restores it if the server refuses.
  const handleTogglePublish = (a: Announcement) =>
    updateAnnouncement.mutate(
      { id: a.id, data: { published: !a.published } },
      {
        onSuccess: () =>
          showToast(
            a.published
              ? "Unpublished."
              : "Published and broadcast to members.",
            "success"
          ),
        onError: (err) =>
          showToast(
            err instanceof ApiError ? err.message : "Failed to update",
            "error"
          ),
      }
    )

  const handleDelete = (id: string) =>
    deleteAnnouncement.mutate(id, {
      onSuccess: () => showToast("Announcement deleted.", "success"),
      onError: (err) =>
        showToast(
          err instanceof ApiError ? err.message : "Failed to delete",
          "error"
        ),
    })

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={() => setShowForm(true)}
          className="bg-gradient-to-br from-[#1e55be] to-[#003d9a] text-white"
        >
          <HugeiconsIcon icon={Megaphone01Icon} className="mr-2 h-4 w-4" />
          New Announcement
        </Button>
      </div>

      {loading ? (
        <CardSkeleton cards={3} lines={2} />
      ) : error ? (
        <p className="py-8 text-center text-red-500">{error}</p>
      ) : items.length === 0 ? (
        <p className="py-8 text-center text-slate-500">No announcements yet.</p>
      ) : (
        <div className="space-y-3">
          {items.map((a) => (
            <Card
              key={a.id}
              className={
                isPending(a.id)
                  ? "opacity-60 transition-opacity"
                  : "transition-opacity"
              }
            >
              <CardContent className="flex items-start justify-between gap-4 p-4 sm:p-6">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <h3 className="truncate font-bold text-[#191c1e] dark:text-white">
                      {a.title}
                    </h3>
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-black uppercase ${
                        a.published
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
                      }`}
                    >
                      {a.published ? "Published" : "Draft"}
                    </Badge>
                  </div>
                  <p className="line-clamp-2 text-sm text-slate-600 dark:text-slate-400">
                    {a.body}
                  </p>
                  <p className="mt-2 text-xs text-slate-400">
                    {new Date(a.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleTogglePublish(a)}
                    disabled={isPending(a.id)}
                    className="text-xs"
                  >
                    {a.published ? "Unpublish" : "Publish"}
                  </Button>
                  <button
                    onClick={() => setEditing(a)}
                    className="p-2 text-slate-400 hover:text-[#003d9a] dark:hover:text-[#b2c5ff]"
                  >
                    <HugeiconsIcon
                      icon={PencilEdit01Icon}
                      className="h-5 w-5"
                    />
                  </button>
                  <button
                    onClick={() => handleDelete(a.id)}
                    disabled={isPending(a.id)}
                    className="p-2 text-slate-400 hover:text-red-500 disabled:opacity-40"
                  >
                    <HugeiconsIcon icon={Delete01Icon} className="h-5 w-5" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {(showForm || editing) && (
        <AnnouncementFormModal
          announcement={editing ?? undefined}
          onClose={() => {
            setShowForm(false)
            setEditing(null)
          }}
          onSubmit={(input) =>
            editing ? handleUpdate(editing.id, input) : handleCreate(input)
          }
        />
      )}
    </div>
  )
}

function AnnouncementFormModal({
  announcement,
  onClose,
  onSubmit,
}: {
  announcement?: Announcement
  onClose: () => void
  onSubmit: (input: CreateAnnouncementInput) => void
}) {
  const [title, setTitle] = useState(announcement?.title ?? "")
  const [body, setBody] = useState(announcement?.body ?? "")
  const [published, setPublished] = useState(announcement?.published ?? false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || body.trim().length < 10) return
    onSubmit({ title, body, published })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl dark:bg-[#0b1326]">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-[#191c1e] dark:text-white">
            {announcement ? "Edit Announcement" : "New Announcement"}
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
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">
              Body (min 10 chars)
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              minLength={10}
              rows={5}
              className={inputCls}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={published}
              onChange={(e) => setPublished(e.target.checked)}
              className="h-4 w-4"
            />
            <span className="text-slate-600 dark:text-slate-300">
              Publish now (broadcasts to all active members)
            </span>
          </label>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-200 bg-slate-50 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 rounded-lg bg-[#003d9a] py-2 text-sm font-bold text-white hover:brightness-110"
            >
              {announcement ? "Save" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// --- Broadcast tab (§10) ---
function BroadcastTab({
  showToast,
}: {
  showToast: (m: string, t: "success" | "error") => void
}) {
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [type, setType] =
    useState<NonNullable<BroadcastNotificationInput["type"]>>("meeting")
  const [actionLabel, setActionLabel] = useState("")
  const [actionUrl, setActionUrl] = useState("")
  const [sending, setSending] = useState(false)

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !body.trim()) return
    setSending(true)
    try {
      const payload: BroadcastNotificationInput = { title, body, type }
      if (actionLabel && actionUrl) {
        payload.action = { label: actionLabel, url: actionUrl }
      }
      const res = await notificationsApi.broadcast(payload)
      showToast(`Broadcast delivered to ${res.sent} members.`, "success")
      setTitle("")
      setBody("")
      setActionLabel("")
      setActionUrl("")
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "Failed to send broadcast",
        "error"
      )
    } finally {
      setSending(false)
    }
  }

  return (
    <Card className="max-w-2xl">
      <CardContent className="p-6">
        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
          Sends an in-app + push notification to all active members. Members
          without a device token still receive the in-app inbox entry.
        </p>
        <form onSubmit={handleSend} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">
              Message
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              rows={4}
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">
              Category
            </label>
            <select
              value={type}
              onChange={(e) =>
                setType(
                  e.target.value as NonNullable<
                    BroadcastNotificationInput["type"]
                  >
                )
              }
              className={inputCls}
            >
              <option value="meeting">Meeting</option>
              <option value="contribution">Contribution</option>
              <option value="loan">Loan</option>
              <option value="dividend">Dividend</option>
              <option value="security">Security</option>
            </select>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">
                Action Label (optional)
              </label>
              <input
                type="text"
                value={actionLabel}
                onChange={(e) => setActionLabel(e.target.value)}
                placeholder="View"
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">
                Action Path (optional)
              </label>
              <input
                type="text"
                value={actionUrl}
                onChange={(e) => setActionUrl(e.target.value)}
                placeholder="/contributions"
                className={inputCls}
              />
            </div>
          </div>
          <Button
            type="submit"
            disabled={sending || !title.trim() || !body.trim()}
            className="w-full bg-gradient-to-br from-[#1e55be] to-[#003d9a] text-white disabled:opacity-50"
          >
            <HugeiconsIcon icon={Megaphone01Icon} className="mr-2 h-4 w-4" />
            {sending ? "Sending…" : "Send Broadcast"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
