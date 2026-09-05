/**
 * @dsh-xhl/workspace-groups client half: registers the three-level grouped
 * workspace browser into the `sidebar.workspaces` slot, shadowing the
 * official ui-workspace browser.
 *
 * Shadowing mechanics (SlotCore semantics):
 * - `sidebar.workspaces` is a `single`/`root` slot. The official browser
 *   registers at priority 0; this entry registers at priority -1, and the
 *   single-cell shadow rule makes the LOWEST priority the winner — the
 *   sidebar renders this browser instead of the official one.
 * - This entry deliberately declares NO child slots: the official entry
 *   already declared `sidebar.workspaces.directoryFlow` (a second declaration
 *   of an occupied child key throws). Add Workspace is therefore self-
 *   contained — the Host-native directory picker + `workspaces.create()`, no
 *   hole.
 *
 * 0.1.2 适配：`@deepseek-ai/dsh-client-runtime` 不再存在（平台模块表基线改为
 * `PLATFORM_MODULES`），sessions/workspaces 收敛为纯 Controller 服务，
 * `workspaces.startSession/pickDirectory` 与 `connection.hostDescription`
 * 被移除。New Session 与目录选取在此本地组装（与官方 ui-workspace 的
 * navigation.ts 同一语义），跨插件协作只走 cordis 服务 / slots。
 */
