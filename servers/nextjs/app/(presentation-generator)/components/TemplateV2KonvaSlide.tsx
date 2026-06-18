"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { useHotkey } from "@tanstack/react-hotkeys";
import { Provider, useAtomValue, useSetAtom } from "jotai";
import { useHydrateAtoms } from "jotai/utils";
import { Loader2, Plus } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { notify } from "@/components/ui/sonner";
import {
  adaptTemplateV2LayoutToSlide,
  applyGeneratedSlideContentToLayout,
  type TemplateV2Layout,
} from "@/components/slide-editor/lib/template-v2-import";
import {
  DeckSchema,
  SLIDE_W,
  SlideSchema,
  type Deck,
  type Slide as KonvaSlideData,
  type SlideElement,
} from "@/components/slide-editor/lib/slide-schema";
import { SlideSurface } from "@/components/slide-editor/slide-surface";
import { WorkspaceInlineEditors } from "@/components/slide-editor/workspace/WorkspaceInlineEditors";
import { WorkspaceToolbars } from "@/components/slide-editor/workspace/WorkspaceToolbars";
import {
  canRedoAtom,
  canUndoAtom,
  deckAtom,
  insertElementsAtom,
  redoAtom,
  undoAtom,
} from "@/components/slide-editor/state";
import { updateSlide } from "@/store/slices/presentationGeneration";

export const TEMPLATE_V2_KONVA_SLIDE_CONTENT_KEY =
  "__template_v2_konva_slide__";
export const TEMPLATE_V2_COMPONENT_DRAWER_EVENT =
  "presenton:template-v2-component-drawer";

const STAGE_WIDTH = 1280;
const STAGE_HEIGHT = 720;
const STAGE_SCALE = STAGE_WIDTH / SLIDE_W;

type TemplateV2KonvaSlideProps = {
  layout: TemplateV2Layout;
  slide: any;
  isEditMode: boolean;
  components?: unknown;
};

export function TemplateV2KonvaSlide({
  layout,
  slide,
  isEditMode,
  components,
}: TemplateV2KonvaSlideProps) {
  const initialSlide = useMemo(
    () => buildKonvaSlide(layout, slide),
    [layout, slide],
  );

  if (!initialSlide) {
    return (
      <div className="flex h-full aspect-video flex-col items-center justify-center rounded-lg bg-gray-100">
        <Loader2 className="mb-2 h-4 w-4 animate-spin" />
        <p className="text-center text-sm text-gray-600">
          Loading slide layout...
        </p>
      </div>
    );
  }

  return (
    <Provider key={slide.id ?? `${slide.layout}-${slide.index}`}>
      <TemplateV2KonvaSlideBody
        initialSlide={initialSlide}
        presentationSlide={slide}
        isEditMode={isEditMode}
        components={components}
      />
    </Provider>
  );
}

