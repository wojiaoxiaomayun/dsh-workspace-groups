/**
 * The flower branch: an SVG overlay that draws one continuous curly stem down
 * the sidebar tree, growing to the row you are currently on.
 *
 * Ported from the RewampUI *Flower Sidebar* reference. The mechanism, verified
 * against that page's live DOM:
 *
 *   - TWO paths share one `d` prefix: a **ghost** (dashed, faded) drawing the
 *     whole route, and a **grown** solid stroke drawn only as far as the active
 *     row. The grown one is what makes the branch look like it grew to you.
 *   - A **dot per row**, sitting exactly on the curve. The active one is larger
 *     and accent-coloured (a "bloom").
 *   - The whole SVG is `pointer-events: none` and `overflow: visible`, so it is
 *     pure decoration over the real rows and never intercepts a click.
 *
 * Measurement, not layout: the rows are rendered by the tree itself (they carry
 * drag handlers, menus and hover state), so this component reads each row's
 * vertical centre from the DOM and feeds plain numbers to `buildBranch`. That
 * keeps the geometry unit-tested (`branch.ts`) while the SVG stays a dumb
 * renderer of it.
 *
 * Re-measured on: row count changes (expand/collapse, new session), the active
 * row changing, and container resize. A `ResizeObserver` on the scroll body
 * covers the last one without a window listener.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { buildBranch, type Branch, type BranchRow } from './branch.ts'

/**
 * Attribute the tree puts on every row the branch should connect. */
export const BRANCH_ROW_ATTRIBUTE = 'data-wg-branch-row'

/**
 * Attribute marking the row the stem should grow to.
 *
 * Only the DEEPEST row gets this (the session). Its ancestors — the project and
 * the category that contain it — deliberately do NOT, because a session belongs
 * to both and marking all three would make "which row is active?" ambiguous.
 * When several rows do carry it, the deepest (last in document order) wins.
 */
export const BRANCH_ACTIVE_ATTRIBUTE = 'data-wg-branch-active'

/** Row kind marker: a group boundary kinks the stem. */
export const BRANCH_GROUP_ATTRIBUTE = 'data-wg-branch-group'

/**
 * Render the branch for the rows currently inside `scope`.
 * @param props - the element to measure, and a key that changes when the layout does.
 * @returns the SVG overlay, or null until at least one row is measured.
 */
export function FlowerBranch({ scope }: { scope: HTMLElement | null }) {
  const [rows, setRows] = useState<BranchRow[]>([])

  // A cheap change key: the caller cannot tell us when a row expanded, so we
  // watch the attribute count and the active row instead of diffing every node.
  const measureKey = useRef('')
  // The measured pixel pitch is per-list, not the module default: our rows are
  // 28/30px tall in places, and assuming 32 would drift the dots off the rows.
  const [branch, setBranch] = useState<Branch | null>(null)

  useEffect(() => {
    if (scope === null) {
      setRows([])
      setBranch(null)
      return
    }

    const measure = (): void => {
      const nodes = Array.from(scope.querySelectorAll<HTMLElement>(`[${BRANCH_ROW_ATTRIBUTE}]`))
      const first = nodes[0]
      if (first === undefined) {
        if (measureKey.current !== '') {
          measureKey.current = ''
          setRows([])
          setBranch(null)
        }
        return
      }

      // Exactly one row carries the marker (the session); if a caller ever marks
      // several, the deepest wins so the stem still lands on a real leaf.
      const activeIndex = nodes.reduce(
        (found, node, index) => (node.hasAttribute(BRANCH_ACTIVE_ATTRIBUTE) ? index : found),
        -1,
      )
      const kinds = nodes.map(n => (n.hasAttribute(BRANCH_GROUP_ATTRIBUTE) ? 'group' : 'item')).join('')
      const key = `${nodes.length}|${activeIndex}|${kinds}|${Math.round(scope.clientWidth)}`
      if (key === measureKey.current) return
      measureKey.current = key

      // Each row carries its OWN measured anchor: y because the tree mixes row
      // heights, x because it indents per row via padding (a folder's chevron and
      // a session's text do not share an x).
      const measured: BranchRow[] = nodes.map((node, index) => ({
        key: `${index}`,
        y: center(node),
        x: anchorX(node),
        kind: node.hasAttribute(BRANCH_GROUP_ATTRIBUTE) ? 'group' : 'item',
        active: index === activeIndex,
      }))

      setRows(measured)
      setBranch(buildBranch(measured))
    }

    /** Vertical centre of a node, relative to the scope box. */
    function center(node: HTMLElement): number {
      const r = node.getBoundingClientRect()
      const s = (scope as HTMLElement).getBoundingClientRect()
      return r.top - s.top + r.height / 2
    }

    /**
     * Horizontal anchor of a row, relative to the scope box.
     *
     * A row with a chevron anchors to that triangle's CENTRE: it is the marker
     * the user already reads as "this row opens", so the stem hangs off it
     * instead of floating beside it. A chevron-less row (a session) has no
     * marker, so it anchors to where its own content starts — the status dot's
     * centre, which is the first thing in the row.
     */
    function anchorX(node: HTMLElement): number {
      const s = (scope as HTMLElement).getBoundingClientRect()
      const marker = node.querySelector('.wgChevron')
        ?? node.querySelector('[class*="wgStatusSlot"]')
        ?? node.querySelector('[class*="wgCategoryIcon"]')
        ?? node.querySelector('[class*="wgRowIcon"]')
      const box = (marker ?? node).getBoundingClientRect()
      return box.left - s.left + box.width / 2
    }

    measure()

    // Row set changes (expand/collapse/new session) arrive as childList edits.
    const observer = new MutationObserver(measure)
    observer.observe(scope, { childList: true, subtree: true, attributes: true, attributeFilter: [BRANCH_ACTIVE_ATTRIBUTE] })

    // Width changes reflow row heights in the rail/wide layouts.
    const resizer = new ResizeObserver(measure)
    resizer.observe(scope)

    return () => {
      observer.disconnect()
      resizer.disconnect()
    }
  }, [scope])

  // Dots are rendered from the measured rows; keep the memo keyed on identity so
  // a re-render with the same branch does not rebuild the element list.
  const dots = useMemo(() => branch?.dots ?? [], [branch])

  if (branch === null || rows.length === 0) return null

  return (
    <svg
      className="wgBranch"
      // The box covers the measured span; `overflow: visible` lets the kink draw
      // outside it without clipping (the reference does the same).
      width={48}
      height={Math.max(1, Math.ceil(branch.height))}
      viewBox={`0 0 48 ${Math.max(1, Math.ceil(branch.height))}`}
      aria-hidden="true"
      focusable="false"
    >
      <path className="wgBranchGhost" d={branch.ghostPath} />
      <path className="wgBranchGrown" d={branch.grownPath} />
      {dots.map(dot => (
        <circle
          key={dot.key}
          className={dot.active ? 'wgBranchDot wgBranchDotActive' : 'wgBranchDot'}
          cx={dot.cx}
          cy={dot.cy}
          r={dot.active ? 3.2 : 2}
        />
      ))}
    </svg>
  )
}
