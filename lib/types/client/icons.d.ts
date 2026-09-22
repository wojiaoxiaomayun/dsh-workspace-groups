import type { IconProps } from '@deepseek-ai/dsh-client-ui-primitives';
import type { ReactElement } from 'react';
/** One icon component: takes the shared icon props, renders an element. */
export type IconComponent = (props: IconProps) => ReactElement;
/**
 * Legacy size-suffixed name → 0.1.7 weight-suffixed component name. Variants
 * that only ever shipped one weight map onto the `Regular` artwork.
 */
declare const ICON_ALIASES: {
    readonly IconArchiveOutline16: "IconArchiveOutlineRegular";
    readonly IconArchiveOutline20: "IconArchiveOutlineRegular";
    readonly IconBranchOutline16: "IconBranchOutlineRegular";
    readonly IconCloseFill14: "IconCloseFillRegular";
    readonly IconEditOutline16: "IconEditOutlineRegular";
    readonly IconEllipsisOutline16: "IconEllipsisOutlineRegular";
    readonly IconFolderClose16: "IconFolderCloseRegular";
    readonly IconFolderOpen16: "IconFolderOpenRegular";
    readonly IconFolderOpenOutline16: "IconFolderOpenOutlineRegular";
    readonly IconPlusOutline16: "IconPlusOutlineRegular";
    readonly IconProjectAddOutline16: "IconProjectAddOutlineRegular";
    readonly IconRightUpOutline16: "IconRightUpOutlineRegular";
    readonly IconSearchOutline16: "IconSearchOutlineRegular";
    readonly IconTrashOutline16: "IconTrashOutlineRegular";
    readonly IconTriangleRightFill14: "IconTriangleRightFillRegular";
    readonly IconWarningOutline16: "IconWarningOutlineRegular";
};
/** Legacy icon names this build expects to resolve. */
export type LegacyIconName = keyof typeof ICON_ALIASES;
/** 0.1.7-resolution of every icon this plugin draws. */
export declare const IconArchiveOutline20: IconComponent;
export declare const IconBranchOutline16: IconComponent;
export declare const IconCloseFill14: IconComponent;
export declare const IconEditOutline16: IconComponent;
export declare const IconEllipsisOutline16: IconComponent;
export declare const IconFolderClose16: IconComponent;
export declare const IconFolderOpen16: IconComponent;
export declare const IconFolderOpenOutline16: IconComponent;
export declare const IconPlusOutline16: IconComponent;
export declare const IconProjectAddOutline16: IconComponent;
export declare const IconRightUpOutline16: IconComponent;
export declare const IconSearchOutline16: IconComponent;
export declare const IconTrashOutline16: IconComponent;
export declare const IconTriangleRightFill14: IconComponent;
export declare const IconWarningOutline16: IconComponent;
export {};
