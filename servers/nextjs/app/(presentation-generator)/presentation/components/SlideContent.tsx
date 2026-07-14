import React, { memo, useEffect } from "react";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import SlideScale from "../../components/PresentationRender";
import SlideActionBar from "./SlideActionBar";

interface SlideContentProps {
  slide: any;
  index: number;
  presentationId: string;
  onSlideAdded?: (
    index: number,
    options?: {
      promptOverlaySlideId?: string;
      promptOverlayKind?: "blank" | "layout";
    },
  ) => void;
  isChatEditing?: boolean;
  showBlankPromptOverlay?: boolean;
  onBlankPromptOverlayDismiss?: () => void;
  showTemplatePromptOverlay?: boolean;
  onTemplatePromptOverlayDismiss?: () => void;
  theme?: unknown;
  fonts?: unknown;
  editingDisabled?: boolean;
  isStreaming?: boolean | null;
}

const SlideContent = ({
  slide,
  index,
  presentationId,
  onSlideAdded,
  isChatEditing = false,
  showBlankPromptOverlay = false,
  onBlankPromptOverlayDismiss,
  showTemplatePromptOverlay = false,
  onTemplatePromptOverlayDismiss,
  theme,
  fonts,
  editingDisabled = false,
  isStreaming = false,
}: SlideContentProps) => {
  const canEditSlide = !editingDisabled && isStreaming !== true;
  const slideLayout = typeof slide?.layout === "string" ? slide.layout : "";

  const slideLayoutGroup =
    typeof slide?.layout_group === "string" ? slide.layout_group : "";
  const slideLayoutTemplateId =
    typeof slide?.layout === "string" ? slide.layout.split(":")[0] : "";
  const slideTemplateId = slideLayoutGroup.startsWith("template-v2")
    ? slideLayoutGroup
    : slideLayoutGroup || slideLayoutTemplateId;
  const isTemplateV2Slide = slideTemplateId.startsWith("template-v2");

  useEffect(() => {
    if (slideLayout.includes("custom")) {
      const existingScript = document.querySelector(
        'script[src*="tailwindcss.com"]'
      );
      if (!existingScript) {
        const script = document.createElement("script");
        script.src = "https://cdn.tailwindcss.com";
        script.async = true;
        document.head.appendChild(script);
      }
    }
  }, [slideLayout, isStreaming]);

  return (
    <div
      id={`slide-${index}`}
      className="main-slide relative flex w-full items-center justify-center max-md:mb-4"
    >
      {isStreaming && (
        <Loader2 className="absolute right-2 top-2 z-30 h-8 w-8 animate-spin text-blue-800" />
      )}
      <div
        data-layout={slide?.layout}
        data-group={slide?.layout_group}
        className={`group w-full font-syne ${isTemplateV2Slide ? "relative" : ""
          }`}
      >
        <div className="relative max-xl:mb-6">
          {isChatEditing && (
            <div
              className="pointer-events-none absolute inset-x-0 bottom-4 z-30 flex justify-center font-syne"
              aria-live="polite"
            >
              <span className="inline-flex items-center rounded-[50px] bg-[linear-gradient(179deg,#F2E1FB_0%,#FFFFFF_100%)] p-[10px] shadow-[0_4px_18px_rgba(40,35,68,0.12)]">
                <span className="flex items-center justify-center gap-[3px] px-1">
                  <Image
                    src="/ai-star.svg"
                    alt=""
                    width={13}
                    height={14}
                    className="h-[14px] w-[13px] shrink-0"
                    aria-hidden="true"
                  />
                  <span className="text-[13px] font-normal leading-[14px] tracking-[0.39px] text-[#666666]">
                    Generating slides...
                  </span>
                </span>
              </span>
            </div>
          )}
          <SlideScale
            slide={slide}
            presentationId={presentationId}
            isEditMode={canEditSlide}
            isClickable={canEditSlide}
            theme={theme ?? null}
            fonts={fonts}
            renderIndex={index}
            showBlankPromptOverlay={showBlankPromptOverlay}
            onBlankPromptOverlayDismiss={onBlankPromptOverlayDismiss}
            showTemplatePromptOverlay={showTemplatePromptOverlay}
            onTemplatePromptOverlayDismiss={onTemplatePromptOverlayDismiss}
          />
        </div>
        <div className="my-4 hidden w-full xl:block">
          <SlideActionBar
            slide={slide}
            selectedSlide={index}
            presentationId={presentationId}
            onSlideSelected={onSlideAdded ?? (() => undefined)}
            revealOnGroupHover
          />
        </div>
      </div>
    </div>
  );
};

export default memo(
  SlideContent,
  (previous, next) =>
    previous.slide === next.slide &&
    previous.index === next.index &&
    previous.presentationId === next.presentationId &&
    previous.onSlideAdded === next.onSlideAdded &&
    previous.isChatEditing === next.isChatEditing &&
    previous.showBlankPromptOverlay === next.showBlankPromptOverlay &&
    previous.showTemplatePromptOverlay === next.showTemplatePromptOverlay &&
    previous.theme === next.theme &&
    previous.fonts === next.fonts &&
    previous.editingDisabled === next.editingDisabled &&
    previous.isStreaming === next.isStreaming,
);
