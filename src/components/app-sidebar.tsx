"use client"

import { Link, useLocation, useRouter } from "@tanstack/react-router"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  DashboardSquare01Icon,
  UserGroupIcon,
  MoneySend01Icon,
  BankIcon,
  Message02Icon,
  Settings01Icon,
  Logout01Icon,
  AddCircleIcon,
  Sun01Icon,
  Moon02Icon,
  Coins01Icon,
  Megaphone01Icon,
  UserAdd01Icon,
} from "@hugeicons/core-free-icons"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "./ui/sidebar"
import { useAuth } from "../providers/auth-provider"
import { useTheme } from "../providers/theme-provider"
import { Logo } from "./logo"

const navItems = [
  { label: "Dashboard", path: "/dashboard", icon: DashboardSquare01Icon },
  { label: "Members", path: "/members", icon: UserGroupIcon },
  { label: "Registration", path: "/registration", icon: UserAdd01Icon },
  { label: "Contributions", path: "/contributions", icon: MoneySend01Icon },
  { label: "Loans", path: "/loans", icon: BankIcon },
  { label: "Dividends", path: "/dividends", icon: Coins01Icon },
  { label: "Communications", path: "/communications", icon: Message02Icon },
  { label: "Announcements", path: "/announcements", icon: Megaphone01Icon },
  { label: "Settings", path: "/settings", icon: Settings01Icon },
]

export function AppSidebar() {
  const { logout } = useAuth()
  const { resolvedTheme, setTheme } = useTheme()
  const location = useLocation()
  const router = useRouter()

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark")
  }

  const handleLogout = async () => {
    await logout()
    router.navigate({ to: "/login" })
  }

  return (
    <Sidebar collapsible="icon" className="[&_svg]:!size-[18px]">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="data-open:bg-sidebar-accent data-open:text-sidebar-accent-foreground"
            >
              <Logo className="size-9" />
              <div className="grid flex-1 text-left text-base leading-tight">
                <span className="truncate font-semibold">DOMICOOP</span>
                <span className="truncate text-sm text-muted-foreground">
                  Cooperative Society
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-4">
              {navItems.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname.startsWith(item.path)}
                    className="text-base"
                  >
                    <Link to={item.path} activeOptions={{ exact: false }}>
                      <HugeiconsIcon icon={item.icon} />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={toggleTheme} className="text-base">
              <HugeiconsIcon
                icon={resolvedTheme === "dark" ? Sun01Icon : Moon02Icon}
              />
              <span>
                {resolvedTheme === "dark" ? "Light Mode" : "Dark Mode"}
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="text-base">
              <button type="button">
                <HugeiconsIcon icon={AddCircleIcon} />
                <span>New Report</span>
              </button>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout} className="text-base">
              <HugeiconsIcon icon={Logout01Icon} />
              <span>Sign Out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
