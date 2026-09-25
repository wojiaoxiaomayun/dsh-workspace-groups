/**
 * Registrant-private injected share for the workspace-groups browser entry.
 * Mirrors the official ui-workspace browser inject (same runtime calls), with
 * two differences: no directory-flow hole dependency (Add Workspace is
 * self-contained via `pickDirectory`), and no locale-keyed naming collision.
 */
import type { PropsLocale, PropsRuntime, PropsStore, SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-slots';
import type { SessionId } from '@deepseek-ai/dsh-session/types';
import type { SessionListState, SessionSearchResultItem } from '@deepseek-ai/dsh-api-session-controller/client';
import type { SessionStatusSnapshot } from '@deepseek-ai/dsh-client-ui-session/client';
import type { WorkspaceId, WorkspaceView } from '@deepseek-ai/dsh-api-workspace-controller/client';
import type { createGroupsViewStore } from './stores.ts';
import type { SessionTabsInstance, SessionTabsState } from './tab-store.ts';
/** Services/slots this registrant's props depend on (documentation alias). */
export type WorkspaceGroupsStoreHandle = ReturnType<typeof createGroupsViewStore>;
/** Injected share (arrives via the register inject factory). */
export type GroupsBrowserInjected = {
    /** Start a New Session in a Workspace (reuse-or-create its blank session and open it). */
    startSession: (workspaceId?: WorkspaceId) => void;
    /** Open a real Session. */
    open: (sessionId: SessionId) => void;
    /** Search current visible conversation messages. */
    searchSessions: (query: string, signal: AbortSignal) => Promise<{
        items: readonly SessionSearchResultItem[];
        hasMore: boolean;
    }>;
    /** Maximum number of merged rows rendered for one search. */
    searchResultLimit: number;
    /** Rename a Session (resolves on host acceptance). */
    renameSession: (sessionId: SessionId, title: string) => Promise<void>;
    /** Fork a Session at its last completed turn and open the child. */
    forkSession: (sessionId: SessionId) => void;
    /** Rename a Host Workspace (rejects on name conflict). */
    renameWorkspace: (workspaceId: WorkspaceId, title: string) => Promise<void>;
    /** Delete only a Host Workspace registration; directory and Session logs remain. */
    deleteWorkspace: (workspaceId: WorkspaceId) => Promise<void>;
    /** Reorder a Workspace in the durable registry display order (omitted anchor appends). */
    insertWorkspaceBefore: (workspaceId: WorkspaceId, beforeWorkspaceId?: WorkspaceId) => Promise<void>;
    /** Archive a Session into the registry-global set (hidden from grouping surfaces). */
    archiveSession: (sessionId: SessionId) => Promise<void>;
    /** Reorder a session inside its Workspace account. */
    insertSessionBefore: (workspaceId: WorkspaceId, sessionId: SessionId, beforeSessionId?: SessionId) => Promise<void>;
    /** Adopt a picked host directory as a real Workspace before targeting a Session. */
    createWorkspace: (input: {
        path: string;
    }) => Promise<WorkspaceView>;
    /** Ask the local Host to open its native single-directory chooser (self-contained Add Workspace). */
    pickDirectory: () => Promise<string | null>;
    /**
     * Surface the session-tab strip for a newly opened session (called with the
     * session the browser itself just opened). Tab visibility rules live in
     * `tabs.ts`; the browser also calls this for the open session on every list
     * change, which is what makes "click a session → a tab appears" hold for
     * every entry point (sidebar, quick panel, conversation-header crumbs).
     */
    openTab: (sessionId: SessionId) => void;
    /**
     * Selector hook over the shared tab store, bound by this plugin (the strip is
     * not a slot occupant, so the framework does not bind it). Built from the one
     * live instance the browser writes through.
     */
    useTabs: <S>(selector: (state: SessionTabsState) => S, eq?: (a: S, b: S) => boolean) => S;
    /** The tab store's baked write set (the same one `apply` writes through). */
    tabActions: SessionTabsInstance['actions'];
};
/** Full browser props: shell owner share + viewing store + injected actions + locale seat. */
export type GroupsBrowserProps = PropsRuntime<'sidebar.workspaces'> & PropsStore<ReturnType<typeof createGroupsViewStore>> & GroupsBrowserInjected & PropsLocale<'workspaceGroups'>;
/**
 * The two framework global seats the strip reads, declared structurally because
 * `GlobalStandardProps`'s own members arrive from merge declarations this repo
 * cannot resolve (its packages ship no `src`, so the merged hook types are only
 * visible to the compiling package). Both are the shipped global selector hooks
 * with the same names and shapes, and both are seated on the
 * `sidebar.workspaces` occupant that renders this strip.
 */
export interface SessionsTabsStandardProps {
    /** Session list and current selection (framework global seat). */
    useSessions: SnapshotSelectorHook<SessionListState>;
    /** Unified per-session UI status (framework global seat). */
    useSessionStatus: SnapshotSelectorHook<SessionStatusSnapshot>;
}
/**
 * Full tab-strip props.
 *
 * The strip is NOT a slot occupant: the conversation column declares no child
 * slot, so it renders through a DOM seat (`tab-seat.ts`) and receives plain
 * React props instead of framework shares. Only the two global selector hooks
 * below are framework-provided, and they arrive because the strip is rendered
 * as a CHILD of this plugin's own `sidebar.workspaces` occupant — which seats
 * both of them in the standard kit. Everything else is passed explicitly by
 * that parent, which is what removes the strip from the slot registry entirely
 * and with it the cross-scope store conflict the slot version hit.
 */
export type SessionsTabsProps = SessionsTabsStandardProps & {
    /** Selector hook over the shared tab store's snapshot. */
    useTabs: SnapshotSelectorHook<SessionTabsState>;
    /** The tab store's baked write set (the same set `apply` writes through). */
    actions: SessionTabsInstance['actions'];
    /** Make a tab's session the open one (`ctx.uiWorkspace.openSession`). */
    activate: (sessionId: SessionId) => void;
    /** Ask the browser to open its rename dialog for a tab session. */
    rename: (sessionId: SessionId, currentTitle: string) => void;
} & PropsLocale<'workspaceGroups'>;
