/**
 * Session-tab state tests (`tabs.ts`): arrival order (append + reopen-first),
 * close, the catalog-driven self-close of dead tabs, the active-first display
 * order, the visibility policy (blank drafts never earn a tab), and the
 * per-tab indicator derivation the strip renders from.
 */
import { describe, expect, it } from 'vitest'

import type { SessionListState, SessionSummary } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionStatus } from '@deepseek-ai/dsh-client-ui-session/client'
import {
  appendTab,
  closeTabImpl,
  orderedTabs,
  projectIndex,
  projectLabel,
  removeTab,
  restoreTabsImpl,
  sameTabs,
  shouldOpenTab,
  tabIndicator,
  touchTabImpl,
  type SessionTab,
  type SessionTabsState,
  type WorkspaceViewLike,
} from '../src/client/tabs.ts'

function summary(id: string, opts: { blank?: boolean; running?: boolean } = {}): SessionSummary {
  return {
    id,
    blank: opts.blank ?? false,
    displayTitle: `会话-${id}`,
    running: opts.running ?? false,
    updatedAt: 1_700_000_000_000,
  } as unknown as SessionSummary
}

function listState(sessions: SessionSummary[]): SessionListState {
  const byId: Record<string, SessionSummary> = {}
  for (const s of sessions) byId[s.id] = s
  return {
    ids: sessions.map(s => s.id),
    byId,
    phase: 'ready',
    subagentsByParent: {},
  } as unknown as SessionListState
}

function status(opts: { running?: boolean; pending?: boolean; unread?: boolean }): SessionStatus {
  return {
    running: opts.running,
    pendingInteraction: opts.pending === true
      ? { key: 'k', kind: 'approval', sessionId: 's' }
      : undefined,
    completionUnread: opts.unread ?? false,
  } as unknown as SessionStatus
}

describe('appendTab', () => {
  it('appends an unseen session at the end with its arrival key', () => {
    const tabs = appendTab([], 'a', 1)
    expect(tabs).toEqual([{ sessionId: 'a', order: 1 }])
    expect(appendTab(tabs, 'b', 2)).toEqual([
      { sessionId: 'a', order: 1 },
      { sessionId: 'b', order: 2 },
    ])
  })

  it('leaves an existing session exactly where it is (stable positions)', () => {
    const tabs: SessionTab[] = [
      { sessionId: 'a', order: 1 },
      { sessionId: 'b', order: 2 },
      { sessionId: 'c', order: 3 },
    ]
    // Re-opening 'b' must NOT promote it: position belongs to the tab, not to
    // the selection, or the strip reshuffles on every click.
    const next = appendTab(tabs, 'b', 4)
    expect(next).toEqual(tabs)
    expect(next).toBe(tabs) // same array: no needless re-render
  })
})

describe('removeTab', () => {
  it('drops only the named session', () => {
    const tabs: SessionTab[] = [
      { sessionId: 'a', order: 1 },
      { sessionId: 'b', order: 2 },
    ]
    expect(removeTab(tabs, 'a')).toEqual([{ sessionId: 'b', order: 2 }])
    expect(removeTab(tabs, 'zz')).toEqual(tabs)
  })
})

describe('removeTab is the ONLY way a tab disappears', () => {
  it('drops just the named session', () => {
    const tabs: SessionTab[] = [
      { sessionId: 'a', order: 1 },
      { sessionId: 'b', order: 2 },
    ]
    expect(removeTab(tabs, 'a')).toEqual([{ sessionId: 'b', order: 2 }])
    expect(removeTab(tabs, 'zz')).toEqual(tabs)
  })

  it('there is no catalog-driven sweep any more', async () => {
    // The rule the user set: once a tab is open, only THEY close it. A program
    // that trims the strip on its own eventually eats tabs the user wanted, and
    // it also misfired — the catalog is briefly empty on every load, so the
    // sweep deleted restored tabs before the sessions arrived.
    const mod = await import('../src/client/tabs.ts')
    expect('closeMissingTabs' in mod).toBe(false)
  })

  it('the store exposes no sweep action either', async () => {
    const { createSessionTabsStore } = await import('../src/client/tab-store.ts')
    const instance = createSessionTabsStore().create()
    expect(Object.keys(instance.actions).sort()).toEqual(['close', 'restore', 'touch'])
  })

  it('touch never removes an existing tab, even one whose session is unknown', () => {
    // `touch` only ever appends or leaves the strip alone — it cannot evict.
    const state: SessionTabsState = {
      tabs: [{ sessionId: 'ghost', order: 1 }],
      order: 1,
    }
    touchTabImpl(state, 'other')
    expect(state.tabs.map(t => t.sessionId)).toEqual(['ghost', 'other'])
  })
})

