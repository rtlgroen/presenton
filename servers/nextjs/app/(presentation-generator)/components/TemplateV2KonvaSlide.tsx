"use client";

import {
  useCallback,
  useEffect,
  useId,
  memo,
  useMemo,
  useRef,
  useState,
  type ChangeEvent as ReactChangeEvent,
  type CSSProperties,
} from "react";
import type Konva from "konva";
import { useDispatch } from "react-redux";
import { useHotkey } from "@tanstack/react-hotkeys";
import { Loader2 } from "lucide-react";
import {
  adaptTemplateV2LayoutToSlide,
  serializeTemplateV2LayoutFromSlide,
  type TemplateV2Layout,
} from "@/components/slide-editor/lib/template-v2-import";
import {
  SLIDE_W,
  type Deck,
  type Slide as KonvaSlideData,
  type SlideElement,
} from "@/components/slide-editor/lib/slide-schema";
import { ElementToolbar } from "@/components/slide-editor/workspace/ElementToolbar";
import {
  loadKonvaImage,
  svgToDataUri,
} from "@/components/slide-editor/slide-surface/konva/exportAssets";
import { updateSlideUi } from "@/store/slices/presentationGeneration";
import { resolveBackendAssetSource } from "@/utils/api";
import { ImagesApi } from "../services/api/images";
import {
  TEMPLATE_V2_CHART_EDITOR_EVENT,
  TEMPLATE_V2_CHART_UPDATE_EVENT,
  TEMPLATE_V2_INSERT_ELEMENTS_EVENT,
  TEMPLATE_V2_SURFACE_SELECTED_EVENT,
  type TemplateV2ChartEditorDetail,
  type TemplateV2ChartUpdateDetail,
  type TemplateV2InsertElementsDetail,
  type TemplateV2SurfaceSelectedDetail,
} from "./templateV2Events";

export {
  TEMPLATE_V2_CHART_EDITOR_EVENT,
  TEMPLATE_V2_CHART_UPDATE_EVENT,
  TEMPLATE_V2_INSERT_ELEMENTS_EVENT,
  TEMPLATE_V2_SURFACE_SELECTED_EVENT,
  type TemplateV2ChartEditorDetail,
  type TemplateV2ChartUpdateDetail,
  type TemplateV2InsertElementsDetail,
  type TemplateV2SurfaceSelectedDetail,
} from "./templateV2Events";

export type TemplateV2ChartElement = ChartElement;

export const TEMPLATE_V2_INSERT_ELEMENTS_EVENT =
  "presenton:template-v2-insert-elements";
export const TEMPLATE_V2_SURFACE_SELECTED_EVENT =
  "presenton:template-v2-surface-selected";
export const TEMPLATE_V2_CHART_EDITOR_EVENT =
  "presenton:template-v2-chart-editor";
export const TEMPLATE_V2_CHART_UPDATE_EVENT =
  "presenton:template-v2-chart-update";
const TEMPLATE_V2_EDITOR_HOTKEY_OPTIONS = {
  conflictBehavior: "allow" as const,
};
type LaidOutChild = {
  child: RawElement;
  index: number;
  box: Box | null;
  layoutManaged: boolean;
};
type TextEditStyle = {
  family: string;
  size: number;
  color: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  lineHeight: number;
  letterSpacing: number;
  wrap: string;
  horizontal: "left" | "center" | "right";
  vertical: "top" | "middle" | "bottom";
};
type RenderTextFont = Omit<TextEditStyle, "horizontal" | "vertical">;
type RenderTextRun = {
  text: string;
  font: RenderTextFont;
};

type ComponentSelection = {
  kind: "component";
  componentIndex: number;
};

type ElementSelection = {
  kind: "element";
  componentIndex: number;
  elementPath: number[];
};

type Selection = ComponentSelection | ElementSelection | null;

type InlineEdit =
  | {
    kind: "text" | "text-list" | "table" | "svg";
    selection: ElementSelection;
    draft: string;
    frame?: Box | null;
    style?: TextEditStyle;
  }
  | null;

type TemplateV2KonvaSlideProps = {
  layout: TemplateV2Layout;
  isEditMode: boolean;
  slideId?: string | number | null;
  slideIndex: number;
  renderIndex?: number;
};

function TemplateV2KonvaSlideComponent({
  layout,
  isEditMode,
  slideId = null,
  slideIndex,
  renderIndex,
}: TemplateV2KonvaSlideProps) {
  const initialSlide = useMemo(
    () =>
      buildKonvaSlide(
        layout,
        typeof renderIndex === "number" ? renderIndex : slide.index ?? 0,
      ),
    [layout, renderIndex, slide.index],
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
        layout={layout}
        presentationSlide={slide}
        isEditMode={isEditMode}
        renderIndex={renderIndex}
      />
    </Provider>
  );
}