function TemplateV2KonvaSlideBody({
  initialSlide,
  isEditMode,
  presentationSlide,
  components,
}: {
  initialSlide: KonvaSlideData;
  isEditMode: boolean;
  presentationSlide: any;
  components?: unknown;
}) {
  const dispatch = useDispatch();
  const surfaceId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [componentDrawerOpen, setComponentDrawerOpen] = useState(false);
  const initialDeck = useMemo(
    () =>
      DeckSchema.parse({
        title: presentationSlide.title || `Slide ${presentationSlide.index + 1}`,
        description: null,
        slides: [initialSlide],
      } satisfies Deck),
    [initialSlide, presentationSlide.index, presentationSlide.title],
  );
  const [hydratedDeck] = useState(initialDeck);

  useHydrateAtoms([[deckAtom, hydratedDeck]]);

  const deck = useAtomValue(deckAtom);
  const canUndo = useAtomValue(canUndoAtom);
  const canRedo = useAtomValue(canRedoAtom);
  const undo = useSetAtom(undoAtom);
  const redo = useSetAtom(redoAtom);
  const insertElements = useSetAtom(insertElementsAtom);
  const activeSlide = deck.slides[0];
  const componentItems = useMemo(
    () => extractTemplateV2ComponentItems(components),
    [components],
  );
  const lastSyncedSlideRef = useRef(JSON.stringify(activeSlide));
  const isSurfaceActive = useCallback(
    () =>
      typeof document !== "undefined" &&
      document.documentElement.dataset.templateV2KonvaActiveSurface === surfaceId,
    [surfaceId],
  );

  const activateSurface = useCallback(() => {
    document.documentElement.dataset.templateV2KonvaActiveSurface = surfaceId;
  }, [surfaceId]);

  const clearSurface = useCallback(() => {
    if (
      document.documentElement.dataset.templateV2KonvaActiveSurface === surfaceId
    ) {
      delete document.documentElement.dataset.templateV2KonvaActiveSurface;
    }
  }, [surfaceId]);

  useHotkey("Mod+Z", (event) => {
    if (!isEditMode || !isSurfaceActive() || !canUndo) return;
    event.preventDefault();
    event.stopPropagation();
    undo();
  });

  useHotkey("Mod+Shift+Z", (event) => {
    if (!isEditMode || !isSurfaceActive() || !canRedo) return;
    event.preventDefault();
    event.stopPropagation();
    redo();
  });

  useHotkey("Mod+Y", (event) => {
    if (!isEditMode || !isSurfaceActive() || !canRedo) return;
    event.preventDefault();
    event.stopPropagation();
    redo();
  });

  useEffect(() => {
    if (!isEditMode) return;

    const serialized = JSON.stringify(activeSlide);
    if (serialized === lastSyncedSlideRef.current) return;
    lastSyncedSlideRef.current = serialized;

    dispatch(
      updateSlide({
        index: presentationSlide.index,
        slide: {
          ...presentationSlide,
          content: {
            ...(presentationSlide.content ?? {}),
            [TEMPLATE_V2_KONVA_SLIDE_CONTENT_KEY]: activeSlide,
          },
        },
      }),
    );
  }, [activeSlide, dispatch, isEditMode, presentationSlide]);

  useEffect(() => {
    if (!isEditMode) return;

    const handleOpenComponentDrawer = (event: Event) => {
      const detail = (event as CustomEvent<TemplateV2ComponentDrawerDetail>)
        .detail;
      if (!detail) return;

      const slideId = presentationSlide.id ? String(presentationSlide.id) : null;
      const eventSlideId =
        detail.slideId !== undefined && detail.slideId !== null
          ? String(detail.slideId)
          : null;
      if (eventSlideId && slideId && eventSlideId !== slideId) return;
      if (
        !eventSlideId &&
        typeof detail.slideIndex === "number" &&
        detail.slideIndex !== presentationSlide.index
      ) {
        return;
      }

      activateSurface();
      setComponentDrawerOpen(true);
    };

    window.addEventListener(
      TEMPLATE_V2_COMPONENT_DRAWER_EVENT,
      handleOpenComponentDrawer,
    );
    return () => {
      window.removeEventListener(
        TEMPLATE_V2_COMPONENT_DRAWER_EVENT,
        handleOpenComponentDrawer,
      );
    };
  }, [activateSurface, isEditMode, presentationSlide.id, presentationSlide.index]);

  const handleInsertComponent = (item: TemplateV2ComponentItem) => {
    if (item.elements.length === 0) {
      notify.warning("Component unavailable", "This component has no elements.");
      return;
    }

    activateSurface();
    insertElements(item.elements);
    setComponentDrawerOpen(false);
    notify.success("Component added", `${item.name} was added to this slide.`);
  };

  useEffect(() => {
    if (!isEditMode) return;

    const handlePointerDown = (event: PointerEvent) => {
      const root = rootRef.current;
      if (!root) return;

      if (root.contains(event.target as Node)) {
        activateSurface();
        return;
      }

      clearSurface();
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      clearSurface();
    };
  }, [activateSurface, clearSurface, isEditMode]);

  return (
    <div
      ref={rootRef}
      className="relative h-full w-full overflow-hidden bg-white"
      style={{ width: STAGE_WIDTH, height: STAGE_HEIGHT }}
      onPointerDownCapture={isEditMode ? activateSurface : undefined}
    >
      {isEditMode ? (
        <>
          <WorkspaceToolbars
            scale={STAGE_SCALE}
            onEditImage={() => {
              // Image upload is handled by the full editor shell. The old UX keeps
              // prompt-based image edits, so this embedded surface stays scoped.
            }}
          />
          <WorkspaceInlineEditors scale={STAGE_SCALE} />
        </>
      ) : null}
      <SlideSurface
        height={STAGE_HEIGHT}
        interactive={isEditMode}
        onEditImage={() => {}}
        slide={activeSlide}
        width={STAGE_WIDTH}
      />
      {isEditMode ? (
        <TemplateV2ComponentsDrawer
          components={componentItems}
          open={componentDrawerOpen}
          onInsert={handleInsertComponent}
          onOpenChange={setComponentDrawerOpen}
        />
      ) : null}
    </div>
  );
}