describe('orderedTabs', () => {
  it('keeps arrival order no matter which tab is active', () => {
    const tabs: SessionTab[] = [
      { sessionId: 'a', order: 1 },
      { sessionId: 'b', order: 2 },
      { sessionId: 'c', order: 3 },
    ]
    // Switching to 'c' must not drag it to the front: the chip stays put.
    expect(orderedTabs(tabs, 'c').map(t => t.sessionId)).toEqual(['a', 'b', 'c'])
    expect(orderedTabs(tabs, 'a').map(t => t.sessionId)).toEqual(['a', 'b', 'c'])
    expect(orderedTabs(tabs, 'b').map(t => t.sessionId)).toEqual(['a', 'b', 'c'])
  })

  it('leaves the order alone when the open session has no tab', () => {
    const tabs: SessionTab[] = [{ sessionId: 'a', order: 1 }]
    expect(orderedTabs(tabs, undefined)).toEqual(tabs)
    expect(orderedTabs(tabs, 'other')).toEqual(tabs)
  })
})

describe('shouldOpenTab (a tab means "in play", not "once opened")', () => {
  it('refuses a draft that has not been talked to yet', () => {
    // The tab appears when the first message is sent, not when New Session is
    // clicked — `blank` is the controller's "no turn has started" flag.
    expect(shouldOpenTab('auto', summary('draft', { blank: true }), undefined)).toBe(false)
  })

  it('refuses SETTLED HISTORY — the reported bug', () => {
    // A conversation finished days ago is non-blank, quiet, read, and has no
    // pending interaction. Clicking it must not litter the strip, which is what
    // the old `!blank` rule did for every old conversation the user opened.
    expect(shouldOpenTab('auto', summary('old'), status({}))).toBe(false)
    expect(shouldOpenTab('auto', summary('old'), undefined)).toBe(false)
  })

  it('opens a tab for a session that is running', () => {
    // Either signal counts: the catalog row's bit, or the live status.
    expect(shouldOpenTab('auto', summary('a', { running: true }), undefined)).toBe(true)
    expect(shouldOpenTab('auto', summary('a'), status({ running: true }))).toBe(true)
  })

  it('opens a tab while an interaction is waiting on the user', () => {
    expect(shouldOpenTab('auto', summary('a'), status({ pending: true }))).toBe(true)
  })

  it('opens a tab for a completion the user has not looked at', () => {
    // The strip is the thing that tells you to come back.
    expect(shouldOpenTab('auto', summary('a'), status({ unread: true }))).toBe(true)
  })

  it('refuses when the catalog has not caught up, and in manual mode', () => {
    expect(shouldOpenTab('auto', undefined, undefined)).toBe(false)
    expect(shouldOpenTab('manual', summary('a', { running: true }), status({ running: true }))).toBe(false)
  })
})

describe('tabIndicator', () => {
  it('prefers a pending interaction, then running, then the unread marker', () => {
    expect(tabIndicator(summary('a'), status({ pending: true, running: true })).attention).toBe(true)
    expect(tabIndicator(summary('a'), status({ running: true })).running).toBe(true)
    expect(tabIndicator(summary('a'), status({ unread: true })).unread).toBe(true)
  })

  it('marks a titled, idle session as settled and a blank one as not', () => {
    expect(tabIndicator(summary('a'), status({})).settled).toBe(true)
    expect(tabIndicator(summary('blank', { blank: true }), status({})).settled).toBe(false)
    expect(tabIndicator(undefined, undefined).settled).toBe(false)
  })

  it('falls back to the catalog running bit when no status is published', () => {
    expect(tabIndicator(summary('a', { running: true }), undefined).running).toBe(true)
  })
})

describe('sameTabs', () => {
  it('compares the session sequence, ignoring arrival keys', () => {
    const left: SessionTab[] = [{ sessionId: 'a', order: 1 }]
    expect(sameTabs(left, [{ sessionId: 'a', order: 9 }])).toBe(true)
    expect(sameTabs(left, [{ sessionId: 'b', order: 1 }])).toBe(false)
    expect(sameTabs(left, [])).toBe(false)
  })
})

describe('projectIndex / projectLabel (which project owns a tab)', () => {
  const ws = (id: string, title: string, path: string, sessionIds: string[]): WorkspaceViewLike => ({
    workspaceId: id, title, path, sessionIds,
  })

  it('maps every session of every workspace to its owning project', () => {
    const index = projectIndex([
      ws('w1', 'api', 'C:/work/api', ['s1', 's2']),
      ws('w2', 'web', 'C:/work/web', ['s3']),
    ])
    expect(index.get('s1')?.label).toBe('api')
    expect(index.get('s3')?.label).toBe('web')
    expect(index.get('s3')?.workspaceId).toBe('w2')
    expect(index.size).toBe(3)
  })

  it('leaves a session in no workspace unmapped', () => {
    const index = projectIndex([ws('w1', 'api', 'C:/work/api', ['s1'])])
    expect(index.has('orphan')).toBe(false)
  })

  it('falls back to the directory basename when the title is blank', () => {
    // Host paths arrive with either separator.
    expect(projectLabel({ title: '   ', path: 'C:\\work\\my-app' })).toBe('my-app')
    expect(projectLabel({ title: '', path: '/home/me/other-app' })).toBe('other-app')
  })

  it('prefers an explicit title over the path', () => {
    expect(projectLabel({ title: 'Renamed', path: 'C:/work/api' })).toBe('Renamed')
  })

  it('keeps the FIRST workspace when two claim one session (no label flicker)', () => {
    const index = projectIndex([
      ws('w1', 'first', 'C:/a', ['s1']),
      ws('w2', 'second', 'C:/b', ['s1']),
    ])
    expect(index.get('s1')?.label).toBe('first')
  })
})