import type { Context } from '@deepseek-ai/cordis'
// Type-only service merges: sessions/workspaces controllers, remote namespaces,
// locale dictionary seat, the SlotRegistry, and the sidebar SlotMap.
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import type {} from '@deepseek-ai/dsh-api-workspace-controller/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type { SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-slots'
// 0.1.2 的 GlobalStandardProps 只含 useSessions/useSessionPendingInteraction；
// useWorkspaces 由工作区浏览器域自行声明（与官方 ui-workspace 相同）。
import type { WorkspaceSnapshot } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { WorkspaceId } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { GroupsBrowserInjected } from './contract.ts'
import { createGroupsViewStore } from './stores.ts'
import { GroupsBrowser } from './GroupsBrowser.tsx'
import { en, zh, type WorkspaceGroupsKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The workspace-groups browsing region copy. */
    workspaceGroups: WorkspaceGroupsKey
  }

  interface GlobalStandardProps {
    /** Selector hook over the pure Workspace Controller snapshot. */
    useWorkspaces: SnapshotSelectorHook<WorkspaceSnapshot>
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'workspaceGroups'

/** Required services (cordis fiber inject; 0.1.2 service roster). */
export const inject = ['slots', 'sessions', 'workspaces', 'locale', 'remote', 'remote.directoryPicker']

/** Stable tie-breaking follows Host Workspace order (official ui-workspace semantics). */
function recentWorkspace(
  workspaces: readonly { workspaceId: WorkspaceId; sessionIds: readonly SessionId[]; createdAt: string }[],
  sessions: Readonly<Record<SessionId, { updatedAt: number } | undefined>>,
): WorkspaceId | undefined {
  let selected: WorkspaceId | undefined
  let selectedTime = Number.NEGATIVE_INFINITY
  for (const workspace of workspaces) {
    let latest = Number.NEGATIVE_INFINITY
    for (const sessionId of workspace.sessionIds) {
      const session = sessions[sessionId]
      if (session !== undefined) latest = Math.max(latest, session.updatedAt)
    }
    if (latest === Number.NEGATIVE_INFINITY) latest = Date.parse(workspace.createdAt)
    if (selected === undefined || latest > selectedTime) {
      selected = workspace.workspaceId
      selectedTime = latest
    }
  }
  return selected
}

/**
 * Register the grouped browser once the sidebar slot declaration is on the
 * ledger. Inject factory returns plain callbacks; data reads use the
 * framework's global hooks.
 * @param ctx - client root context.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), '@dsh-xhl/workspace-groups: dictionaries')

  const searchSessions: GroupsBrowserInjected['searchSessions'] = async (query, signal) => {
    const result = await ctx.sessions.search(query, signal)
    if (!result.ok) throw new Error(result.error.message)
    return result.value
  }

  // In-flight workspace connects (dedupes concurrent New Session on one workspace).
  const connecting = new Map<WorkspaceId, Promise<SessionId>>()

  /** Reuse-or-create the blank session targeting a workspace (official connectWorkspace semantics). */
  function connectWorkspace(workspaceId: WorkspaceId): Promise<SessionId> {
    const workspace = ctx.workspaces.list.getSnapshot().items
      .find(item => item.workspaceId === workspaceId)
    if (workspace === undefined) {
      return Promise.reject(new Error(`unknown workspace ${workspaceId}`))
    }
    const inflight = connecting.get(workspaceId)
    if (inflight !== undefined) return inflight
    const archived = ctx.workspaces.list.getSnapshot().archivedSessionIds
    const list = ctx.sessions.list.getSnapshot()
    for (const id of list.ids) {
      const summary = list.byId[id]
      if (summary !== undefined && summary.blank && summary.cwd === workspace.path
        && workspace.sessionIds.includes(summary.id) && !archived.includes(summary.id)) {
        return Promise.resolve(summary.id)
      }
    }
    const attempt = ctx.sessions.create({ workspaceId })
      .finally(() => { connecting.delete(workspaceId) })
    connecting.set(workspaceId, attempt)
    return attempt
  }

  /** Start a New Session: explicit target, else current workspace, else recent (official startSession semantics). */
  function startSession(workspaceId?: WorkspaceId): void {
    const workspaces = ctx.workspaces.list.getSnapshot()
    const list = ctx.sessions.list.getSnapshot()
    const currentWorkspaceId = list.current === undefined
      ? undefined
      : workspaces.items.find(item => item.sessionIds.includes(list.current as SessionId))?.workspaceId
    const recent = workspaces.phase === 'ready' && list.phase === 'ready'
      ? recentWorkspace(workspaces.items, list.byId)
      : undefined
    const target = workspaceId ?? currentWorkspaceId ?? recent
    if (target === undefined) {
      ctx.sessions.clear()
      return
    }
    void connectWorkspace(target).then(
      (sessionId) => { ctx.sessions.open(sessionId) },
      (reason: unknown) => { console.warn('new session failed:', reason) },
    )
  }

  /** Host-native directory picker (0.1.2: `ctx.remote.directoryPicker`). */
  const pickDirectory = async (): Promise<string | null> => {
    const result = await ctx.remote.directoryPicker.pick()
    if (!result.ok) throw new Error(`directory picker failed: ${result.error.message}`)
    return result.value
  }

  const browserInjected = (): GroupsBrowserInjected => ({
    startSession,
    open: (sessionId) => { ctx.sessions.open(sessionId) },
    searchSessions,
    searchResultLimit: ctx.sessions.searchResultLimit,
    renameSession: async (sessionId, title) => {
      const session = ctx.sessions.binding(sessionId)?.session
      if (session === undefined) throw new Error(`unknown session "${sessionId}"`)
      const result = await session.rename(title)
      if (!result.ok) throw new Error(result.error.message)
    },
    forkSession: (sessionId) => {
      ctx.sessions.fork({ sessionId, increaseTitle: true })
        .then((childId) => { ctx.sessions.open(childId) })
        .catch(() => {})
    },
    renameWorkspace: async (workspaceId, title) => { await ctx.workspaces.rename(workspaceId, title) },
    deleteWorkspace: async (workspaceId) => { await ctx.workspaces.delete(workspaceId) },
    insertWorkspaceBefore: async (workspaceId, beforeWorkspaceId) => {
      await ctx.workspaces.insertBefore(workspaceId, beforeWorkspaceId)
    },
    archiveSession: async (sessionId) => { await ctx.workspaces.archiveSession(sessionId) },
    insertSessionBefore: async (workspaceId, sessionId, beforeSessionId) => {
      await ctx.workspaces.insertSessionBefore(workspaceId, sessionId, beforeSessionId)
    },
    createWorkspace: input => ctx.workspaces.create(input),
    pickDirectory,
  })

  // priority: -1 — lower than the official browser's default 0, so the
  // single-slot shadow rule elects this entry. No children declaration: the
  // official entry already owns `sidebar.workspaces.directoryFlow`.
  ctx.slots.inject('sidebar.workspaces', () => ctx.slots.register(
    {
      name: 'sidebar.workspaces',
      priority: -1,
      store: createGroupsViewStore(),
      inject: browserInjected,
      locale: NS,
      registrant: '@dsh-xhl/workspace-groups',
    },
    GroupsBrowser,
  ))
}
