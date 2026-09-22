/**
 * Icon resolution across the ui-primitives icon-set rename.
 *
 * 0.1.6 shipped size-suffixed icon exports (`IconFolderOpen16`,
 * `IconArchiveOutline20`, `IconTriangleRightFill14`, …) and this plugin's call
 * sites use those names. 0.1.7-alpha.1 replaced the whole set with
 * weight-suffixed names (`IconFolderOpenRegular` / `…Medium`) and dropped every
 * legacy export.
 *
 * The failure mode is nasty rather than loud: `const { IconX16 } = primitives`
 * yields `undefined`, React renders `<undefined/>` as error #130, the slot
 * error boundary catches it, and the slot core *retires* the crashed entry for
 * good — silently swapping the whole grouped browser back to the official
 * workspace list. Resolving through this table means a renamed icon degrades to
 * a visible placeholder instead of taking the region down. The call sites keep
 * passing their historical `size` hints, which the new icon props still accept.
 */
import * as primitives from '@deepseek-ai/dsh-client-ui-primitives'
import type { IconProps } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ReactElement } from 'react'

/** One icon component: takes the shared icon props, renders an element. */
export type IconComponent = (props: IconProps) => ReactElement

/** An empty replacement so a missing icon is a blank gap, never a crash. */
function MissingIcon(): ReactElement {
  return null as unknown as ReactElement
}

/**
 * Legacy size-suffixed name → 0.1.7 weight-suffixed component name. Variants
 * that only ever shipped one weight map onto the `Regular` artwork.
 */
const ICON_ALIASES = {
  IconArchiveOutline16: 'IconArchiveOutlineRegular',
  IconArchiveOutline20: 'IconArchiveOutlineRegular',
  IconBranchOutline16: 'IconBranchOutlineRegular',
  IconCloseFill14: 'IconCloseFillRegular',
  IconEditOutline16: 'IconEditOutlineRegular',
  IconEllipsisOutline16: 'IconEllipsisOutlineRegular',
  IconFolderClose16: 'IconFolderCloseRegular',
  IconFolderOpen16: 'IconFolderOpenRegular',
  IconFolderOpenOutline16: 'IconFolderOpenOutlineRegular',
  IconPlusOutline16: 'IconPlusOutlineRegular',
  IconProjectAddOutline16: 'IconProjectAddOutlineRegular',
  IconRightUpOutline16: 'IconRightUpOutlineRegular',
  IconSearchOutline16: 'IconSearchOutlineRegular',
  IconTrashOutline16: 'IconTrashOutlineRegular',
  IconTriangleRightFill14: 'IconTriangleRightFillRegular',
  IconWarningOutline16: 'IconWarningOutlineRegular',
} as const

/** Legacy icon names this build expects to resolve. */
export type LegacyIconName = keyof typeof ICON_ALIASES

/** The shipped icon set, read structurally (the export surface is not typed as an index). */
const SHIPPED = primitives as unknown as Record<string, IconComponent | undefined>

/**
 * Resolve one legacy icon name against the installed ui-primitives build: the
 * 0.1.7 weight-suffixed export first, then the legacy name itself (so a build
 * that still ships the old set keeps working).
 * @param name - legacy size-suffixed icon name.
 * @returns the icon component, or a blank placeholder when neither exists.
 */
function resolveIcon(name: LegacyIconName): IconComponent {
  const resolved = SHIPPED[ICON_ALIASES[name]] ?? SHIPPED[name]
  if (typeof resolved === 'function') return resolved
  console.error(`workspace-groups: icon "${name}" (${ICON_ALIASES[name]}) is missing from ui-primitives; rendering a blank placeholder`)
  return MissingIcon
}

/** 0.1.7-resolution of every icon this plugin draws. */
export const IconArchiveOutline20 = resolveIcon('IconArchiveOutline20')
export const IconBranchOutline16 = resolveIcon('IconBranchOutline16')
export const IconCloseFill14 = resolveIcon('IconCloseFill14')
export const IconEditOutline16 = resolveIcon('IconEditOutline16')
export const IconEllipsisOutline16 = resolveIcon('IconEllipsisOutline16')
export const IconFolderClose16 = resolveIcon('IconFolderClose16')
export const IconFolderOpen16 = resolveIcon('IconFolderOpen16')
export const IconFolderOpenOutline16 = resolveIcon('IconFolderOpenOutline16')
export const IconPlusOutline16 = resolveIcon('IconPlusOutline16')
export const IconProjectAddOutline16 = resolveIcon('IconProjectAddOutline16')
export const IconRightUpOutline16 = resolveIcon('IconRightUpOutline16')
export const IconSearchOutline16 = resolveIcon('IconSearchOutline16')
export const IconTrashOutline16 = resolveIcon('IconTrashOutline16')
export const IconTriangleRightFill14 = resolveIcon('IconTriangleRightFill14')
export const IconWarningOutline16 = resolveIcon('IconWarningOutline16')
