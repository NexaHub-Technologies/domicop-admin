import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { authApi } from "../../lib/api/auth"
import {
  useAdmins,
  useCreateAdmin,
  useRevokeAdmin,
  useSetOfficerRole,
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from "../../lib/queries"
import { ApiError } from "../../lib/http"
import { useAuth } from "../../providers/auth-provider"
import type { AdminProfile, CreateAdminInput } from "../../lib/types/admins"
import type { NotificationPreferences } from "../../lib/types/notifications"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CardSkeleton } from "@/components/ui/table-skeleton"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Settings01Icon,
  SecurityIcon,
  UserGroupIcon,
  Shield01Icon,
  UserAdd01Icon,
  Delete01Icon,
  CheckmarkCircle02Icon,
  CancelSquareIcon,
} from "@hugeicons/core-free-icons"

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
})

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"

function SettingsPage() {
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
          System Configuration
        </span>
        <h2 className="text-2xl font-extrabold tracking-tight text-[#191c1e] sm:text-3xl dark:text-white">
          Settings
        </h2>
      </div>

      <Tabs defaultValue="account" className="w-full">
        <TabsList className="mb-4 flex h-auto flex-wrap justify-start gap-1 bg-transparent p-0 sm:mb-6 sm:grid sm:w-fit sm:grid-cols-3">
          <TabsTrigger
            value="account"
            className="data-[state=active]:bg-[#1e55be]/10 data-[state=active]:text-[#1e55be] dark:data-[state=active]:bg-[#1e55be]/20 dark:data-[state=active]:text-[#b2c5ff]"
          >
            <HugeiconsIcon icon={SecurityIcon} className="mr-2 h-4 w-4" />
            Account
          </TabsTrigger>
          <TabsTrigger
            value="admins"
            className="data-[state=active]:bg-[#1e55be]/10 data-[state=active]:text-[#1e55be] dark:data-[state=active]:bg-[#1e55be]/20 dark:data-[state=active]:text-[#b2c5ff]"
          >
            <HugeiconsIcon icon={UserGroupIcon} className="mr-2 h-4 w-4" />
            Administrators
          </TabsTrigger>
          <TabsTrigger
            value="notifications"
            className="data-[state=active]:bg-[#1e55be]/10 data-[state=active]:text-[#1e55be] dark:data-[state=active]:bg-[#1e55be]/20 dark:data-[state=active]:text-[#b2c5ff]"
          >
            <HugeiconsIcon icon={Settings01Icon} className="mr-2 h-4 w-4" />
            Notifications
          </TabsTrigger>
        </TabsList>

        <TabsContent value="account" className="mt-0">
          <ChangePasswordCard showToast={showToast} />
        </TabsContent>
        <TabsContent value="admins" className="mt-0">
          <AdminsCard showToast={showToast} />
        </TabsContent>
        <TabsContent value="notifications" className="mt-0">
          <NotificationsCard showToast={showToast} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function ChangePasswordCard({
  showToast,
}: {
  showToast: (m: string, t: "success" | "error") => void
}) {
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (next !== confirm) {
      showToast("New passwords do not match.", "error")
      return
    }
    setSaving(true)
    try {
      await authApi.changePassword({
        current_password: current,
        new_password: next,
      })
      showToast("Password changed.", "success")
      setCurrent("")
      setNext("")
      setConfirm("")
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "Failed to change password",
        "error"
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle className="text-lg sm:text-xl">Change Password</CardTitle>
        <CardDescription>Update your admin account password.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">
              Current Password
            </label>
            <input
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              required
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">
              New Password
            </label>
            <input
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              required
              minLength={8}
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">
              Confirm New Password
            </label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={8}
              className={inputCls}
            />
          </div>
          <Button
            type="submit"
            disabled={saving}
            className="bg-gradient-to-br from-[#1e55be] to-[#003d9a] text-white"
          >
            {saving ? "Saving…" : "Update Password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function AdminsCard({
  showToast,
}: {
  showToast: (m: string, t: "success" | "error") => void
}) {
  const { user } = useAuth()
  const adminsQuery = useAdmins()
  const admins = adminsQuery.data ?? []
  const loading = adminsQuery.isPending
  const error = adminsQuery.error
    ? adminsQuery.error instanceof Error
      ? adminsQuery.error.message
      : "Failed to load admins"
    : null
  const createAdmin = useCreateAdmin()
  const setOffice = useSetOfficerRole()
  const revokeAdmin = useRevokeAdmin()
  const [showForm, setShowForm] = useState(false)

  const handleCreate = (input: CreateAdminInput) =>
    createAdmin.mutate(input, {
      onSuccess: () => {
        showToast(`Admin ${input.full_name} created.`, "success")
        setShowForm(false)
      },
      onError: (err) =>
        showToast(
          err instanceof ApiError ? err.message : "Failed to create admin",
          "error"
        ),
    })

  // The Secretary and President are the two signatures on a loan (Part C), so
  // this is what makes loan approval possible at all.
  const handleSetOffice = (
    admin: AdminProfile,
    officer_role: "secretary" | "president" | null
  ) =>
    setOffice.mutate(
      { id: admin.id, officer_role },
      {
        onSuccess: () =>
          showToast(
            officer_role
              ? `${admin.full_name} is now the ${officer_role}.`
              : `Cleared ${admin.full_name}'s office.`,
            "success"
          ),
        onError: (err) =>
          showToast(
            err instanceof ApiError
              ? err.message
              : "Failed to change the office",
            "error"
          ),
      }
    )

  const handleRevoke = (admin: AdminProfile) =>
    revokeAdmin.mutate(admin.id, {
      onSuccess: () => showToast(`Revoked ${admin.full_name}.`, "success"),
      onError: (err) =>
        showToast(
          err instanceof ApiError ? err.message : "Failed to revoke",
          "error"
        ),
    })

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg sm:text-xl">Administrators</CardTitle>
          <CardDescription>
            Admin access is granted here — never by editing a member&apos;s
            role.
          </CardDescription>
        </div>
        <Button onClick={() => setShowForm(true)} size="sm">
          <HugeiconsIcon icon={UserAdd01Icon} className="mr-1 h-4 w-4" />
          Add Admin
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <CardSkeleton cards={3} lines={1} />
        ) : error ? (
          <p className="py-6 text-center text-red-500">{error}</p>
        ) : (
          <div className="space-y-3">
            {admins.map((a) => {
              const isSelf = a.id === user?.id
              return (
                <div
                  key={a.id}
                  className="flex items-center justify-between rounded-lg bg-slate-50 p-3 sm:p-4 dark:bg-slate-800/50"
                >
                  <div className="flex items-center gap-3">
                    <HugeiconsIcon
                      icon={Shield01Icon}
                      className="h-5 w-5 text-[#1e55be] dark:text-[#b2c5ff]"
                    />
                    <div>
                      <p className="font-medium text-[#191c1e] dark:text-white">
                        {a.full_name}
                        {a.is_super_admin && (
                          <span className="ml-2 rounded bg-[#1e55be]/10 px-1.5 py-0.5 text-[10px] font-bold text-[#1e55be] dark:text-[#b2c5ff]">
                            SUPER
                          </span>
                        )}
                        {a.officer_role && (
                          <span className="ml-2 rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-bold text-green-700 uppercase dark:bg-green-900/30 dark:text-green-400">
                            {a.officer_role}
                          </span>
                        )}
                        {isSelf && (
                          <span className="ml-2 text-xs text-slate-400">
                            (you)
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {a.email}
                      </p>
                      <label className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                        Office:
                        <select
                          value={a.officer_role ?? ""}
                          onChange={(e) =>
                            handleSetOffice(
                              a,
                              (e.target.value || null) as
                                | "secretary"
                                | "president"
                                | null
                            )
                          }
                          className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        >
                          <option value="">None</option>
                          <option value="secretary">Secretary</option>
                          <option value="president">President</option>
                        </select>
                      </label>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRevoke(a)}
                    disabled={isSelf}
                    title={
                      isSelf ? "You cannot revoke yourself" : "Revoke access"
                    }
                    className="p-2 text-slate-400 transition-colors hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <HugeiconsIcon icon={Delete01Icon} className="h-5 w-5" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>

      {showForm && (
        <AddAdminModal
          onClose={() => setShowForm(false)}
          onSubmit={handleCreate}
        />
      )}
    </Card>
  )
}

function AddAdminModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void
  onSubmit: (input: CreateAdminInput) => void
}) {
  const [form, setForm] = useState<CreateAdminInput>({
    email: "",
    password: "",
    full_name: "",
    phone: "",
  })

  const set = (k: keyof CreateAdminInput, v: string) =>
    setForm((prev) => ({ ...prev, [k]: v }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.email || form.password.length < 8 || form.full_name.length < 2)
      return
    onSubmit(form)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-[#0b1326]">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-[#191c1e] dark:text-white">
            Add Administrator
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
              Full Name
            </label>
            <input
              type="text"
              value={form.full_name}
              onChange={(e) => set("full_name", e.target.value)}
              required
              minLength={2}
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">
              Email
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              required
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">
              Password (min 8)
            </label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              required
              minLength={8}
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">
              Phone (optional)
            </label>
            <input
              type="tel"
              value={form.phone ?? ""}
              onChange={(e) => set("phone", e.target.value)}
              className={inputCls}
            />
          </div>
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
              Add Admin
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function NotificationsCard({
  showToast,
}: {
  showToast: (m: string, t: "success" | "error") => void
}) {
  const prefsQuery = useNotificationPreferences()
  const prefs = prefsQuery.data ?? null
  const loading = prefsQuery.isPending
  const error = prefsQuery.error
    ? prefsQuery.error instanceof Error
      ? prefsQuery.error.message
      : "Failed to load preferences"
    : null
  const updatePrefs = useUpdateNotificationPreferences()
  const saving = updatePrefs.isPending

  // Query writes the new value into the cache on success and refetches on
  // failure, so the toggle never keeps a setting the server rejected.
  const save = (updated: NotificationPreferences) =>
    updatePrefs.mutate(
      {
        push_enabled: updated.push_enabled,
        categories: updated.categories,
      },
      {
        onError: (err) =>
          showToast(
            err instanceof ApiError
              ? err.message
              : "Failed to save preferences",
            "error"
          ),
      }
    )

  if (loading) {
    return (
      <Card className="max-w-lg">
        <CardContent className="py-6">
          <CardSkeleton cards={1} lines={4} />
        </CardContent>
      </Card>
    )
  }
  if (error || !prefs) {
    return (
      <Card className="max-w-lg">
        <CardContent className="py-8 text-center text-red-500">
          {error ?? "Preferences unavailable."}
        </CardContent>
      </Card>
    )
  }

  const categoryKeys = Object.keys(prefs.categories) as Array<
    keyof NotificationPreferences["categories"]
  >

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle className="text-lg sm:text-xl">
          Notification Preferences
        </CardTitle>
        <CardDescription>
          Control which notifications you receive{saving ? " · saving…" : ""}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-xl border border-slate-200 p-3 sm:p-4 dark:border-slate-700">
          <div>
            <p className="font-bold text-[#191c1e] dark:text-white">
              Push Notifications
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Master switch for push delivery
            </p>
          </div>
          <Switch
            checked={prefs.push_enabled}
            onCheckedChange={(checked) =>
              save({ ...prefs, push_enabled: checked })
            }
          />
        </div>

        <div className="space-y-2">
          {categoryKeys.map((key) => (
            <div
              key={key}
              className="flex items-center justify-between rounded-lg bg-slate-50 p-3 capitalize dark:bg-slate-800/50"
            >
              <span className="font-medium text-[#191c1e] dark:text-white">
                {key}
              </span>
              <Switch
                checked={prefs.categories[key]}
                onCheckedChange={(checked) =>
                  save({
                    ...prefs,
                    categories: { ...prefs.categories, [key]: checked },
                  })
                }
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
