/**
 * Quick-panel data-shaping tests (quick.ts): running-row eligibility
 * (running, non-blank, non-subagent, non-archived), recency ordering,
 * per-workspace latest-running pick, per-workspace running counts, the
 * current-open-workspace resolution, and the ranked workspace search
 * (prefix > title > category > path).
 */
import { describe, expect, it } from 'vitest'

import type { SessionListState, SessionSummary } from '@deepseek-ai/dsh-api-session-controller/client'
import type { WorkspaceView } from '@deepseek-ai/dsh-api-workspace-controller/client'
import {
  activeWorkspaceId,
  filterWorkspaces,
  latestRunningInWorkspace,
  runningCountByWorkspace,
  runningSessions,
} from '../src/client/quick.ts'

function session(
  id: string,
  opts: { running?: boolean; blank?: boolean; subagent?: boolean; updatedAt?: number } = {},
): SessionSummary {
  return {
    id,
    blank: opts.blank ?? false,
    displayTitle: `会话-${id}`,
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
