/**
 * Pure data shaping for the Ctrl+R quick switch panel. Runtime-free (same
 * discipline as store-core.ts): unit tests exercise the real semantics
 * without a browser module loader; the panel only binds them to the
 * framework's global hooks.
 */
import type { SessionId } from '@deepseek-ai/dsh-session/types';
import type { SessionListState, SessionSummary } from '@deepseek-ai/dsh-api-session-controller/client';
import type { WorkspaceView } from '@deepseek-ai/dsh-api-workspace-controller/client';
/**
 * Running quick-switchable sessions across the whole list, newest first.
 * @param list - sessions list snapshot.
 * @param archived - registry-global archive set (archived rows never surface).
 * @returns running summaries in recency order (id as deterministic tiebreak).
 */
export declare function runningSessions(list: SessionListState, archived: ReadonlySet<SessionId>): SessionSummary[];
/**
 * Most recently updated running session inside one workspace.
 * @param list - sessions list snapshot.
 * @param workspace - target workspace (its session account order is irrelevant;
 * recency picks the row).
 * @returns the session id, or undefined when nothing in the workspace runs.
 */
export declare function latestRunningInWorkspace(list: SessionListState, workspace: WorkspaceView): SessionId | undefined;
/**
 * Running-session count per workspace id (badge on the workspace tab rows).
 * @param running - runningSessions() output.
 * @param workspaces - real workspaces in stable Host order.
 * @returns counts keyed by workspace id; absent key = none running.
 */
export declare function runningCountByWorkspace(running: readonly SessionSummary[], workspaces: readonly WorkspaceView[]): Map<string, number>;
/**
 * The workspace that owns the currently open session.
 * @param workspaces - real workspaces in stable Host order.
 * @param currentSessionId - `list.current` (the open session); may be undefined
 *   (no session open, cleared selection) or an id no listed workspace holds
 *   (e.g. an addressed subagent session).
 * @returns the workspace id, or undefined when there is no active workspace.
 */
export declare function activeWorkspaceId(workspaces: readonly WorkspaceView[], currentSessionId: SessionId | undefined): string | undefined;
/**
 * Workspace search for the quick panel: title prefix → title substring →
 * category label substring → path substring; ties keep host order via a
 * stable title compare inside one rank.
 * @param workspaces - real workspaces in stable Host order.
 * @param query - raw query (trimmed, case-insensitive).
 * @param categoryLabelOf - category label resolver (grouped workspaces only).
 * @param limit - hard render cap.
 * @returns ranked matches; an empty query returns host order.
 */
export declare function filterWorkspaces(workspaces: readonly WorkspaceView[], query: string, categoryLabelOf?: (workspace: WorkspaceView) => string | undefined, limit?: number): WorkspaceView[];
