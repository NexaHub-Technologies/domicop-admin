import { defineConfig } from "vitest/config"
import viteReact from "@vitejs/plugin-react"
import viteTsConfigPaths from "vite-tsconfig-paths"

/**
 * Tests get their own config, deliberately.
 *
 * vite.config.ts loads `nitro()` and `tanstackStart()`, which stand up a
 * server runtime and a router build. Vitest inherited both, and rendering a
 * hook under them left React's dispatcher null ("Cannot read properties of
 * null (reading 'useState')") — there is only one React copy installed, so the
 * duplication people usually blame was not the cause.
 *
 * This keeps only what a unit test needs: the React transform and the path
 * aliases. Files that need a DOM opt in with `@vitest-environment jsdom`.
 */
export default defineConfig({
  plugins: [viteTsConfigPaths({ projects: ["./tsconfig.json"] }), viteReact()],
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
})
