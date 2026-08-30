import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router"
import { TooltipProvider } from "../components/ui/tooltip"
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools"
import { TanStackDevtools } from "@tanstack/react-devtools"

import { QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools"
import { getQueryClient } from "../lib/query-client"
import { ThemeProvider } from "../providers/theme-provider"
import { AuthProvider } from "../providers/auth-provider"
import { NotificationsProvider } from "../providers/notifications-provider"
import { getStoredAuth } from "../lib/auth-storage"
import appCss from "../styles.css?url"

export const Route = createRootRoute({
  notFoundComponent: NotFound,
  errorComponent: RootError,
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "DOMICOOP Admin",
        name: "description",
        content:
          "Dominion Co-operative is a thrift & credit society — members, contributions, loans and dividends, kept in balance and on the record.",
      },
    ],
    links: [
      { rel: "icon", href: "/favicon.ico" },
      {
        rel: "stylesheet",
        href: appCss,
      },
      {
        rel: "preconnect",
        href: "https://fonts.googleapis.com",
      },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&display=swap",
      },
    ],
  }),
  shellComponent: RootDocument,
  beforeLoad: () => {
    return { auth: getStoredAuth() }
  },
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <QueryClientProvider client={getQueryClient()}>
          <TooltipProvider>
            <ThemeProvider>
              <AuthProvider>
                <NotificationsProvider>{children}</NotificationsProvider>
              </AuthProvider>
            </ThemeProvider>
          </TooltipProvider>
        </QueryClientProvider>
        <TanStackDevtools
          config={{
            position: "bottom-right",
          }}
          plugins={[
            {
              name: "Tanstack Router",
              render: <TanStackRouterDevtoolsPanel />,
            },
            {
              name: "Tanstack Query",
              render: <ReactQueryDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}

function RootError() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#f7f9fb] px-4 dark:bg-[#060e20]">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-red-600">!</h1>
        <h2 className="mt-4 text-2xl font-bold text-[#191c1e] dark:text-white">
          Something went wrong
        </h2>
        <p className="mt-2 text-slate-500 dark:text-slate-400">
          An unexpected error occurred. Please try refreshing the page.
        </p>
        <a
          href="/"
          className="mt-6 inline-block rounded-lg bg-gradient-to-br from-[#1e55be] to-[#003d9a] px-6 py-3 font-bold text-white shadow-lg transition-transform hover:scale-105"
        >
          Go Home
        </a>
      </div>
    </div>
  )
}

function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#f7f9fb] px-4 dark:bg-[#060e20]">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-[#003d9a] dark:text-[#b2c5ff]">
          404
        </h1>
        <h2 className="mt-4 text-2xl font-bold text-[#191c1e] dark:text-white">
          Page Not Found
        </h2>
        <p className="mt-2 text-slate-500 dark:text-slate-400">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <a
          href="/"
          className="mt-6 inline-block rounded-lg bg-gradient-to-br from-[#1e55be] to-[#003d9a] px-6 py-3 font-bold text-white shadow-lg transition-transform hover:scale-105"
        >
          Go Home
        </a>
      </div>
    </div>
  )
}
