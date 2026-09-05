/**
 * Ctrl+R quick switch panel: two tabs over the framework's global hooks.
 *
 * - Workspaces tab: search real Workspaces, select one, then either start a
 *   New Session in it or jump straight to its most recently updated running
 *   session (the button reads the none-running state and disables).
 * - Running tab: every running top-level session across workspaces, newest
 *   first; one click opens it.
 *
 * Current-row marker: the open workspace (workspaces tab) and the open
 * session (running tab, when it is running) render `.wgQuickRowCurrent`;
 * with no current session — or one no listed workspace holds — nothing is
 * marked.
 *
 * Mount discipline: the parent conditionally mounts this component, so every
 * open starts from a fresh query/selection (quick-switcher semantics). The
 * overlay portals to document.body (sidebar ancestors clip `fixed`), sizes
 * itself like a launcher (top-anchored, 640px) instead of the host Modal's
 * 380px dialog, and handles Escape / mask click by itself. Pure data shaping
 * lives in quick.ts; this file only binds hooks + actions.
 */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { Button, StateDot } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
import type { WorkspaceId, WorkspaceView } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { activeWorkspaceId, filterWorkspaces, latestRunningInWorkspace, runningCountByWorkspace, runningSessions } from './quick.ts'
import { relativeTimeLabel } from './rows.tsx'

/** Which surface of the quick panel is active. */
export type QuickTab = 'workspaces' | 'running'

/** The locale seat's translate function (same shape GroupsBrowser receives). */
type Translate = PropsLocale<'workspaceGroups'>['t']

/** Quick panel props: hooks snapshots + the two injected verbs + shared CSS context. */
export type QuickPanelProps = {
  /** Close request (Escape, mask click, action completed, or parent Ctrl+R toggle). */
  onClose: () => void
  /** Sessions list snapshot (drives running detection). */
  list: SessionListState
  /** Real workspaces in stable Host order. */
  workspaces: readonly WorkspaceView[]
  /** Registry-global archive set. */
  archivedSessionIds: readonly SessionId[]
  /** Category label per grouped workspace id (badge column; top-level absent). */
  categoryByWorkspace: ReadonlyMap<string, string>
  /** Start a New Session in a workspace (injected share verb). */
  startSession: (workspaceId?: WorkspaceId) => void
  /** Open a real Session (injected share verb). */
  openSession: (sessionId: SessionId) => void
  /** Render clock for relative times (parent refreshes per render). */
  now: number
  /** Dictionary accessor (workspaceGroups namespace). */
  t: Translate
}

/** Basename of a host path (both separators; shortens the workspace row sub-line). */
function pathBasename(path: string): string {
  const trimmed = path.replace(/[/\\]+$/, '')
  const base = trimmed.split(/[/\\]/).pop()
  return base !== undefined && base !== '' ? base : trimmed
}

/**
 * Render the quick switch panel (portaled overlay).
 * @param props - hooks snapshots + injected verbs.
 * @returns the panel element tree.
 */
