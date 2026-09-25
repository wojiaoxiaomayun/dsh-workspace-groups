/**
 * Flower-branch geometry tests (`branch.ts`).
 *
 * The branch is pure geometry, so these assert the shape directly rather than
 * through a render: one continuous route, a kink at every group boundary, and a
 * dot per row sitting ON its own measured anchor — with the grown stroke never
 * running past the active row.
 *
 * Rows carry BOTH coordinates (the DOM supplies them), so the fixtures use
 * deliberately uneven values: deriving a pitch from one gap, or assuming a
 * shared stem x, are exactly the two bugs this geometry already had.
 */
import { describe, expect, it } from 'vitest'

import { buildBranch, type BranchRow } from '../src/client/branch.ts'

/** A row at explicit coordinates. */
const at = (
  key: string,
  y: number,
  x: number,
  kind: 'group' | 'item',
  active = false,
): BranchRow => ({ key, y, x, kind, active })

/** Evenly spaced item rows all sharing one anchor. */
function items(count: number, activeIndex = -1, x = 30): BranchRow[] {
  return Array.from({ length: count }, (_, i) => at(`r${i}`, 14 + i * 28, x, 'item', i === activeIndex))
}

/** Count how many curves (C segments) the path contains. */
function curves(path: string): number {
  return (path.match(/C /g) ?? []).length
}

describe('buildBranch', () => {
  it('is empty for no rows', () => {
    const b = buildBranch([])
    expect(b.ghostPath).toBe('')
    expect(b.grownPath).toBe('')
    expect(b.dots).toHaveLength(0)
    expect(b.height).toBe(0)
  })

  it('draws one dot per row, in order', () => {
    const b = buildBranch(items(3))
    expect(b.dots.map(d => d.key)).toEqual(['r0', 'r1', 'r2'])
  })

  it('places every dot on its own measured y (uneven spacing)', () => {
    // 28, then a 40px section break, then 28.
    const rows = [at('a', 14, 30, 'item'), at('b', 42, 30, 'item'), at('c', 82, 30, 'item'), at('d', 110, 30, 'item')]
    expect(buildBranch(rows).dots.map(d => d.cy)).toEqual([14, 42, 82, 110])
  })

  it('starts the path at the first row', () => {
    expect(buildBranch(items(2)).ghostPath.startsWith('M 30 14')).toBe(true)
  })

  it('runs straight when consecutive rows share an anchor', () => {
    const b = buildBranch(items(3))
    expect(curves(b.ghostPath)).toBe(0)
    expect((b.ghostPath.match(/L /g) ?? []).length).toBe(2)
  })

  it('steps the stem between a folder marker and its children', () => {
    // A project anchors at x=50 (its chevron); its sessions at x=60 (their dot).
    const rows = [
      at('session-above', 14, 60, 'item'),
      at('project', 42, 50, 'group'),
      at('session-1', 70, 60, 'item'),
      at('session-2', 98, 60, 'item'),
    ]
    const b = buildBranch(rows)
    // Every dot is ON its own declared anchor — including the folder's.
    expect(b.dots.map(d => d.cx)).toEqual([60, 50, 60, 60])
    expect(curves(b.ghostPath)).toBe(2) // one step out, one step back
  })

  it('keeps the FIRST row exactly on its own anchor', () => {
    // The bug this guards: the first dot used to be forced onto a fixed stem x,
    // so a top-level folder's marker ended up far inside its chevron.
    const b = buildBranch([at('first', 14, 11, 'group'), at('child', 42, 60, 'item')])
    expect(b.dots[0].cx).toBe(11)
    expect(b.ghostPath.startsWith('M 11 14')).toBe(true)
  })

  it('grown path stops at the active row', () => {
    const b = buildBranch(items(4, 2))
    expect((b.grownPath.match(/L |C /g) ?? []).length).toBe(2) // a→b→c
    expect((b.ghostPath.match(/L |C /g) ?? []).length).toBe(3) // a→b→c→d
    expect(b.grownLength).toBeLessThan(b.ghostLength)
  })

  it('grown path is just the origin when the first row is active', () => {
    const b = buildBranch(items(3, 0))
    expect(b.grownPath).toBe('M 30 14')
    expect(b.grownLength).toBe(0)
  })

  it('with nothing active, the grown path collapses to the origin', () => {
    // No active row is a real state (list still loading); it must not throw or
    // grow to an arbitrary row.
    const b = buildBranch(items(2))
    expect(b.grownLength).toBe(0)
    expect(b.grownPath).toBe('M 30 14')
  })

  it('marks exactly the active row', () => {
    const b = buildBranch(items(3, 1))
    expect(b.dots.filter(d => d.active).map(d => d.key)).toEqual(['r1'])
  })

  it('reports a height covering the last dot', () => {
    const b = buildBranch(items(3))
    expect(b.height).toBeGreaterThan(14 + 2 * 28)
  })

  it('handles a single row', () => {
    const b = buildBranch([at('only', 14, 28, 'item')])
    expect(b.dots).toHaveLength(1)
    expect(b.dots[0].cx).toBe(28)
    expect(b.ghostLength).toBe(0)
  })
})