function buildKonvaSlide(
  layout: TemplateV2Layout,
  slide: any,
): KonvaSlideData | null {
  const storedSlide = readStoredKonvaSlide(slide.content);
  if (storedSlide) return storedSlide;

  try {
    const renderedLayout = applyGeneratedSlideContentToLayout(
      layout,
      slide.content && typeof slide.content === "object" ? slide.content : {},
    );

    return adaptTemplateV2LayoutToSlide(renderedLayout, slide.index ?? 0);
  } catch (error) {
    console.error("Could not adapt template v2 slide for Konva:", error);
    return null;
  }
}

function readStoredKonvaSlide(content: unknown): KonvaSlideData | null {
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    return null;
  }

  const candidate = (content as Record<string, unknown>)[
    TEMPLATE_V2_KONVA_SLIDE_CONTENT_KEY
  ];
  const parsed = SlideSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

type TemplateV2ComponentDrawerDetail = {
  slideId?: string | null;
  slideIndex?: number | null;
};

type TemplateV2ComponentItem = {
  key: string;
  name: string;
  description: string;
  previewSlide: KonvaSlideData | null;
  elements: SlideElement[];
};

function TemplateV2ComponentsDrawer({
  components,
  open,
  onInsert,
  onOpenChange,
}: {
  components: TemplateV2ComponentItem[];
  open: boolean;
  onInsert: (component: TemplateV2ComponentItem) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const componentCountLabel = `${components.length} component${
    components.length === 1 ? "" : "s"
  }`;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="z-[1200] flex w-[360px] max-w-[92vw] flex-col gap-0 overflow-hidden bg-white p-0 font-syne sm:max-w-[360px]"
      >
        <SheetHeader className="border-b border-[#ECECF1] px-5 py-4 text-left">
          <SheetTitle className="text-base font-medium text-[#191919]">
            Components
          </SheetTitle>
          <SheetDescription className="text-xs text-[#777780]">
            {componentCountLabel}
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {components.length === 0 ? (
            <div className="flex min-h-[180px] items-center justify-center rounded-lg border border-dashed border-[#DADAE2] px-4 text-center text-sm text-[#777780]">
              No reusable components found.
            </div>
          ) : (
            <div className="space-y-3">
              {components.map((component) => (
                <div
                  key={component.key}
                  className="overflow-hidden rounded-lg border border-[#E6E6ED] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
                >
                  <div className="relative aspect-video overflow-hidden bg-[#F7F7FA]">
                    {component.previewSlide ? (
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                        <SlideSurface
                          height={140}
                          interactive={false}
                          slide={component.previewSlide}
                          width={249}
                        />
                      </div>
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-[#777780]">
                        Preview unavailable
                      </div>
                    )}
                  </div>
                  <div className="space-y-3 p-3">
                    <div className="space-y-1">
                      <p className="truncate text-sm font-medium text-[#191919]">
                        {component.name}
                      </p>
                      {component.description ? (
                        <p className="max-h-10 overflow-hidden text-xs leading-5 text-[#66666F]">
                          {component.description}
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => onInsert(component)}
                      className="flex h-9 w-full items-center justify-center gap-2 rounded-md bg-[#191919] text-sm font-medium text-white transition hover:bg-[#2A2A2A]"
                    >
                      <Plus className="h-4 w-4" />
                      Insert
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function extractTemplateV2ComponentItems(
  payload: unknown,
): TemplateV2ComponentItem[] {
  const rawComponents = extractRawTemplateV2Components(payload);
  return rawComponents
    .map((component, index) => buildTemplateV2ComponentItem(component, index))
    .filter((item): item is TemplateV2ComponentItem => Boolean(item));
}

function extractRawTemplateV2Components(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) {
    return payload.filter(isRecord);
  }

  const record = isRecord(payload) ? payload : null;
  if (Array.isArray(record?.components)) {
    return record.components.filter(isRecord);
  }

  if (Array.isArray(record?.layouts)) {
    return record.layouts
      .filter(isRecord)
      .flatMap((layout) =>
        Array.isArray(layout.components) ? layout.components.filter(isRecord) : [],
      );
  }

  return [];
}

function buildTemplateV2ComponentItem(
  component: Record<string, unknown>,
  index: number,
): TemplateV2ComponentItem | null {
  const rawElements = Array.isArray(component.elements) ? component.elements : [];
  if (rawElements.length === 0) return null;

  const name = readString(component.id) || `component_${index + 1}`;
  const description = readString(component.description) || "";

  try {
    const previewSlide = adaptTemplateV2LayoutToSlide(
      {
        id: name,
        description,
        components: [component],
      },
      index,
    );
    return {
      key: `${name}-${index}`,
      name,
      description,
      previewSlide,
      elements: previewSlide.elements,
    };
  } catch (error) {
    console.error("Could not adapt template v2 component:", error);
    return {
      key: `${name}-${index}`,
      name,
      description,
      previewSlide: null,
      elements: [],
    };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