export function QuickPanel({
  onClose,
  list,
  workspaces,
  archivedSessionIds,
  categoryByWorkspace,
  startSession,
  openSession,
  now,
  t,
}: QuickPanelProps) {
  const [tab, setTab] = useState<QuickTab>('workspaces')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const activeRowRef = useRef<HTMLButtonElement>(null)

  const archived = useMemo(() => new Set(archivedSessionIds), [archivedSessionIds])
  const running = useMemo(() => runningSessions(list, archived), [list, archived])
  const runCounts = useMemo(() => runningCountByWorkspace(running, workspaces), [running, workspaces])
  const filtered = useMemo(
    () => filterWorkspaces(workspaces, query, ws => categoryByWorkspace.get(ws.workspaceId as string)),
    [workspaces, query, categoryByWorkspace],
  )

  // Where the user is right now: the open session and its owning workspace.
  // Both may be absent (`list.current` cleared, or a session no listed
  // workspace holds) — the current-row marker simply never renders then.
  const currentSessionId = list.current
  const currentWorkspaceId = useMemo(
    () => activeWorkspaceId(workspaces, currentSessionId),
    [workspaces, currentSessionId],
  )

  const selected = selectedId === null
    ? undefined
    : workspaces.find(w => (w.workspaceId as string) === selectedId)
  const selectedRunningId = selected === undefined ? undefined : latestRunningInWorkspace(list, selected)

  // Focus the search input whenever the workspaces tab becomes reachable.
  useEffect(() => {
    if (tab === 'workspaces') inputRef.current?.focus()
  }, [tab])

  // Keep the keyboard-active row visible while arrowing through the list.
  useEffect(() => {
    activeRowRef.current?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  /** Select the workspace and close (New Session verb). */
  const launchNewSession = (workspace: WorkspaceView): void => {
    startSession(workspace.workspaceId)
    onClose()
  }

  /** Open the running session and close. */
  const launchRunning = (sessionId: SessionId): void => {
    openSession(sessionId)
    onClose()
  }

  /** Search-input keyboard: arrows move the active row; Enter selects or launches New Session. */
  const onSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(i => Math.min(i + 1, Math.max(filtered.length - 1, 0)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (selected === undefined) {
        const target = filtered[activeIndex]
        if (target !== undefined) setSelectedId(target.workspaceId as string)
      } else {
        launchNewSession(selected)
      }
    }
  }

  /** Escape closes (capture so row buttons and the input can't swallow it). */
  const onCardKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      onClose()
    }
  }

  /** Mask click closes; clicks inside the card never reach the mask. */
  const onOverlayMouseDown = (e: MouseEvent<HTMLDivElement>): void => {
    if (e.target === e.currentTarget) onClose()
  }

  const selectWorkspace = (id: string): void => {
    setSelectedId(id)
    inputRef.current?.focus()
  }

  return createPortal(
    <div className="wgQuickOverlay" onMouseDown={onOverlayMouseDown}>
      <div
        className="wgQuickCard"
        role="dialog"
        aria-modal="true"
        aria-label={t('quick.title')}
        onKeyDown={onCardKeyDown}
      >
        <div className="wgQuickHeader">
          <span className="wgQuickTitle">{t('quick.title')}</span>
          <div className="wgQuickTabs" role="tablist" aria-label={t('quick.title')}>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'workspaces'}
              className={`wgQuickTab${tab === 'workspaces' ? ' wgQuickTabActive' : ''}`}
              onClick={() => { setTab('workspaces') }}
            >
              {t('quick.tab.workspaces')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'running'}
              className={`wgQuickTab${tab === 'running' ? ' wgQuickTabActive' : ''}`}
              onClick={() => { setTab('running') }}
            >
              {t('quick.tab.running')}
              {running.length > 0 && <span className="wgQuickTabCount">{running.length}</span>}
            </button>
          </div>
        </div>

        {tab === 'workspaces' ? (
          <>
            <div className="wgQuickSearchWrap">
              <input
                ref={inputRef}
                className="wgQuickSearch"
                value={query}
                placeholder={t('quick.search.placeholder')}
                aria-label={t('quick.search.placeholder')}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setSelectedId(null)
                  setActiveIndex(0)
                }}
                onKeyDown={onSearchKeyDown}
              />
            </div>
            <div className="wgQuickList" role="listbox" aria-label={t('quick.tab.workspaces')}>
              {filtered.map((workspace, i) => {
                const id = workspace.workspaceId as string
                const count = runCounts.get(id) ?? 0
                const category = categoryByWorkspace.get(id)
                const isCurrent = id === currentWorkspaceId
                return (
                  <button
                    key={id}
                    ref={i === activeIndex ? activeRowRef : undefined}
                    type="button"
                    role="option"
                    aria-selected={selectedId === id}
                    aria-current={isCurrent || undefined}
                    className={
                      `wgQuickRow${i === activeIndex ? ' wgQuickRowActive' : ''}${selectedId === id ? ' wgQuickRowSelected' : ''}${isCurrent ? ' wgQuickRowCurrent' : ''}`
                    }
                    onMouseEnter={() => { setActiveIndex(i) }}
                    onClick={() => { selectWorkspace(id) }}
                  >
                    <span className="wgQuickRowMain">
                      <span className="wgQuickRowTitle">{workspace.title}</span>
                      {count > 0 && <span className="wgQuickRunBadge">● {count}</span>}
                    </span>
                    <span className="wgQuickRowSub">
                      <span className="wgQuickRowPath">
                        {category !== undefined ? `${category} · ${pathBasename(workspace.path)}` : pathBasename(workspace.path)}
                      </span>
                    </span>
                  </button>
                )
              })}
              {filtered.length === 0 && <div className="wgQuickEmpty">{t('quick.empty.workspaces')}</div>}
            </div>
            <div className="wgQuickFooter">
              <span className="wgQuickSelected">
                {selected === undefined ? t('quick.select.hint') : selected.title}
              </span>
              <Button
                variant="outline"
                disabled={selected === undefined || selectedRunningId === undefined}
                onClick={() => { if (selectedRunningId !== undefined) launchRunning(selectedRunningId) }}
              >
                {selectedRunningId !== undefined ? t('quick.action.running') : t('quick.action.noneRunning')}
              </Button>
              <Button
                variant="primary"
                disabled={selected === undefined}
                onClick={() => { if (selected !== undefined) launchNewSession(selected) }}
              >
                {t('quick.action.newSession')}
              </Button>
            </div>
          </>
        ) : (
          <div className="wgQuickList" role="list" aria-label={t('quick.tab.running')}>
            {running.map((session) => {
              const workspace = workspaces.find(w => w.sessionIds.includes(session.id))
              const isCurrent = session.id === currentSessionId
              return (
                <button
                  key={session.id}
                  type="button"
                  role="listitem"
                  aria-current={isCurrent || undefined}
                  className={`wgQuickRow${isCurrent ? ' wgQuickRowCurrent' : ''}`}
                  onClick={() => { launchRunning(session.id) }}
                >
                  <span className="wgQuickRowMain">
                    <StateDot state="ongoing" />
                    <span className="wgQuickRowTitle">{session.displayTitle}</span>
                    <span className="wgQuickTime">{relativeTimeLabel(session.updatedAt, now)}</span>
                  </span>
                  <span className="wgQuickRowSub">
                    <span className="wgQuickRowPath">{workspace?.title ?? ''}</span>
                  </span>
                </button>
              )
            })}
            {running.length === 0 && <div className="wgQuickEmpty">{t('quick.empty.running')}</div>}
          </div>
        )}

        <div className="wgQuickHint">{t('quick.hint')}</div>
      </div>
    </div>,
    document.body,
  )
}
