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
import type { Context } from '@deepseek-ai/cordis';
import type { SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-slots';
import type { WorkspaceSnapshot } from '@deepseek-ai/dsh-api-workspace-controller/client';
import { type WorkspaceGroupsKey } from './locales.ts';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** The workspace-groups browsing region copy. */
        workspaceGroups: WorkspaceGroupsKey;
    }
    interface GlobalStandardProps {
        /** Selector hook over the pure Workspace Controller snapshot. */
        useWorkspaces: SnapshotSelectorHook<WorkspaceSnapshot>;
    }
}
/** Required services (cordis fiber inject; 0.1.2 service roster). */
export declare const inject: string[];
/**
 * Register the grouped browser once the sidebar slot declaration is on the
 * ledger. Inject factory returns plain callbacks; data reads use the
 * framework's global hooks.
 * @param ctx - client root context.
 */
export declare function apply(ctx: Context): void;
