/**
 * The "flower branch" geometry for the sidebar tree.
 *
 * Reproduces the RewampUI *Flower Sidebar* mechanism: a single curly branch runs
 * down the left of the nav list, drawn as SVG so it can be *grown* — a faded
 * dashed ghost shows the whole route, and a solid stroke is drawn only as far as
 * the row you are on. Each row gets a dot sitting exactly on the curve, and the
 * active row's dot blooms.
 *
 * How it maps onto OUR tree (three levels: 分组 folder → 项目 folder → 会话 row):
 *
 *   - The branch is **one continuous path** through every visible row, not one
 *     rail per folder. That is what makes it read as a plant rather than as the
 *     per-folder rail it replaces.
 *   - The stem runs at `STEM_X`; at each **group boundary** it kinks outward to
 *     `BULGE_X` and back — a half-pitch out plus a half-pitch back, which is
 *     exactly the reference's 32px rhythm.
 *   - Rows that are not group boundaries sit on a straight run, one row pitch
 *     apart, each carrying a dot at its own y.
 *
 * Runtime-free on purpose (same discipline as `tabs.ts` / `store-core.ts`): the
 * component measures the DOM and hands plain numbers here, so the geometry is
 * unit-testable without a browser.
 */

/** Horizontal position of the stem's straight runs. */
/**
 * Default x for a row's anchor, in SVG coordinates.
 *
 * A fallback only: rows carry their OWN measured `x`, because the tree indents
 * with per-row padding rather than one shared origin. A folder's chevron and a
 * session's text sit at different x, and no single constant lands on both.
 */
export const STEM_X = 30

/** Default vertical pitch between two rows. */
export const ROW_PITCH = 32

/**
 * One row the branch must pass through.
 *
 * Both coordinates are MEASURED, not derived:
 * - `y` because the tree mixes row heights and inter-row gaps (deriving one
 *   pitch from a single gap drifted the dots up to 15px off their rows);
 * - `x` because the tree indents per row via padding, so a folder's chevron and
 *   a session's text are at different x.
 */
export interface BranchRow {
  /** Stable key, used to match a row to its dot. */
  readonly key: string
  /** Row centre y, in the SVG's coordinate space. */
  readonly y: number
  /**
   * Row anchor x, in the SVG's coordinate space.
   *
   * A folder row's anchor is its CHEVRON centre — the triangle the user already
   * reads as "this row opens" — so the stem visually hangs off the marker rather
   * than floating beside it. A session row's anchor is the indent its text sits
   * on.
   */
  readonly x: number
  /**
   * Row kind. A `'group'` row starts a new group and makes the stem kink;
   * an `'item'` row runs straight (or curves back in right after a group).
   */
  readonly kind: 'group' | 'item'
  /** Whether this is the row the user is currently on (the bloomed dot). */
  readonly active: boolean
}

/** A dot on the branch: one per row, positioned on the curve. */
export interface BranchDot {
  /** The row this dot belongs to. */
  readonly key: string
  readonly cx: number
  readonly cy: number
  readonly active: boolean
}

/** The branch: one path for the ghost, its total length, and the dots. */
export interface Branch {
  /** Full route, drawn as the faded dashed ghost. */
  readonly ghostPath: string
  /** Path up to and including the active row (the "grown" part). */
  readonly grownPath: string
  /** Drawn length of the full route. */
  readonly ghostLength: number
  /** Drawn length of the grown part. */
  readonly grownLength: number
  /** Dots, in row order. */
  readonly dots: readonly BranchDot[]
  /** Total vertical extent, so the SVG box can be sized. */
  readonly height: number
}

/** Internal: one straight or curved move, with the length it contributes. */
interface Segment {
  readonly d: string
  readonly length: number
}

/**
 * Plan the route: one segment per row after the first, plus the dot positions.
 *
 * Kept separate from the string assembly so the length walk and the SVG `d`
 * always describe the same geometry — measuring one path against another is how
 * a grown/ghost pair drifts out of sync.
 *
 * The stem lands on each row's OWN anchor (x) and centre (y), so uneven row
 * heights and the tree's per-row indents both stay exact. A group row's anchor
 * is pushed out by `BULGE_OFFSET`, which is what creates the kink.
 *
 * @param rows - visible rows in render order, carrying measured anchors.
 * @returns the per-row segments and dot x positions.
 */
function plan(rows: readonly BranchRow[]): { segments: Segment[]; dotX: number[] } {
  const segments: Segment[] = []
  const first = rows[0] as BranchRow
  const dotX: number[] = [first.x]
  let x = first.x

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i] as BranchRow
    const prev = rows[i - 1] as BranchRow
    const startY = prev.y
    const endY = row.y
    const midY = startY + (endY - startY) / 2

    // Every dot lands on its OWN anchor; the stem simply travels between them.
    // When two consecutive rows share an anchor (sessions under one project) the
    // travel is a straight run; when it changes (a folder's chevron sits left of
    // its children's dots) the stem swings out through an S-curve, which is what
    // reads as the branch stepping around the folder marker.
    const target = row.x

    if (target === x) {
      segments.push({ d: `L ${x} ${endY}`, length: Math.abs(endY - startY) })
    } else {
      // Two halves so the tangent is vertical at both ends, matching the
      // reference's curve rhythm.
      segments.push({
        d: `C ${x} ${midY}, ${target} ${midY}, ${target} ${endY}`,
        length: Math.hypot(target - x, endY - midY),
      })
      x = target
    }
    dotX.push(x)
  }

  return { segments, dotX }
}

/**
 * Build the branch for a list of rows.
 *
 * @param rows - visible rows in render order, each carrying its MEASURED centre.
 * @returns the branch geometry; empty strings when there are no rows.
 */
export function buildBranch(rows: readonly BranchRow[]): Branch {
  const first = rows[0]
  if (first === undefined) {
    return { ghostPath: '', grownPath: '', ghostLength: 0, grownLength: 0, dots: [], height: 0 }
  }

  const { segments, dotX } = plan(rows)
  const head = `M ${first.x} ${first.y}`

  const dots: BranchDot[] = rows.map((row, index) => ({
    key: row.key,
    cx: dotX[index] ?? row.x,
    cy: row.y,
    active: row.active,
  }))

  // The grown stroke stops AT the active row, so its path contains every
  // segment before that row and none after. An active first row grows nothing
  // beyond the origin, which is correct (the dot sits on the stem origin).
  let activeIndex = rows.findIndex(row => row.active)
  if (activeIndex < 0) activeIndex = 0

  const join = (list: readonly Segment[]): string =>
    list.length === 0 ? head : [head, ...list.map(s => s.d)].join(' ')

  const lengthOf = (count: number): number =>
    segments.slice(0, count).reduce((sum, s) => sum + s.length, 0)

  const last = rows[rows.length - 1] as BranchRow
  // Half a row height of breathing room below the last dot, so the stem does not
  // stop dead on the final row.
  const tail = rows.length > 1 ? Math.abs(last.y - (rows[rows.length - 2] as BranchRow).y) / 2 : 0

  return {
    ghostPath: join(segments),
    grownPath: join(segments.slice(0, activeIndex)),
    ghostLength: lengthOf(segments.length),
    grownLength: lengthOf(activeIndex),
    dots,
    height: last.y + tail,
  }
}
