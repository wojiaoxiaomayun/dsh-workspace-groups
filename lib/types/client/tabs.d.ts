/**
 * Pure session-tab state: the ordered strip of sessions the user has opened,
 * the active one, and each tab's derived presentation.
 *
 * Runtime-free on purpose (same discipline as `store-core.ts` / `quick.ts`):
 * the component owns the ref + React state, this module owns every rule, and
 * unit tests exercise the real semantics without a browser module loader.
 *
 * Retention note: a tab is only a *display* record. The session it names is
 * retained by the navigation layer while it is the open session, so a
 * background tab's id always resolves — either still in the session catalog
 * (titles/status follow live) or gone (deleted/archived → the tab closes
 * itself through {@link closeMissingTabs}).
 */
import type { SessionId } from '@deepseek-ai/dsh-session/types';
import type { SessionListState, SessionSummary } from '@deepseek-ai/dsh-api-session-controller/client';
import type { SessionStatus } from '@deepseek-ai/dsh-client-ui-session/client';
/** One open tab: a session id plus its arrival key (React list identity). */
export interface SessionTab {
    /** The session the tab shows. */
    readonly sessionId: SessionId;
    /** Monotonic arrival key; a reopened session gets a fresh entry at the end. */
    readonly order: number;
}
/** Feature switch: whether opening a session also surfaces a tab. */
export type TabOpenMode = 'auto' | 'manual';
/** Per-tab indicator derived from the catalog summary and the live UI status. */
export interface SessionTabIndicator {
    /** A domain request is waiting for the user (approval / plan review / question). */
    readonly attention: boolean;
    /** The agent is producing output, or a descendant subagent is. */
    readonly running: boolean;
    /** The turn finished while the tab was in the background and was never looked at. */
    readonly unread: boolean;
    /** Idle tab whose session already has a title (a settled conversation). */
    readonly settled: boolean;
}
/**
 * Append the arrival to the strip, or move an existing entry to the front.
 * Reopen-first is a pointer, not compaction: closing the tab a second time
 * still leaves exactly one entry per session.
 * @param tabs - current strip (oldest first).
 * @param sessionId - arriving session.
 * @param nextOrder - monotonic arrival counter to spend when appending.
 * @returns a new strip (the input array is never mutated).
 */
export declare function appendTab(tabs: readonly SessionTab[], sessionId: SessionId, nextOrder: number): SessionTab[];
/**
 * Remove one session's tab. An absent session leaves the strip untouched.
 * @param tabs - current strip.
 * @param sessionId - session whose tab closes.
 * @returns a new strip.
 */
export declare function removeTab(tabs: readonly SessionTab[], sessionId: SessionId): SessionTab[];
/**
 * Close every tab whose session left the catalog (deleted or archived), so a
 * dead tab can never be clicked.
 * @param tabs - current strip.
 * @param list - sessions list snapshot (`byId` is the catalog authority).
 * @returns a new strip when something closed; the SAME array when nothing did
 *   (the effect that calls this must not re-render on a no-op).
 */
export declare function closeMissingTabs(tabs: readonly SessionTab[], list: SessionListState): SessionTab[];
/**
 * Sort the strip for display: the active tab leftmost, the rest in arrival
 * order. The returned order is derived, so it stays correct no matter which
 * tab was clicked last.
 * @param tabs - strip in arrival order.
 * @param activeId - the open session, if it has a tab.
 * @returns a new display array.
 */
export declare function orderedTabs(tabs: readonly SessionTab[], activeId: SessionId | undefined): SessionTab[];
/**
 * Whether the open session must surface a tab.
 * @param mode - feature switch ('auto' opens tabs for every opened session).
 * @param summary - the open session's catalog row, absent while the catalog
 *   has not caught up with a just-created session.
 * @returns true when a tab belongs in the strip.
 */
export declare function shouldOpenTab(mode: TabOpenMode, summary: SessionSummary | undefined): boolean;
/**
 * Derive one tab's indicators from the catalog row and the unified UI status.
 * @param summary - the tab session's catalog row (absent → inert indicators).
 * @param status - the tab session's unified UI status (absent → idle).
 * @returns the indicator quadruple.
 */
export declare function tabIndicator(summary: SessionSummary | undefined, status: SessionStatus | undefined): SessionTabIndicator;
/**
 * Whether two strips are the same sequence of sessions (arrival keys ignored).
 * @param left - previous strip.
 * @param right - next strip.
 * @returns true when no entry was added, removed, or reordered.
 */
export declare function sameTabs(left: readonly SessionTab[], right: readonly SessionTab[]): boolean;
