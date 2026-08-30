import {
  createFileRoute,
  Outlet,
  redirect,
  useNavigate,
} from "@tanstack/react-router"
import { useEffect } from "react"
import { getStoredAuth } from "../lib/auth-storage"
import { useAuth } from "../providers/auth-provider"
import { useTheme } from "../providers/theme-provider"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Search01Icon,
  HelpCircleIcon,
  Sun01Icon,
  Moon02Icon,
} from "@hugeicons/core-free-icons"

import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "../components/ui/sidebar"
import { AppSidebar } from "../components/app-sidebar"
import { NotificationBell } from "../components/notification-bell"

export const Route = createFileRoute("/_authenticated")({
  // The session lives in localStorage, so the guard must run on the client.
  // ssr:false keeps this subtree client-only; reading getStoredAuth() directly
  // (rather than the root's server-computed context) means a hard refresh sees
  // the real session instead of bouncing to /login.
  ssr: false,
  beforeLoad: () => {
    if (!getStoredAuth().isAuthenticated) {
      throw redirect({ to: "/login" })
    }
  },
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
  const { user, isLoading } = useAuth()
  const { resolvedTheme, setTheme } = useTheme()
  const navigate = useNavigate()

  // beforeLoad only runs on navigation. When a session dies mid-page — an
  // expired refresh token — nothing navigates, so without this the admin sits
  // on a dashboard where every panel errors and no link takes them anywhere.
  useEffect(() => {
    if (!isLoading && !user) navigate({ to: "/login" })
  }, [isLoading, user, navigate])

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark")
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between border-b bg-background px-4 lg:px-6">
          <div className="flex items-center gap-4">
            <SidebarTrigger className="-ml-1" />
            <div className="relative max-w-xl flex-1">
              <HugeiconsIcon
                icon={Search01Icon}
                className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="text"
                placeholder="Search..."
                className="w-full rounded-full border-0 bg-muted py-2 pr-4 pl-10 text-sm text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary/40 sm:w-64 lg:w-80"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-6">
            <div className="flex items-center gap-1 sm:gap-4">
              <button
                onClick={toggleTheme}
                className="rounded-full p-2 text-muted-foreground transition-all hover:bg-accent active:scale-95"
              >
                <HugeiconsIcon
                  icon={resolvedTheme === "dark" ? Sun01Icon : Moon02Icon}
                  className="size-4 sm:size-5"
                />
              </button>
              <NotificationBell />
              <button className="hidden rounded-full p-2 text-muted-foreground transition-all hover:bg-accent active:scale-95 sm:block">
                <HugeiconsIcon icon={HelpCircleIcon} className="size-5" />
              </button>
            </div>

            <div className="ml-1 flex items-center gap-2 sm:ml-2 sm:gap-3">
              <img
                src={
                  user?.avatar_url ||
                  "https://api.dicebear.com/7.x/avataaars/svg?seed=admin"
                }
                alt="Administrator Profile"
                className="size-7 rounded-full border sm:size-8"
              />
              <span className="hidden text-sm font-semibold sm:block">
                {user?.name || "Admin"}
              </span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-background">
          <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
            <Outlet />
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
