/**
 * Tab-strip layout contract (CSS-level).
 *
 * The strip's overflow behaviour is decided entirely by a few declarations, and
 * it regressed once already: `.wgTab` was shrinkable (`flex: 0 1 auto`), so the
 * row absorbed ANY number of tabs by squeezing every chip and ellipsing every
 * label instead of overflowing. The strip therefore never scrolled, and tabs
 * became unreadable slivers — a purely visual failure no unit test caught.
 *
 * These assertions read the stylesheet source rather than a rendered box, so
 * they are cheap and deterministic (jsdom does not lay out flexbox). They pin
 * the specific properties the behaviour depends on, not exact values.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const rawCss = readFileSync(
  fileURLToPath(new URL('../src/client/styles.css', import.meta.url)),
  'utf8',
)

// Strip comments up front: they contain braces and prose parentheses that would
// otherwise break rule scanning.
const css = rawCss.replace(/\/\*[\s\S]*?\*\//g, '')

/**
 * Extract one rule's declaration block by selector.
 *
 * The selector text is matched against a full selector LIST (everything between
 * the previous `}` and the opening brace), not as a substring: `.wgTreeRail`
 * also appears inside the longer
 * `.wgProjectActive + .wgTreeChildren .wgTreeRail`, and a substring match would
 * silently return that rule instead.
 *
 * @param selector - the exact selector text, e.g. `.wgTab`.
 * @returns the declarations between its braces.
 */
function ruleOf(selector: string): string {
  const rules = /([^{}]+)\{([^{}]*)\}/g
  let match: RegExpExecArray | null
  while ((match = rules.exec(css)) !== null) {
    const selectors = match[1].split(',').map(part => part.trim())
    if (selectors.includes(selector)) return match[2]
  }
  throw new Error(`rule not found: ${selector}`)
}

describe('tab strip layout contract', () => {
  it('chips do NOT shrink (shrinking would hide overflow instead of scrolling)', () => {
    const tab = ruleOf('.wgTab')
    // `0 0 auto` — grow 0, shrink 0, basis auto. A non-zero shrink factor makes
    // the row fit any number of chips by squashing them.
    expect(tab).toMatch(/flex:\s*0\s+0\s+auto/)
    expect(tab).not.toMatch(/flex:\s*0\s+1/)
  })

  it('the row scrolls horizontally', () => {
    const scroll = ruleOf('.wgTabsScroll')
    expect(scroll).toMatch(/overflow-x:\s*auto/)
  })

  it('the scrollbar is hidden in every engine', () => {
    // Firefox/standard, plus the WebKit/Chromium pseudo-element rule.
    expect(ruleOf('.wgTabsScroll')).toMatch(/scrollbar-width:\s*none/)
    expect(ruleOf('.wgTabsScroll::-webkit-scrollbar')).toMatch(/display:\s*none/)
  })

  it('the strip row itself does not scroll (only its inner row does)', () => {
    // `.wgTabs` is the padded frame; if it scrolled too, the padding would
    // scroll away and the inner overflow would be unreachable.
    const tabs = ruleOf('.wgTabs')
    expect(tabs).not.toMatch(/overflow[^:]*:\s*(auto|scroll)/)
  })

  it('keeps a max width so one long title cannot fill the row', () => {
    expect(ruleOf('.wgTab')).toMatch(/max-width:\s*\d+px/)
  })

  it('shapes each chip like a folder: workspace over title', () => {
    // The stacked column must NOT stretch both lines to the same width, or the
    // short-top / long-bottom folder shape is lost.
    expect(ruleOf('.wgTabText')).toMatch(/flex-direction:\s*column/)
    expect(ruleOf('.wgTabText')).toMatch(/align-items:\s*flex-start/)
  })

  it('makes the workspace line quieter than the session title', () => {
    const size = (rule: string): number => Number(/font-size:\s*(\d+(?:\.\d+)?)px/.exec(rule)?.[1] ?? 0)
    // Smaller AND a different tone: the conversation is the chip's subject.
    expect(size(ruleOf('.wgTabProject'))).toBeLessThan(size(ruleOf('.wgTabLabel')))
    expect(ruleOf('.wgTabLabel')).toMatch(/color:\s*var\(--dsw-alias-label-primary/)
  })
})

/**
 * Tree legibility. The sidebar's three levels (category folder → project folder
 * → session) previously differed only by a 20px indent, with identical type at
 * both folder and session level — so a scrolled list read as one flat column and
 * which workspace a session belonged to was genuinely unclear. These pin the
 * cues that fix it.
 */
describe('sidebar tree hierarchy contract', () => {
  it('folder labels are heavier than session titles', () => {
    const weight = (rule: string): number => {
      const m = /font-weight:\s*(\d+)/.exec(rule)
      return m === null ? 400 : Number(m[1])
    }
    expect(weight(ruleOf('.wgProjectLabel'))).toBeGreaterThan(weight(ruleOf('.wgSessionTitle')))
  })

  it('folder and session labels use different typefaces (mono vs prose)', () => {
    // A non-colour cue, so the distinction survives any theme.
    expect(ruleOf('.wgProjectLabel')).toMatch(/font-family:[^;]*mono/i)
    expect(ruleOf('.wgSessionTitle')).not.toMatch(/font-family:[^;]*mono/i)
  })

  it('a folder groups its children for tree semantics', () => {
    // The wrapper survives the rail's removal: it keeps role="group" and gives
    // the rows one positioned ancestor.
    expect(ruleOf('.wgTreeChildren')).toMatch(/position:\s*relative/)
  })

  it('renders the flower branch as non-interactive decoration', () => {
    // The overlay paints behind the rows, so it must never eat a click, hover or
    // drag that belongs to a row.
    expect(ruleOf('.wgBranch')).toMatch(/pointer-events:\s*none/)
    expect(ruleOf('.wgBranch')).toMatch(/position:\s*absolute/)
    // The rows sit above it.
    expect(ruleOf('.wgTreeWrap > .wgList')).toMatch(/z-index:\s*1/)
  })

  it('draws a dashed ghost and a solid grown stroke', () => {
    // The contrast between the two IS the "grew to you" effect.
    expect(ruleOf('.wgBranchGhost')).toMatch(/stroke-dasharray/)
    expect(ruleOf('.wgBranchGrown')).not.toMatch(/stroke-dasharray/)
    // Hairlines must not scale with the viewBox.
    expect(ruleOf('.wgBranchGhost')).toMatch(/vector-effect:\s*non-scaling-stroke/)
    expect(ruleOf('.wgBranchGrown')).toMatch(/vector-effect:\s*non-scaling-stroke/)
  })

  it('keeps the old per-folder rail out (the branch replaced it)', () => {
    // Two overlapping route graphics in one tree is the regression to avoid.
    expect(css).not.toContain('.wgTreeRail')
    expect(css).not.toContain('.wgSessionRow::before')
  })

  it('the active folder path is emphasised without colour alone', () => {
    // Weight carries it; colour alone would fail for colour-blind users and
    // could collide with the selected session's fill.
    expect(ruleOf('.wgProjectActive .wgProjectLabel')).toMatch(/font-weight:\s*700/)
  })
})
