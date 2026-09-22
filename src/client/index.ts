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
 *   contained — the shared navigation service + `workspaces.create()`, no
 *   hole.
 *
 * 0.1.6 适配：导航（选中会话 / New Session / fork / archive / 目录选择）从
 * `ctx.sessions` 抽到 ui-workspace 提供的 `ctx.uiWorkspace` 服务
 * （`ISessions` 现在只有目录 / retain / search 能力，选中由 `mainView` 保留位
 * 表达）。本插件不再自建 connectWorkspace/recentWorkspace 语义，全部委托给该
 * 服务，只保留改名、删除、排序、搜索等数据动作。
 */
import type { Context } from '@deepseek-ai/cordis'
// Type-only service merges: sessions/workspaces controllers, the ui-workspace
// navigation service face (ctx.uiWorkspace), locale dictionary seat, the
// SlotRegistry, and the sidebar SlotMap.
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import type {} from '@deepseek-ai/dsh-api-workspace-controller/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import type { SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-slots'
// `useWorkspaces` is contributed by the ui-workspace browser domain (same
// declaration as the official ui-workspace client half).
import type { WorkspaceSnapshot } from '@deepseek-ai/dsh-api-workspace-controller/client'
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

/**
 * Required services (cordis fiber inject; 0.1.6 service roster). `uiWorkspace`
 * is the shipped navigation face this browser delegates selection to.
 */
export const inject = ['slots', 'sessions', 'workspaces', 'uiWorkspace', 'locale']

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

  const browserInjected = (): GroupsBrowserInjected => ({
    // Navigation verbs belong to the shipped ui-workspace service: it owns the
    // retained `mainView` selection, supersession and pending-navigation
    // cancellation (0.1.6 moved them out of `ctx.sessions`).
    startSession: (workspaceId) => { ctx.uiWorkspace.startSession(workspaceId) },
    open: (sessionId) => { ctx.uiWorkspace.openSession(sessionId) },
    forkSession: (sessionId) => {
      ctx.uiWorkspace.forkSession(sessionId).catch((reason: unknown) => {
        console.warn('fork session failed:', reason)
      })
    },
    archiveSession: async (sessionId) => { await ctx.uiWorkspace.archiveSession(sessionId) },
    pickDirectory: () => ctx.uiWorkspace.pickDirectory(),
    searchSessions,
    searchResultLimit: ctx.sessions.searchResultLimit,
    // Directory-flow hole occupancy. The official ui-workspace browser gates
    // its "Add workspace…" affordance on the hole being occupied (the shipped
    // picker package's client half fills it); this browser drives the picker
    // itself through `pickDirectory`, so it must keep the hole occupied or the
    // official entry (still live at priority 0) would silently withdraw the
    // affordance.
    hooks: {
      directoryFlow: {
        getSnapshot: () => true,
        subscribe: () => () => {},
      },
    },
    // Data-only verbs stay on the controllers.
    renameSession: async (sessionId, title) => {
      const session = ctx.sessions.binding(sessionId)?.session
      if (session === undefined) throw new Error(`unknown session "${sessionId}"`)
      const result = await session.rename(title)
      if (!result.ok) throw new Error(result.error.message)
    },
    renameWorkspace: async (workspaceId, title) => { await ctx.workspaces.rename(workspaceId, title) },
    deleteWorkspace: async (workspaceId) => { await ctx.workspaces.delete(workspaceId) },
    insertWorkspaceBefore: async (workspaceId, beforeWorkspaceId) => {
      await ctx.workspaces.insertBefore(workspaceId, beforeWorkspaceId)
    },
    insertSessionBefore: async (workspaceId, sessionId, beforeSessionId) => {
      await ctx.workspaces.insertSessionBefore(workspaceId, sessionId, beforeSessionId)
    },
    createWorkspace: input => ctx.workspaces.create(input),
  })

  // priority: -1 — lower than the official browser's default 0, so the
  // single-slot shadow rule elects this entry. No children declaration: the
  // official entry already owns `sidebar.workspaces.directoryFlow`.
  //
  // The official WorkspaceBrowser entry is NEVER disposed — shadowing only
  // changes which entry renders (activation just bumps the store's mount
  // count). Both entries live at the same cell, so if this one ever throws
  // during render the slot core retires it for the rest of its registration's
  // life and silently falls back to the official browser. Anything that can
  // throw belongs outside the hot path.
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
