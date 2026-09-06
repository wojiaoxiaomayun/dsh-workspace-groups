/**
 * Quick-panel data-shaping tests (quick.ts): running-row eligibility
 * (running, non-blank, non-subagent, non-archived), recency ordering, the
 * all-sessions feed (running pinned on top, then recency, tree visibility),
 * the order-preserving session search, per-workspace latest-running pick,
 * per-workspace running counts, the current-open-workspace resolution, and
 * the ranked workspace search (prefix > title > category > path).
 */
import { describe, expect, it } from 'vitest'

import type { SessionListState, SessionSummary } from '@deepseek-ai/dsh-api-session-controller/client'
import type { WorkspaceView } from '@deepseek-ai/dsh-api-workspace-controller/client'
import {
  activeWorkspaceId,
  allSessions,
  filterSessions,
  filterWorkspaces,
  latestRunningInWorkspace,
  runningCountByWorkspace,
  runningSessions,
} from '../src/client/quick.ts'

function session(
  id: string,
  opts: { running?: boolean; blank?: boolean; subagent?: boolean; updatedAt?: number; title?: string } = {},
): SessionSummary {
  return {
    id,
    blank: opts.blank ?? false,
    displayTitle: opts.title ?? `会话-${id}`,
    running: opts.running ?? false,
    completed: false,
    updatedAt: opts.updatedAt ?? 1_700_000_000_000,
    ...(opts.subagent === true ? { origin: 'subagent' as const } : {}),
  } as unknown as SessionSummary
}

function workspace(id: string, path: string, title: string, sessionIds: string[] = []): WorkspaceView {
  return { workspaceId: id, path, title, createdAt: '2026-01-01T00:00:00.000Z', sessionIds } as unknown as WorkspaceView
}

function listState(sessions: SessionSummary[], current?: string): SessionListState {
  const byId: Record<string, SessionSummary> = {}
  for (const s of sessions) byId[s.id] = s
  return {
    ids: sessions.map(s => s.id),
    byId,
    current,
    phase: 'ready',
    subagentsByParent: {},
  } as unknown as SessionListState
}

describe('runningSessions', () => {
  it('keeps only running, non-blank, non-subagent rows and sorts newest first', () => {
    const list = listState([
      session('idle', { running: false }),
      session('run-old', { running: true, updatedAt: 100 }),
      session('run-new', { running: true, updatedAt: 200 }),
      session('blank-run', { running: true, blank: true, updatedAt: 300 }),
      session('sub-run', { running: true, subagent: true, updatedAt: 400 }),
    ])
    const out = runningSessions(list, new Set())
    expect(out.map(s => s.id)).toEqual(['run-new', 'run-old'])
  })

  it('excludes archived sessions', () => {
    const list = listState([
      session('a', { running: true }),
      session('b', { running: true }),
    ])
    const out = runningSessions(list, new Set(['a']))
    expect(out.map(s => s.id)).toEqual(['b'])
  })
})

describe('allSessions', () => {
  it('pins running on top, then recency, across the whole list', () => {
    const list = listState([
      session('idle-new', { updatedAt: 900 }),
      session('run-old', { running: true, updatedAt: 100 }),
      session('idle-old', { updatedAt: 50 }),
      session('run-new', { running: true, updatedAt: 200 }),
    ])
    const out = allSessions(list, new Set(), undefined)
    expect(out.map(s => s.id)).toEqual(['run-new', 'run-old', 'idle-new', 'idle-old'])
  })

  it('mirrors tree visibility: subagent/archived never, blank only while current', () => {
    const list = listState([
      session('idle', { running: false }),
      session('sub', { running: true, subagent: true, updatedAt: 400 }),
      session('blank', { blank: true, updatedAt: 300 }),
      session('blank-current', { blank: true, updatedAt: 200 }),
    ], 'blank-current')
    const out = allSessions(list, new Set(['idle']), 'blank-current')
    expect(out.map(s => s.id)).toEqual(['blank-current'])
  })
})

