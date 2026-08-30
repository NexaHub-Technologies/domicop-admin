/**
 * Rendering needs a DOM.
 * @vitest-environment jsdom
 */
import { describe, it, expect, afterEach } from "vitest"
import { render, screen, within, cleanup, fireEvent } from "@testing-library/react"
import { createColumnHelper } from "@tanstack/react-table"
import { DataTable, dataTableFeatures } from "./data-table"

type Row = { id: string; name: string; amount: number }

const helper = createColumnHelper<typeof dataTableFeatures, Row>()
const columns = helper.columns([
  helper.accessor("name", { header: "Name" }),
  helper.accessor("amount", { header: "Amount" }),
])

const data: Row[] = [
  { id: "1", name: "Charlie", amount: 300 },
  { id: "2", name: "Alice", amount: 100 },
  { id: "3", name: "Bob", amount: 200 },
]

/** Body rows only — the header row is a <tr> too. */
function bodyNames() {
  const body = document.querySelector("tbody")!
  return within(body)
    .getAllByRole("row")
    .map((r) => r.querySelectorAll("td")[0]?.textContent)
}

// vitest is not running with `globals`, so Testing Library's automatic
// cleanup never registers — without this, each render stacks another table
// into the same document and every query matches twice.
afterEach(cleanup)

describe("DataTable (TanStack Table v9)", () => {
  it("renders rows through the v9 FlexRender path", () => {
    render(<DataTable columns={columns} data={data} />)
    expect(bodyNames()).toEqual(["Charlie", "Alice", "Bob"])
    expect(screen.getByText("Name")).toBeDefined()
  })

  it("sorts when a header is clicked, and reverses on a second click", () => {
    render(<DataTable columns={columns} data={data} />)
    const nameHeader = screen.getByText("Name").closest("button")!

    // fireEvent, not element.click(): fireEvent wraps the dispatch in act, so
    // React has flushed the sorting state before the assertion reads the DOM.
    fireEvent.click(nameHeader)
    expect(bodyNames()).toEqual(["Alice", "Bob", "Charlie"])

    fireEvent.click(nameHeader)
    expect(bodyNames()).toEqual(["Charlie", "Bob", "Alice"])
  })

  it("applies the global filter across columns", () => {
    render(<DataTable columns={columns} data={data} globalFilter="Ali" />)
    expect(bodyNames()).toEqual(["Alice"])
  })

  it("paginates only when it owns pagination", () => {
    const { unmount } = render(
      <DataTable columns={columns} data={data} pageSize={2} />,
    )
    expect(bodyNames()).toHaveLength(2)
    expect(screen.getByText(/Page 1 of 2/)).toBeDefined()
    unmount()

    // Server-paginated pages pass no pageSize: every row given must render,
    // and the client pager must stay out of the way.
    render(<DataTable columns={columns} data={data} />)
    expect(bodyNames()).toHaveLength(3)
    expect(screen.queryByText(/Page 1 of/)).toBeNull()
  })

  it("shows a skeleton while loading and the message when empty", () => {
    const { unmount } = render(
      <DataTable columns={columns} data={[]} loading />,
    )
    expect(document.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0)
    unmount()

    render(<DataTable columns={columns} data={[]} emptyMessage="Nothing here" />)
    expect(screen.getByText("Nothing here")).toBeDefined()
  })

  it("applies a per-row class, which is what the optimistic dimming rides on", () => {
    render(
      <DataTable
        columns={columns}
        data={data}
        rowClassName={(r) => (r.id === "2" ? "opacity-50" : "")}
      />,
    )
    const rows = within(document.querySelector("tbody")!).getAllByRole("row")
    expect(rows[1]!.className).toContain("opacity-50")
    expect(rows[0]!.className).not.toContain("opacity-50")
  })
})
