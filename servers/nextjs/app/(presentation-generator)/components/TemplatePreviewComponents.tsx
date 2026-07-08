"use client";
/* eslint-disable @next/next/no-img-element */
import React, { memo } from "react";
import { resolveBackendAssetUrl } from "@/utils/api";

export function TemplatePreviewStage({ children }: { children: React.ReactNode }) {
    return (
        <div className="relative overflow-hidden px-5 pb-5 pt-5 h-[230px]">
            <img
                src="/card_bg.svg"
                alt=""
                className="absolute top-0 left-0 w-full h-full object-cover"
            />
            {children}
        </div>
    );
}

export const LayoutsBadge = memo(function LayoutsBadge({ count }: { count: number }) {
    return (
        <span className="text-xs font-syne absolute top-3.5 left-4 z-40 inline-flex items-center rounded-full bg-[#333333] px-3 py-1 font-semibold text-white">
            Layouts-{count}
        </span>
    );
});

export const TemplateThumbnailPreview = memo(function TemplateThumbnailPreview({
    thumbnail,
    templateName,
}: {
    thumbnail?: string | null;
    templateName: string;
}) {
    const resolvedThumbnail = thumbnail ? resolveBackendAssetUrl(thumbnail) : "";

    if (!resolvedThumbnail) {
        return (
            <div className="relative z-10 flex h-full items-center justify-center rounded-xl border border-[#EDEEEF] bg-white/80">
                <div className="h-10 w-16 rounded-md border border-dashed border-[#C9CDD8] bg-[#F7F8FB]" />
            </div>
        );
    }

    return (
        <div className="relative z-10 flex h-full items-center justify-center">
            <div
                aria-label={`${templateName} thumbnail`}
                className="h-full w-full rounded-xl border border-[#EDEEEF] bg-white bg-cover bg-center shadow-sm"
                role="img"
                style={{ backgroundImage: `url(${JSON.stringify(resolvedThumbnail)})` }}
            />
        </div>
    );
});

export const ScaledSlidePreview = memo(function ScaledSlidePreview({
    children,
    index,
    isOutline = false,
}: {
    children: React.ReactNode;
    index: number;
    isOutline?: boolean;
}) {
    const PREVIEW_SCALE = isOutline ? 0.2 : 0.24;
    const SLIDE_HEIGHT = 720 * PREVIEW_SCALE;
    const SLIDE_WIDTH = 1280;
    const SLIDE_NATIVE_HEIGHT = 720;
    return (
        <div
            className="relative"
            style={{ height: `${SLIDE_HEIGHT}px`, overflow: "hidden" }}
        >
            <div
                className={`absolute top-0 ${isOutline ? "left-0" : "left-8"} pointer-events-none`}
                style={{
                    width: SLIDE_WIDTH,
                    height: SLIDE_NATIVE_HEIGHT,
                    transformOrigin: "top left",
                    transform: `scale(${PREVIEW_SCALE})`,
                }}
            >
                {children}
            </div>
        </div>
    );
});