describe('filterSessions', () => {
  const sessions = [
    session('run', { running: true, updatedAt: 200, title: 'Refactor host' }),
    session('idle-a', { updatedAt: 100, title: 'Fix loader' }),
    session('idle-b', { updatedAt: 50, title: 'Performance tune' }),
  ]

  it('empty query returns the input order (running first, then recency)', () => {
    expect(filterSessions(sessions, '  ', () => undefined).map(s => s.id)).toEqual(['run', 'idle-a', 'idle-b'])
  })

  it('matches display title or workspace title, preserving the incoming order', () => {
    // `run` hits via its own title, `idle-a` only via its workspace title.
    const out = filterSessions(sessions, 'refactor', s => (s.id === 'idle-a' ? 'Refactor docs' : 'Other'))
    expect(out.map(s => s.id)).toEqual(['run', 'idle-a'])
  })

  it('never re-sorts: matches keep running-first/recency order, not title order', () => {
    const ordered = [
      session('run', { running: true, updatedAt: 200, title: 'Zebra run' }),
      session('idle-a', { updatedAt: 100, title: 'Alpha job' }),
      session('idle-b', { updatedAt: 50, title: 'Beta run' }),
    ]
    const out = filterSessions(ordered, 'run', () => undefined)
    expect(out.map(s => s.id)).toEqual(['run', 'idle-b'])
  })

  it('caps the render at the limit', () => {
    const many = Array.from({ length: 300 }, (_, i) => session(`s${i}`))
    expect(filterSessions(many, '', () => undefined)).toHaveLength(200)
  })
})

describe('latestRunningInWorkspace', () => {
  it('picks the newest running session inside the workspace only', () => {
    const list = listState([
      session('s1', { running: true, updatedAt: 100 }),
      session('s2', { running: true, updatedAt: 300 }),
      session('s3', { running: true, updatedAt: 500 }),
    ])
    const ws = workspace('ws-a', '/p/a', 'A', ['s1', 's2'])
    expect(latestRunningInWorkspace(list, ws)).toBe('s2')
  })

  it('returns undefined when nothing in the workspace runs', () => {
    const list = listState([
      session('s1', { running: false }),
      session('s2', { running: true, subagent: true }),
    ])
    const ws = workspace('ws-a', '/p/a', 'A', ['s1', 's2'])
    expect(latestRunningInWorkspace(list, ws)).toBeUndefined()
  })
})

describe('runningCountByWorkspace', () => {
  it('counts running sessions per workspace and omits empty keys', () => {
    const running = [
      session('s1', { running: true }),
      session('s2', { running: true }),
      session('s3', { running: true }),
    ]
    const workspaces = [
      workspace('ws-a', '/p/a', 'A', ['s1', 's2']),
      workspace('ws-b', '/p/b', 'B', ['s4']),
    ]
    const counts = runningCountByWorkspace(running, workspaces)
    expect(counts.get('ws-a')).toBe(2)
    expect(counts.has('ws-b')).toBe(false)
  })
})

describe('activeWorkspaceId', () => {
  const workspaces = [
    workspace('ws-a', '/p/a', 'A', ['s1', 's2']),
    workspace('ws-b', '/p/b', 'B', ['s3']),
  ]

  it('resolves the workspace holding the current session', () => {
    expect(activeWorkspaceId(workspaces, 's2')).toBe('ws-a')
    expect(activeWorkspaceId(workspaces, 's3')).toBe('ws-b')
  })

  it('returns undefined with no current session', () => {
    expect(activeWorkspaceId(workspaces, undefined)).toBeUndefined()
  })

  it('returns undefined when no listed workspace holds the current session', () => {
    // e.g. the open session is an addressed subagent, which never appears in
    // top-level workspace sessionIds — the marker must not render.
    expect(activeWorkspaceId(workspaces, 'subagent-1')).toBeUndefined()
  })
})

describe('filterWorkspaces', () => {
  const workspaces = [
    workspace('ws-a', '/Users/z/Alpha', 'Alpha'),
    workspace('ws-b', '/Users/z/Beta', 'Beta'),
    workspace('ws-c', '/Users/z/AlpineDocs', '文档站'),
  ]

  it('empty query keeps host order', () => {
    expect(filterWorkspaces(workspaces, '  ').map(w => w.workspaceId)).toEqual(['ws-a', 'ws-b', 'ws-c'])
  })

  it('title prefix outranks title substring outranks path substring', () => {
    const out = filterWorkspaces(workspaces, 'al')
    expect(out.map(w => w.workspaceId)).toEqual(['ws-a', 'ws-c'])
  })

  it('matches the category label', () => {
    const out = filterWorkspaces(
      workspaces,
      '文档',
      ws => (ws.workspaceId === 'ws-c' ? '文档' : undefined),
    )
    expect(out.map(w => w.workspaceId)).toEqual(['ws-c'])
  })

  it('returns nothing when no field matches', () => {
    expect(filterWorkspaces(workspaces, 'zzz')).toEqual([])
  })
})
