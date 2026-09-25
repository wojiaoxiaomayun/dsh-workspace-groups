/**
 * The session-tab store. One handle, two registrations: the sidebar browser
 * entry owns the strip's *lifecycle* (which sessions hold a tab, in what order)
 * and the composer-footer strip entry only renders it — the persisted session
 * list is the shared memory, so both halves agree without either one holding
 * business state of its own.
 *
 * Placement is navigation, not data: the strip derives its active chip and its
 * display order from the open session, so nothing here mirrors selection.
 *
 * The action implementations live in `tabs.ts` (pure, runtime-free) so unit
 * tests exercise the real semantics without a browser module loader.
 */
import { type EngineStoreHandle, type StoreHandle } from '@deepseek-ai/dsh-client-store';
import type { SessionId } from '@deepseek-ai/dsh-session/types';
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client';
import { type SessionTab } from './tabs.ts';
/** Session-tab strip state. */
export interface SessionTabsState {
    /** Open tabs, oldest first (display order is derived at render time). */
    tabs: SessionTab[];
    /** Monotonic arrival counter; a reopened session gets a fresh key. */
    order: number;
}
/** Session-tab strip actions (bound by the framework, handed to both entries). */
export interface SessionTabsActions {
    /** Append the open session, or move its existing tab to the front. */
    touch: (sessionId: SessionId) => void;
    /** Close one tab; navigation is untouchable from here (the caller decides). */
    close: (sessionId: SessionId) => void;
    /** Drop tabs whose session left the catalog (deleted / archived). */
    closeMissing: (list: SessionListState) => void;
}
declare function touchImpl(state: SessionTabsState, sessionId: SessionId): void;
declare function closeImpl(state: SessionTabsState, sessionId: SessionId): void;
declare function closeMissingImpl(state: SessionTabsState, list: SessionListState): void;
/** Annotation twin of the actions literal below (structural `ActionsDecl`). */
type SessionTabsActionsDecl = {
    touch: typeof touchImpl;
    close: typeof closeImpl;
    closeMissing: typeof closeMissingImpl;
};
/**
 * The tab store's registered handle: identity + spec + the instance factory the
 * framework resolves per entry x scope. It deliberately does NOT claim the live
 * instance's faces (`getSnapshot` / `actions`) — `defineStore`'s concrete return
 * is structurally narrower, and this alias has to stay a type that value can be
 * assigned to.
 */
export type SessionTabsStoreHandle = StoreHandle<SessionTabsState, SessionTabsActionsDecl>;
/**
 * The live tab store value: the handle's `create()` product, which carries the
 * baked write set and the snapshot source. Named here so the registrations and
 * the strip's props can share one type without importing the store engine.
 */
export type SessionTabsInstance = ReturnType<EngineStoreHandle<SessionTabsState, SessionTabsActionsDecl>['create']>;
/**
 * Create the session-tab store handle.
 * @returns the store handle (spec + type + identity + factory in one).
 */
export declare function createSessionTabsStore(): EngineStoreHandle<SessionTabsState, SessionTabsActionsDecl>;
export type { SessionTab };