describe('store actions (no-churn guards)', () => {
  // `touch` runs on every catalog change for the open session, so a write when
  // nothing changed would wake the strip and spend arrival keys endlessly.
  it('touch on an existing tab writes nothing at all', () => {
    const state: SessionTabsState = {
      tabs: [
        { sessionId: 'a', order: 1 },
        { sessionId: 'b', order: 2 },
      ],
      order: 2,
    }
    const before = state.tabs
    touchTabImpl(state, 'b')
    expect(state.tabs).toBe(before) // same array => no subscriber wake
    expect(state.order).toBe(2) // arrival counter NOT spent
  })

  it('touch on a first-time session appends and spends one arrival key', () => {
    const state: SessionTabsState = { tabs: [{ sessionId: 'a', order: 1 }], order: 1 }
    touchTabImpl(state, 'b')
    expect(state.tabs).toEqual([
      { sessionId: 'a', order: 1 },
      { sessionId: 'b', order: 2 },
    ])
    expect(state.order).toBe(2)
  })

  it('close on a session with no tab writes nothing', () => {
    const state: SessionTabsState = { tabs: [{ sessionId: 'a', order: 1 }], order: 1 }
    const before = state.tabs
    closeTabImpl(state, 'zz')
    expect(state.tabs).toBe(before)
  })

  it('close removes exactly the named tab', () => {
    const state: SessionTabsState = {
      tabs: [
        { sessionId: 'a', order: 1 },
        { sessionId: 'b', order: 2 },
      ],
      order: 2,
    }
    closeTabImpl(state, 'a')
    expect(state.tabs).toEqual([{ sessionId: 'b', order: 2 }])
  })

  it('switching sessions never reorders the strip', () => {
    // The reported behaviour: click a tab, its position must not change.
    const state: SessionTabsState = {
      tabs: [
        { sessionId: 'a', order: 1 },
        { sessionId: 'b', order: 2 },
        { sessionId: 'c', order: 3 },
      ],
      order: 3,
    }
    // Opening 'c' (already a tab) and then 'a' must leave arrival order intact.
    touchTabImpl(state, 'c')
    touchTabImpl(state, 'a')
    expect(state.tabs.map(t => t.sessionId)).toEqual(['a', 'b', 'c'])
  })
})

describe('restoreTabsImpl (adopting host-loaded tabs)', () => {
  it('adopts the tabs when the strip is still empty', () => {
    const state: SessionTabsState = { tabs: [], order: 0 }
    restoreTabsImpl(state, [{ sessionId: 'a', order: 3 }, { sessionId: 'b', order: 5 }])
    expect(state.tabs.map(t => t.sessionId)).toEqual(['a', 'b'])
  })

  it('MERGES with tabs opened while the read was in flight', () => {
    // The restart case: the browser opens the current session's tab before the
    // host read lands. Both must survive — bailing on a non-empty strip would
    // silently drop every stored tab.
    const state: SessionTabsState = { tabs: [{ sessionId: 'startup', order: 1 }], order: 1 }
    restoreTabsImpl(state, [{ sessionId: 'stored', order: 9 }])
    expect(state.tabs.map(t => t.sessionId)).toEqual(['startup', 'stored'])
  })

  it('never duplicates a session already in the strip', () => {
    const state: SessionTabsState = { tabs: [{ sessionId: 'same', order: 1 }], order: 1 }
    restoreTabsImpl(state, [{ sessionId: 'same', order: 9 }])
    expect(state.tabs).toHaveLength(1)
    // The existing entry keeps its own key and position.
    expect(state.tabs[0]).toEqual({ sessionId: 'same', order: 1 })
  })

  it('re-keys restored tabs so no key can collide with one already spent', () => {
    // Restored keys come from an older run and may equal a key already in use.
    const state: SessionTabsState = { tabs: [{ sessionId: 'mine', order: 1 }], order: 1 }
    restoreTabsImpl(state, [{ sessionId: 'theirs', order: 1 }])
    const keys = state.tabs.map(t => t.order)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('leaves the counter monotonically ahead after a merge', () => {
    const state: SessionTabsState = { tabs: [{ sessionId: 'a', order: 2 }], order: 2 }
    restoreTabsImpl(state, [{ sessionId: 'b', order: 2 }])
    touchTabImpl(state, 'fresh')
    const keys = state.tabs.map(t => t.order)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('is a no-op for an empty restore', () => {
    const state: SessionTabsState = { tabs: [], order: 4 }
    const before = state.tabs
    restoreTabsImpl(state, [])
    expect(state.tabs).toBe(before)
    expect(state.order).toBe(4)
  })
})