function TemplateV2KonvaSlideBody({
  initialSlide,
  isEditMode,
  layout,
  presentationSlide,
  renderIndex,
}: {
  initialSlide: KonvaSlideData;
  isEditMode: boolean;
  layout: TemplateV2Layout;
  presentationSlide: any;
  renderIndex?: number;
}) {
  const surfaceId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const nodeRefs = useRef(new Map<string, Konva.Node>());
  const imageUploadInputRef = useRef<HTMLInputElement | null>(null);
  const pendingImageUploadRef = useRef<ElementSelection | null>(null);
  const currentUiRef = useRef<RawUi>(cloneJson(layout as RawUi));
  const undoStackRef = useRef<RawUi[]>([]);
  const redoStackRef = useRef<RawUi[]>([]);
  const [uiDraft, setUiDraft] = useState<RawUi>(() =>
    cloneJson(layout as RawUi),
  );
  const [selection, setSelection] = useState<Selection>(null);
  const [inlineEdit, setInlineEdit] = useState<InlineEdit>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [{ canUndo, canRedo }, setHistoryAvailability] = useState({
    canUndo: false,
    canRedo: false,
  });

  const components = useMemo(
    () => readArray(uiDraft.components).filter(isRecord) as RawComponent[],
    [uiDraft.components],
  );
  const setSelectionNodeRef = useCallback(
    (key: string, node: Konva.Node | null) => {
      if (node) nodeRefs.current.set(key, node);
      else nodeRefs.current.delete(key);
    },
    [],
  );
  const selectedKey = selection ? keyForSelection(selection) : null;
  const editingKey = inlineEdit ? keyForSelection(inlineEdit.selection) : null;
  const selectedElement =
    selection?.kind === "element"
      ? getElementAtSelection(uiDraft, selection)
      : null;
  const selectedComponent =
    selection?.kind === "component"
      ? asRecord(readArray(uiDraft.components)[selection.componentIndex])
      : null;
  const selectedBox = selection
    ? absoluteBoxForSelection(uiDraft, selection)
    : null;
  const toolbarElement = useMemo(
    () =>
      selectedElement && selectedBox
        ? rawElementForEditorToolbar(selectedElement, selectedBox)
        : null,
    [selectedBox, selectedElement],
  );
  const componentToolbarElement = useMemo(
    () =>
      selectedComponent
        ? rawComponentForEditorToolbar(selectedComponent)
        : null,
    [selectedComponent],
  );
  const inlineEditElement = inlineEdit
    ? getElementAtSelection(uiDraft, inlineEdit.selection)
    : null;
  const inlineEditBox = inlineEdit
    ? absoluteBoxForSelection(uiDraft, inlineEdit.selection)
    : null;
  const surfaceSlideIndex = useMemo(() => {
    const index = typeof renderIndex === "number" ? renderIndex : slideIndex;
    return Number.isFinite(index) ? index : null;
  }, [renderIndex, slideIndex]);
  useEffect(() => {
    if (layout === currentUiRef.current) return;
    const next = cloneJson(layout as RawUi);
    currentUiRef.current = next;
    setUiDraft(next);
    setSelection(null);
    setInlineEdit(null);
    undoStackRef.current = [];
    redoStackRef.current = [];
    setHistoryAvailability({ canUndo: false, canRedo: false });
  }, [layout]);

  useEffect(() => {
    if (!isEditMode) return;
    const transformer = transformerRef.current;
    if (!transformer) return;
    const node = selectedKey ? nodeRefs.current.get(selectedKey) : null;
    transformer.nodes(node ? [node] : []);
    transformer.getLayer()?.batchDraw();
  }, [isEditMode, selectedKey]);

  const isSurfaceActive = useCallback(
    () =>
      typeof document !== "undefined" &&
      document.documentElement.dataset.templateV2KonvaActiveSurface === surfaceId,
    [surfaceId],
  );

  const activateSurface = useCallback(() => {
    if (typeof document === "undefined" || typeof window === "undefined") return;
    document.documentElement.dataset.templateV2KonvaActiveSurface = surfaceId;
    if (surfaceSlideIndex != null) {
      document.documentElement.dataset.templateV2KonvaActiveSlideIndex =
        String(surfaceSlideIndex);
    }
    window.dispatchEvent(
      new CustomEvent<TemplateV2SurfaceSelectedDetail>(
        TEMPLATE_V2_SURFACE_SELECTED_EVENT,
        {
          detail: {
            slideId,
            slideIndex: surfaceSlideIndex,
          },
        },
      ),
    );
  }, [slideId, surfaceId, surfaceSlideIndex]);

  const clearSurface = useCallback(() => {
    if (typeof document === "undefined") return;
    if (
      document.documentElement.dataset.templateV2KonvaActiveSurface === surfaceId
    ) {
      delete document.documentElement.dataset.templateV2KonvaActiveSurface;
      delete document.documentElement.dataset.templateV2KonvaActiveSlideIndex;
    }
  }, [surfaceId]);

  useEffect(() => {
    if (!isEditMode) return;

    const serialized = JSON.stringify(activeSlide);
    if (serialized === lastSyncedSlideRef.current) return;
    lastSyncedSlideRef.current = serialized;
    const nextUi = serializeTemplateV2LayoutFromSlide(layout, activeSlide);

    dispatch(
      updateSlide({
        index: presentationSlide.index,
        slide: {
          ...presentationSlide,
          ui: nextUi,
        },
      }),
    );
  }, [activeSlide, dispatch, isEditMode, layout, presentationSlide]);

  useEffect(() => {
    if (!isEditMode) return;

    const handleInsertElements = (event: Event) => {
      const detail = (event as CustomEvent<TemplateV2InsertElementsDetail>)
        .detail;
      if (!detail?.elements?.length) return;

      const slideId = presentationSlide.id ? String(presentationSlide.id) : null;
      const eventSlideId =
        detail.slideId !== undefined && detail.slideId !== null
          ? String(detail.slideId)
          : null;
      const hasTarget =
        Boolean(eventSlideId) || typeof detail.slideIndex === "number";

      if (eventSlideId && slideId && eventSlideId !== slideId) return;
      if (
        !eventSlideId &&
        typeof detail.slideIndex === "number" &&
        (surfaceSlideIndex == null || detail.slideIndex !== surfaceSlideIndex)
      ) {
        return;
      }
      currentUiRef.current = nextUi;
      setUiDraft(nextUi);
      dispatch(
        updateSlideUi({
          index: slideIndex,
          ui: nextUi as Record<string, unknown>,
        }),
      );
      setHistoryAvailability({
        canUndo: undoStackRef.current.length > 0,
        canRedo: redoStackRef.current.length > 0,
      });
    },
    [dispatch, slideIndex],
  );

  const undo = useCallback(() => {
    const previous = undoStackRef.current.pop();
    if (!previous) return;
    redoStackRef.current.push(currentUiRef.current);
    commitUi(previous, false);
  }, [commitUi]);

  const redo = useCallback(() => {
    const next = redoStackRef.current.pop();
    if (!next) return;
    undoStackRef.current.push(currentUiRef.current);
    commitUi(next, false);
  }, [commitUi]);

  const select = useCallback(
    (nextSelection: Selection) => {
      activateSurface();
      setSelection(nextSelection);
    },
    [activateSurface],
  );

  const updateComponent = useCallback(
    (
      componentIndex: number,
      updater: (component: RawComponent) => RawComponent,
      pushHistory = true,
    ) => {
      commitUi(updateComponentInUi(currentUiRef.current, componentIndex, updater), pushHistory);
    },
    [commitUi],
  );

  const updateElement = useCallback(
    (
      elementSelection: ElementSelection,
      updater: (element: RawElement) => RawElement,
      pushHistory = true,
    ) => {
      commitUi(updateElementInUi(currentUiRef.current, elementSelection, updater), pushHistory);
    },
    [commitUi],
  );

  const deleteSelection = useCallback(() => {
    if (!selection) return;
    commitUi(deleteSelectionFromUi(currentUiRef.current, selection));
    setSelection(null);
    setInlineEdit(null);
  }, [commitUi, selection]);

  const openInlineEditor = useCallback(
    (elementSelection: ElementSelection) => {
      const element = getElementAtSelection(currentUiRef.current, elementSelection);
      if (!element) return;
      const type = readString(element.type);
      const frame = renderedLocalBoxForElementSelection(
        currentUiRef.current,
        elementSelection,
      );
      if (type === "text") {
        setInlineEdit({
          kind: "text",
          selection: elementSelection,
          draft: rawTextContent(element),
          frame,
          style: rawTextStyle(element),
        });
      } else if (type === "text-list") {
        setInlineEdit({
          kind: "text-list",
          selection: elementSelection,
          draft: rawTextListContent(element),
          frame,
          style: rawTextStyle(element),
        });
      } else if (type === "table") {
        setInlineEdit({
          kind: "table",
          selection: elementSelection,
          draft: rawTableContent(element),
          frame,
        });
      } else if (type === "svg") {
        setInlineEdit({
          kind: "svg",
          selection: elementSelection,
          draft: rawSvgContent(element),
          frame,
        });
      }
    },
    [],
  );

  const closeInlineEditor = useCallback(
    (commit = true) => {
      const current = inlineEdit;
      if (!current) return;
      if (commit) {
        updateElement(current.selection, (element) =>
          elementWithInlineDraft(
            element,
            current.kind,
            current.draft,
            current.style,
            current.frame,
          ),
        );
      }
      setSelection(current.selection);
      setInlineEdit(null);
    },
    [inlineEdit, updateElement],
  );

  const applyToolbarElementChange = useCallback(
    (editorElement: SlideElement) => {
      if (selection?.kind !== "element") return;
      const current = getElementAtSelection(currentUiRef.current, selection);
      const box = absoluteBoxForSelection(currentUiRef.current, selection);
      if (!current || !box) return;
      const next = mergeEditorToolbarElement(current, editorElement, box);
      updateElement(selection, () => next);
      setInlineEdit((active) =>
        active &&
          active.style &&
          keyForSelection(active.selection) === keyForSelection(selection)
          ? { ...active, style: rawTextStyle(next) }
          : active,
      );
    },
    [selection, updateElement],
  );

  const applyComponentToolbarChange = useCallback(
    (editorElement: SlideElement) => {
      if (selection?.kind !== "component") return;
      updateComponent(selection.componentIndex, (component) =>
        mergeEditorToolbarComponent(component, editorElement),
      );
    },
    [selection, updateComponent],
  );

  const openImageUpload = useCallback(
    (elementSelection: ElementSelection) => {
      const element = getElementAtSelection(currentUiRef.current, elementSelection);
      if (readString(element?.type) !== "image") return;
      activateSurface();
      pendingImageUploadRef.current = elementSelection;
      if (imageUploadInputRef.current) {
        imageUploadInputRef.current.value = "";
        imageUploadInputRef.current.click();
      }
    },
    [activateSurface],
  );

  const openChartEditor = useCallback(
    (elementSelection: ElementSelection) => {
      const element = getElementAtSelection(currentUiRef.current, elementSelection);
      if (!element || readString(element.type) !== "chart") return;
      activateSurface();
      setSelection(elementSelection);
      if (typeof window === "undefined") return;
      window.dispatchEvent(
        new CustomEvent<TemplateV2ChartEditorDetail>(
          TEMPLATE_V2_CHART_EDITOR_EVENT,
          {
            detail: {
              chart: rawChartToEditorChart(element),
              open: true,
              path: keyForSelection(elementSelection),
              rootIndex: elementSelection.componentIndex,
              slideId,
              slideIndex: surfaceSlideIndex,
            },
          },
        ),
      );
    },
    [activateSurface, slideId, surfaceSlideIndex],
  );

  const handleImageUploadChange = useCallback(
    async (event: ReactChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      const target = pendingImageUploadRef.current;
      if (!file || !target) return;

      if (!file.type.startsWith("image/")) {
        notify.warning("Invalid file", "Please upload an image file.");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        notify.warning("File too large", "Image files must be smaller than 5MB.");
        return;
      }

      try {
        setIsUploadingImage(true);
        const uploaded = await ImagesApi.uploadImage(file);
        const imageUrl = resolveBackendAssetSource(uploaded);
        if (!imageUrl) throw new Error("Upload did not return an image URL.");
        updateElement(target, (element) => ({
          ...element,
          data: imageUrl,
          name: element.name ?? file.name,
        }));
        notify.success("Image updated", "The selected image was replaced.");
      } catch (error) {
        notify.error(
          "Upload failed",
          error instanceof Error
            ? error.message
            : "Failed to upload image. Please try again.",
        );
      } finally {
        pendingImageUploadRef.current = null;
        setIsUploadingImage(false);
      }
    },
    [updateElement],
  );

  const handleElementDoubleClick = useCallback(
    (elementSelection: ElementSelection) => {
      const element = getElementAtSelection(currentUiRef.current, elementSelection);
      const type = readString(element?.type);
      if (type === "image") {
        openImageUpload(elementSelection);
        return;
      }
      if (type === "chart") {
        openChartEditor(elementSelection);
        return;
      }
      openInlineEditor(elementSelection);
    },
    [openChartEditor, openImageUpload, openInlineEditor],
  );

  useEffect(() => {
    if (!isEditMode || typeof window === "undefined") return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        (event.key !== "Delete" && event.key !== "Backspace") ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        isEditableTarget(event.target)
      ) {
        return;
      }
      if (!selection) return;
      event.preventDefault();
      deleteSelection();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [deleteSelection, isEditMode, selection]);

  useEffect(() => {
    if (!isEditMode || typeof window === "undefined") return;

    const handleInsertElements = (event: Event) => {
      const detail = (event as CustomEvent<TemplateV2InsertElementsDetail>).detail;
      if (!detail?.elements?.length) return;
      if (!eventTargetsThisSlide(detail, slideId, surfaceSlideIndex, isSurfaceActive)) {
        return;
      }

      const nextUi = appendInsertedElements(
        currentUiRef.current,
        detail.elements as unknown as UnknownRecord[],
        detail.label,
      );
      const nextIndex = readArray(nextUi.components).length - detail.elements.length;
      commitUi(nextUi);
      setSelection({
        kind: "component",
        componentIndex: Math.max(0, nextIndex),
      });
      detail.handled = true;
    };

    window.addEventListener(TEMPLATE_V2_INSERT_ELEMENTS_EVENT, handleInsertElements);
    return () =>
      window.removeEventListener(
        TEMPLATE_V2_INSERT_ELEMENTS_EVENT,
        handleInsertElements,
      );
  }, [commitUi, isEditMode, isSurfaceActive, slideId, surfaceSlideIndex]);

  useEffect(() => {
    if (!isEditMode || typeof window === "undefined") return;

    const handleChartUpdate = (event: Event) => {
      const detail = (event as CustomEvent<TemplateV2ChartUpdateDetail>).detail;
      if (!detail || !eventTargetsThisSlide(detail, slideId, surfaceSlideIndex, isSurfaceActive)) {
        return;
      }

      if (detail.action === "close") {
        detail.handled = true;
        return;
      }

      if (!detail.chart || !detail.path) return;
      const parsedSelection = selectionFromKey(detail.path);
      if (!parsedSelection || parsedSelection.kind !== "element") return;
      const currentChart = getElementAtSelection(currentUiRef.current, parsedSelection);
      if (readString(currentChart?.type) !== "chart") return;
      updateElement(parsedSelection, (element) =>
        editorChartToRawChart(element, (detail.chart ?? {}) as UnknownRecord),
      );
      detail.handled = true;
    };

    window.addEventListener(TEMPLATE_V2_CHART_UPDATE_EVENT, handleChartUpdate);
    return () =>
      window.removeEventListener(TEMPLATE_V2_CHART_UPDATE_EVENT, handleChartUpdate);
  }, [isEditMode, isSurfaceActive, slideId, surfaceSlideIndex, updateElement]);

  useEffect(() => {
    if (!isEditMode || typeof document === "undefined") return;
    const handlePointerDown = (event: PointerEvent) => {
      const root = rootRef.current;
      if (root?.contains(event.target as Node)) activateSurface();
      else clearSurface();
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      clearSurface();
    };
  }, [activateSurface, clearSurface, isEditMode]);

  useHotkey(
    "Mod+Z",
    (event) => {
      if (!isSurfaceActive() || !canUndo) return;
      event.preventDefault();
      event.stopPropagation();
      undo();
    },
    { conflictBehavior: "allow" },
  );
  useHotkey(
    "Mod+Shift+Z",
    (event) => {
      if (!isSurfaceActive() || !canRedo) return;
      event.preventDefault();
      event.stopPropagation();
      redo();
    },
    { conflictBehavior: "allow" },
  );
  useHotkey(
    "Mod+Y",
    (event) => {
      if (!isSurfaceActive() || !canRedo) return;
      event.preventDefault();
      event.stopPropagation();
      redo();
    },
    { conflictBehavior: "allow" },
  );

  if (!uiDraft) {
    return (
      <div className="flex h-full aspect-video flex-col items-center justify-center rounded-lg bg-gray-100">
        <Loader2 className="mb-2 h-4 w-4 animate-spin" />
        <p className="text-center text-sm text-gray-600">Loading slide layout...</p>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className="relative h-full w-full overflow-hidden bg-white"
      style={{ width: STAGE_WIDTH, height: STAGE_HEIGHT }}
      onPointerDown={activateSurface}
    >
      {/* {isEditMode ? (
        <input
          ref={imageUploadInputRef}
          accept="image/*"
          className="hidden"
          type="file"
          onChange={handleImageUploadChange}
        />
      ) : null} */}
      <Stage
        width={STAGE_WIDTH}
        height={STAGE_HEIGHT}
        onMouseDown={(event) => {
          activateSurface();
          if (event.target === event.target.getStage()) {
            setSelection(null);
            setInlineEdit(null);
          }
        }}
        onTouchStart={(event) => {
          activateSurface();
          if (event.target === event.target.getStage()) {
            setSelection(null);
            setInlineEdit(null);
          }
        }}
      >
        <Layer>
          <Rect width={STAGE_WIDTH} height={STAGE_HEIGHT} fill={backgroundColor(uiDraft)} />
          {components.map((component, componentIndex) => (
            <MemoizedRawComponentNode
              key={componentKey(component, componentIndex)}
              component={component}
              componentIndex={componentIndex}
              isEditMode={isEditMode}
              selectedKey={selectedKey}
              editingKey={editingKey}
              setNodeRef={setSelectionNodeRef}
              onSelect={select}
              onOpenElementEditor={handleElementDoubleClick}
              onComponentChange={updateComponent}
              onElementChange={updateElement}
            />
          ))}
          {isEditMode ? <Transformer ref={transformerRef} rotateEnabled /> : null}
        </Layer>
      </Stage>
      {isEditMode &&
        selection?.kind === "component" &&
        componentToolbarElement ? (
        <ElementToolbar
          element={componentToolbarElement}
          index={selection.componentIndex}
          path={keyForSelection(selection)}
          scale={EDITOR_SCALE}
          selectedTableCell={null}
          onChange={(_index, element) =>
            applyComponentToolbarChange(element)
          }
          onEditImage={() => undefined}
        />
      ) : null}
      {isEditMode &&
        selection?.kind === "element" &&
        selectedElement &&
        selectedBox &&
        toolbarElement ? (
        <ElementToolbar
          element={toolbarElement}
          index={selection.componentIndex}
          path={keyForSelection(selection)}
          scale={EDITOR_SCALE}
          selectedTableCell={null}
          onChange={(_index, element) => applyToolbarElementChange(element)}
          onEditChart={() => openChartEditor(selection)}
          onEditImage={() => openImageUpload(selection)}
          onEditText={() => openInlineEditor(selection)}
        />
      ) : null}
      {inlineEdit && inlineEditElement && inlineEditBox ? (
        <RawInlineEditor
          key={keyForSelection(inlineEdit.selection)}
          draft={inlineEdit.draft}
          element={inlineEditElement}
          kind={inlineEdit.kind}
          box={inlineEditBox}
          style={inlineEdit.style}
          onChange={(draft) =>
            setInlineEdit((current) => (current ? { ...current, draft } : current))
          }
          onClose={(commit) => closeInlineEditor(commit)}
        />
      ) : null}
      {isUploadingImage ? (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-white/35">
          <div className="flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-medium text-[#191919] shadow-md">
            <Loader2 className="h-4 w-4 animate-spin" />
            Uploading image...
          </div>
        </div>
      ) : null}
    </div>
  );
}

export const TemplateV2KonvaSlide = memo(TemplateV2KonvaSlideComponent);
TemplateV2KonvaSlide.displayName = "TemplateV2KonvaSlide";

function RawComponentNode({
  component,
  componentIndex,
  isEditMode,
  selectedKey,
  editingKey,
  setNodeRef,
  onSelect,
  onOpenElementEditor,
  onComponentChange,
  onElementChange,
}: {
  component: RawComponent;
  componentIndex: number;
  isEditMode: boolean;
  selectedKey: string | null;
  editingKey: string | null;
  setNodeRef: (key: string, node: Konva.Node | null) => void;
  onSelect: (selection: Selection) => void;
  onOpenElementEditor: (selection: ElementSelection) => void;
  onComponentChange: (
    componentIndex: number,
    updater: (component: RawComponent) => RawComponent,
  ) => void;
  onElementChange: (
    selection: ElementSelection,
    updater: (element: RawElement) => RawElement,
  ) => void;
}) {
  const groupRef = useRef<Konva.Group | null>(null);
  const box = componentBox(component);
  const stageBox = { x: 0, y: 0, width: STAGE_WIDTH, height: STAGE_HEIGHT };
  const selection: ComponentSelection = { kind: "component", componentIndex };
  const key = keyForSelection(selection);
  const selected = selectedKey === key;
  const elements = readArray(component.elements).filter(isRecord) as RawElement[];

  return (
    <Group
      ref={(node) => {
        groupRef.current = node;
        setNodeRef(key, node);
      }}
      x={box.x}
      y={box.y}
      width={box.width}
      height={box.height}
      rotation={readNumber(component.rotation) ?? 0}
      clipX={0}
      clipY={0}
      clipWidth={box.width}
      clipHeight={box.height}
      draggable={isEditMode}
      dragBoundFunc={(pos) => clampAbsoluteBox(pos, box, stageBox)}
      onMouseDown={(event) => {
        if (!isEditMode) return;
        event.cancelBubble = true;
        onSelect(selection);
      }}
      onTouchStart={(event) => {
        if (!isEditMode) return;
        event.cancelBubble = true;
        onSelect(selection);
      }}
      onDragStart={(event) => {
        if (!isEditMode) return;
        event.cancelBubble = true;
        onSelect(selection);
      }}
      onDragMove={(event) => {
        event.cancelBubble = true;
      }}
      onDragEnd={(event) => {
        if (!isEditMode) return;
        event.cancelBubble = true;
        const node = groupRef.current;
        if (!node) return;
        onComponentChange(componentIndex, (current) => ({
          ...current,
          position: positionFromNodeInParent(node, stageBox, box),
        }));
      }}
      onTransformEnd={(event) => {
        if (!isEditMode) return;
        event.cancelBubble = true;
        const node = groupRef.current;
        if (!node) return;
        const scaleX = node.scaleX();
        const scaleY = node.scaleY();
        node.scaleX(1);
        node.scaleY(1);
        const nextBox = {
          ...box,
          width: Math.max(1, box.width * scaleX),
          height: Math.max(1, box.height * scaleY),
        };
        onComponentChange(componentIndex, (current) =>
          resizeComponent(current, {
            ...positionFromNodeInParent(node, stageBox, nextBox),
            width: nextBox.width,
            height: nextBox.height,
            scaleX,
            scaleY,
            rotation: node.rotation(),
          }),
        );
      }}
    >
      <Rect
        width={box.width}
        height={box.height}
        fill="rgba(255,255,255,0.01)"
      />
      {elements.map((element, elementIndex) => (
        <MemoizedRawElementNode
          key={rawElementKey(element, elementIndex)}
          element={element}
          componentIndex={componentIndex}
          elementPath={[elementIndex]}
          isEditMode={isEditMode}
          selectedKey={selectedKey}
          editingKey={editingKey}
          setNodeRef={setNodeRef}
          onSelect={onSelect}
          onOpenEditor={onOpenElementEditor}
          onElementChange={onElementChange}
          parentBox={box}
          layoutManaged={false}
        />
      ))}
      {selected ? (
        <Rect
          width={box.width}
          height={box.height}
          stroke="#7C51F8"
          strokeWidth={1.5}
          dash={[6, 4]}
          listening={false}
        />
      ) : null}
    </Group>
  );
}

const MemoizedRawComponentNode = memo(
  RawComponentNode,
  (previous, next) => {
    if (
      previous.component !== next.component ||
      previous.componentIndex !== next.componentIndex ||
      previous.isEditMode !== next.isEditMode ||
      previous.setNodeRef !== next.setNodeRef ||
      previous.onSelect !== next.onSelect ||
      previous.onOpenElementEditor !== next.onOpenElementEditor ||
      previous.onComponentChange !== next.onComponentChange ||
      previous.onElementChange !== next.onElementChange
    ) {
      return false;
    }
    if (
      previous.selectedKey !== next.selectedKey &&
      (selectionTouchesComponent(
        previous.selectedKey,
        previous.componentIndex,
      ) ||
        selectionTouchesComponent(next.selectedKey, next.componentIndex))
    ) {
      return false;
    }
    return !(
      previous.editingKey !== next.editingKey &&
      (selectionTouchesComponent(
        previous.editingKey,
        previous.componentIndex,
      ) ||
        selectionTouchesComponent(next.editingKey, next.componentIndex))
    );
  },
);

function RawElementNode({
  element,
  componentIndex,
  elementPath,
  isEditMode,
  selectedKey,
  editingKey,
  setNodeRef,
  onSelect,
  onOpenEditor,
  onElementChange,
  parentBox,
  renderBox,
  layoutManaged = false,
}: {
  element: RawElement;
  componentIndex: number;
  elementPath: number[];
  isEditMode: boolean;
  selectedKey: string | null;
  editingKey: string | null;
  setNodeRef: (key: string, node: Konva.Node | null) => void;
  onSelect: (selection: Selection) => void;
  onOpenEditor: (selection: ElementSelection) => void;
  onElementChange: (
    selection: ElementSelection,
    updater: (element: RawElement) => RawElement,
  ) => void;
  parentBox: Box;
  renderBox?: Box | null;
  layoutManaged?: boolean;
}) {
  const groupRef = useRef<Konva.Group | null>(null);
  const box = renderBox ?? elementBox(element);
  const selection: ElementSelection = {
    kind: "element",
    componentIndex,
    elementPath,
  };
  const key = keyForSelection(selection);
  const selected = selectedKey === key;
  const editing = editingKey === key;
  const childInfo = childArrayInfo(element);
  const children = childInfo?.items ?? [];
  const laidOutChildren = layoutChildren(element, children, box);
  const clipChildren = shouldClipElementChildren(element, childInfo);

  return (
    <Group
      ref={(node) => {
        groupRef.current = node;
        setNodeRef(key, node);
      }}
      x={box.x}
      y={box.y}
      width={box.width}
      height={box.height}
      clipX={clipChildren ? 0 : undefined}
      clipY={clipChildren ? 0 : undefined}
      clipWidth={clipChildren ? box.width : undefined}
      clipHeight={clipChildren ? box.height : undefined}
      rotation={readNumber(element.rotation) ?? 0}
      opacity={readNumber(element.opacity) ?? 1}
      draggable={isEditMode && selected}
      dragBoundFunc={(pos) => clampAbsoluteBox(pos, box, parentBox)}
      onMouseDown={(event) => {
        if (!isEditMode) return;
        event.cancelBubble = selected;
      }}
      onTouchStart={(event) => {
        if (!isEditMode) return;
        event.cancelBubble = selected;
      }}
      onClick={(event) => {
        if (!isEditMode) return;
        event.cancelBubble = true;
        onSelect(selection);
      }}
      onTap={(event) => {
        if (!isEditMode) return;
        event.cancelBubble = true;
        onSelect(selection);
      }}
      onDblClick={(event) => {
        if (!isEditMode) return;
        event.cancelBubble = true;
        onSelect(selection);
        onOpenEditor(selection);
      }}
      onDblTap={(event) => {
        if (!isEditMode) return;
        event.cancelBubble = true;
        onSelect(selection);
        onOpenEditor(selection);
      }}
      onDragStart={(event) => {
        if (!isEditMode) return;
        event.cancelBubble = true;
        onSelect(selection);
      }}
      onDragMove={(event) => {
        event.cancelBubble = true;
      }}
      onDragEnd={(event) => {
        if (!isEditMode) return;
        event.cancelBubble = true;
        const node = groupRef.current;
        if (!node) return;
        onElementChange(selection, (current) => ({
          ...current,
          position: positionFromNodeInParent(node, parentBox, box),
          ...(layoutManaged || isManualPositioned(current)
            ? { __presenton_manual_position: true }
            : {}),
        }));
      }}
      onTransformEnd={(event) => {
        if (!isEditMode) return;
        event.cancelBubble = true;
        const node = groupRef.current;
        if (!node) return;
        const scaleX = node.scaleX();
        const scaleY = node.scaleY();
        const nextSize = {
          width: Math.max(1, box.width * scaleX),
          height: Math.max(1, box.height * scaleY),
        };
        node.scaleX(1);
        node.scaleY(1);
        onElementChange(selection, (current) => ({
          ...current,
          position: positionFromNodeInParent(
            node,
            parentBox,
            { ...box, ...nextSize },
          ),
          size: nextSize,
          rotation: node.rotation(),
          ...(layoutManaged || isManualPositioned(current)
            ? { __presenton_manual_position: true }
            : {}),
        }));
      }}
    >
      <Rect width={box.width} height={box.height} fill="rgba(255,255,255,0.01)" />
      {editing ? null : (
        <MemoizedRawElementVisual
          element={element}
          width={box.width}
          height={box.height}
        />
      )}
      {laidOutChildren.map(({ child, index, box: childBox, layoutManaged }) => (
        <MemoizedRawElementNode
          key={rawElementKey(child, index)}
          element={child}
          componentIndex={componentIndex}
          elementPath={[...elementPath, index]}
          isEditMode={isEditMode}
          selectedKey={selectedKey}
          editingKey={editingKey}
          setNodeRef={setNodeRef}
          onSelect={onSelect}
          onOpenEditor={onOpenEditor}
          onElementChange={onElementChange}
          parentBox={{
            x: parentBox.x + box.x,
            y: parentBox.y + box.y,
            width: box.width,
            height: box.height,
          }}
          renderBox={childBox}
          layoutManaged={layoutManaged}
        />
      ))}
      {selected ? (
        <Rect
          width={box.width}
          height={box.height}
          stroke="#7C51F8"
          strokeWidth={1.5}
          listening={false}
        />
      ) : null}
    </Group>
  );
}

function buildKonvaSlide(
  layout: TemplateV2Layout,
  slideIndex = 0,
): KonvaSlideData | null {
  try {
    return adaptTemplateV2LayoutToSlide(layout, slideIndex);
  } catch (error) {
    console.error("Could not adapt template v2 slide for Konva:", error);
    return null;
  }

  const fit = readString(element.fit) ?? "contain";
  const naturalRatio = loaded.width / loaded.height || 1;
  const boxRatio = width / height || 1;
  let drawW = width;
  let drawH = height;
  let offsetX = 0;
  let offsetY = 0;

  if (fit === "cover") {
    if (naturalRatio > boxRatio) {
      drawW = height * naturalRatio;
      offsetX = (width - drawW) / 2;
    } else {
      drawH = width / naturalRatio;
      offsetY = (height - drawH) / 2;
    }
  } else if (fit === "contain") {
    if (naturalRatio > boxRatio) {
      drawH = width / naturalRatio;
      offsetY = (height - drawH) / 2;
    } else {
      drawW = height * naturalRatio;
      offsetX = (width - drawW) / 2;
    }
  }

  return (
    <Group clipX={0} clipY={0} clipWidth={width} clipHeight={height} listening={false}>
      <KonvaImage
        image={loaded}
        x={offsetX}
        y={offsetY}
        width={drawW}
        height={drawH}
        listening={false}
      />
    </Group>
  );
}
