"use client";

import type Konva from "konva";
import type { TemplateV2Layout } from "@/components/slide-editor/schema/template-v2-import";
import {
  SLIDE_H,
  SLIDE_W,
  type ChartElement,
  type ChartSeries,
  type SlideElement,
  type TextRun,
} from "@/components/slide-editor/schema/slide-schema";
import type {
  TemplateV2InlineEditKind,
  TemplateV2TextEditStyle,
} from "@/components/slide-editor/text/template-v2-text-editing";
import { textRunsContent } from "@/components/slide-editor/text/text-runs";
import {
  applyTextStyle,
  displayText,
  editorFontRecordToRaw,
  fontScaleFromResize,
  rawFont,
  rawFontRecordForEditor,
  rawFontToSource,
  rawTableCellText,
  rawTextContent,
  rawTextListItemText,
  rawTextListRunsForEditor,
  rawTextRunsForEditor,
  scaleRawTextMetrics,
  setRawTextContent,
  setRawTextListContent,
  setRawTextListRunsContent,
  setRawTextRunsContent,
  normalizeRawTextMarkdownElement,
  textVisualLocalBox,
} from "@/components/slide-editor/text/template-v2-text";
import { rawChartType } from "@/components/slide-editor/charts/chart-data";
import {
  isFlowLayoutElement,
  layoutFlowChildren,
} from "@/components/slide-editor/layout/flowLayout";
import { deleteLayoutChildFromArray } from "@/components/slide-editor/layout/layoutResize";
import type { TemplateV2SurfaceSelectedDetail } from "@/components/slide-editor/events/events";

export const STAGE_WIDTH = 1280;
export const STAGE_HEIGHT = 720;
export const ROOT_ELEMENTS_COMPONENT_INDEX = -1;
export const STAGE_BOX: Box = {
  x: 0,
  y: 0,
  width: STAGE_WIDTH,
  height: STAGE_HEIGHT,
};
export const EDITOR_SCALE = STAGE_WIDTH / SLIDE_W;
export const EDITOR_SCALE_Y = STAGE_HEIGHT / SLIDE_H;
export const TEXT_AVERAGE_CHAR_EM = 0.5;
export const DECORATIVE_LINE_LENGTH = 80;
export const DECORATIVE_LINE_THICKNESS = 4;
export const MAX_HISTORY_ENTRIES = 50;
export const SCROLL_DISMISS_THRESHOLD_PX = 300;

export type UnknownRecord = Record<string, any>;
export type RawUi = TemplateV2Layout & UnknownRecord;
export type RawComponent = UnknownRecord;
export type RawElement = UnknownRecord;
export type Size = { width: number; height: number };
export type Point = { x: number; y: number };
export type Box = Point & Size;
export type InsertedElementConversion = {
  scaleX: number;
  scaleY: number;
  usesEditorUnits: boolean;
  scaleTemplateText: boolean;
};
export type ChildArrayInfo = {
  key: "children" | "elements" | "child";
  items: unknown[];
};
export type LaidOutChild = {
  child: RawElement;
  index: number;
  box: Box | null;
  layoutManaged: boolean;
};

export type ComponentSelection = {
  kind: "component";
  componentIndex: number;
};

export type MultiComponentSelection = {
  kind: "multi-component";
  componentIndexes: number[];
};

export type ElementSelection = {
  kind: "element";
  componentIndex: number;
  elementPath: number[];
};

export type Selection = ComponentSelection | MultiComponentSelection | ElementSelection | null;
export type SelectOptions = {
  additive?: boolean;
};
export type MultiComponentDragState = {
  draggedComponentIndex: number;
  draggedNodeStart: Point;
  nodes: Array<{
    componentIndex: number;
    node: Konva.Node;
    nodeStart: Point;
    modelStart: Point;
  }>;
};

export function updateComponentInUi(
  sourceUi: RawUi,
  componentIndex: number,
  updater: (component: RawComponent) => RawComponent,
) {
  const components = [...readArray(sourceUi.components)];
  const current = asRecord(components[componentIndex]);
  if (!current) return sourceUi;
  const updated = updater(current);
  if (updated === current) return sourceUi;
  components[componentIndex] = updated;
  return { ...sourceUi, components };
}

export function setComponentPositionsInUi(
  sourceUi: RawUi,
  positions: Array<{ componentIndex: number; position: Point }>,
) {
  const positionByIndex = new Map<number, Point>();
  positions.forEach(({ componentIndex, position }) => {
    if (!Number.isInteger(componentIndex) || componentIndex < 0) return;
    positionByIndex.set(componentIndex, {
      x: position.x,
      y: position.y,
    });
  });
  if (positionByIndex.size === 0) return sourceUi;

  let changed = false;
  const components = readArray(sourceUi.components).map((component, index) => {
    const record = asRecord(component);
    const nextPosition = positionByIndex.get(index);
    if (!record || !nextPosition) return component;
    const currentPosition = readPoint(record.position);
    if (
      Math.abs(currentPosition.x - nextPosition.x) < 0.01 &&
      Math.abs(currentPosition.y - nextPosition.y) < 0.01
    ) {
      return component;
    }
    changed = true;
    return {
      ...record,
      position: {
        x: nextPosition.x,
        y: nextPosition.y,
      },
    };
  });

  return changed ? { ...sourceUi, components } : sourceUi;
}

export function updateElementInUi(
  sourceUi: RawUi,
  selection: ElementSelection,
  updater: (element: RawElement) => RawElement,
) {
  if (selection.componentIndex === ROOT_ELEMENTS_COMPONENT_INDEX) {
    const currentElements = readArray(sourceUi.elements);
    const elements = updateElementArray(
      currentElements,
      selection.elementPath,
      updater,
    );
    return elements === currentElements ? sourceUi : { ...sourceUi, elements };
  }

  const components = [...readArray(sourceUi.components)];
  const component = asRecord(components[selection.componentIndex]);
  if (!component) return sourceUi;
  const currentElements = readArray(component.elements);
  const elements = updateElementArray(
    currentElements,
    selection.elementPath,
    updater,
  );
  if (elements === currentElements) return sourceUi;
  components[selection.componentIndex] = normalizeSingleChartWrapperComponent(
    { ...component, elements },
    selection,
  );
  return { ...sourceUi, components };
}

export function normalizeSingleChartWrapperComponent(
  component: RawComponent,
  selection: ElementSelection,
): RawComponent {
  if (selection.elementPath.length !== 1) return component;
  const elements = readArray(component.elements);
  if (elements.length !== 1) return component;
  const child = asRecord(elements[0]);
  if (!child || readString(child.type) !== "chart") return component;
  if ((readNumber(component.rotation) ?? 0) !== 0) return component;

  const childBox = elementBox(child);
  const componentPosition = readPoint(component.position);
  return {
    ...component,
    position: {
      x: componentPosition.x + childBox.x,
      y: componentPosition.y + childBox.y,
    },
    size: {
      width: childBox.width,
      height: childBox.height,
    },
    elements: [
      {
        ...child,
        position: { x: 0, y: 0 },
        size: {
          width: childBox.width,
          height: childBox.height,
        },
      },
    ],
  };
}

export function updateElementArray(
  elements: unknown[],
  path: number[],
  updater: (element: RawElement) => RawElement,
): unknown[] {
  if (path.length === 0) return elements;
  const [index, ...rest] = path;
  const current = asRecord(elements[index]);
  if (!current) return elements;
  if (rest.length === 0) {
    const updated = updater(current);
    if (updated === current) return elements;
    const next = [...elements];
    next[index] = updated;
    return next;
  }
  const childInfo = childArrayInfo(current);
  if (!childInfo) return elements;
  const updatedChildren = updateElementArray(childInfo.items, rest, updater);
  if (updatedChildren === childInfo.items) return elements;
  const next = [...elements];
  next[index] = withUpdatedChildItems(current, childInfo, updatedChildren);
  return next;
}

export function deleteSelectionFromUi(sourceUi: RawUi, selection: Selection) {
  if (!selection) return sourceUi;

  const components = [...readArray(sourceUi.components)];
  if (selection.kind === "multi-component") {
    const indexes = Array.from(new Set(selection.componentIndexes))
      .filter((index) => Number.isInteger(index) && index >= 0)
      .sort((a, b) => b - a);
    indexes.forEach((componentIndex) => {
      if (componentIndex < components.length) {
        components.splice(componentIndex, 1);
      }
    });
    return { ...sourceUi, components };
  }
  if (selection?.kind === "component") {
    components.splice(selection.componentIndex, 1);
    return { ...sourceUi, components };
  }
  if (selection?.kind === "element") {
    if (selection.componentIndex === ROOT_ELEMENTS_COMPONENT_INDEX) {
      const currentElements = readArray(sourceUi.elements);
      const elements = deleteLayoutChildFromArray(
        currentElements,
        selection.elementPath,
      );
      return elements === currentElements ? sourceUi : { ...sourceUi, elements };
    }

    const component = asRecord(components[selection.componentIndex]);
    if (!component) return sourceUi;
    const currentElements = readArray(component.elements);
    const elements = deleteLayoutChildFromArray(
      currentElements,
      selection.elementPath,
    );
    if (elements !== currentElements) {
      components[selection.componentIndex] = { ...component, elements };
      return { ...sourceUi, components };
    }

    components.splice(selection.componentIndex, 1);
    return { ...sourceUi, components };
  }
  return sourceUi;
}

export function resizeComponent(
  component: RawComponent,
  next: Box & { scaleX: number; scaleY: number; rotation?: number },
) {
  const fontScale = fontScaleFromResize(next.scaleX, next.scaleY);
  return {
    ...component,
    position: { x: next.x, y: next.y },
    size: { width: next.width, height: next.height },
    rotation: next.rotation ?? readNumber(component.rotation) ?? 0,
    elements: scaleRawElements(
      readArray(component.elements),
      next.scaleX,
      next.scaleY,
      fontScale,
    ),
  };
}

export function scaleRawElements(
  elements: unknown[],
  scaleX: number,
  scaleY: number,
  fontScale: number,
): unknown[] {
  return elements.map((value) => {
    const element = asRecord(value);
    if (!element) return value;
    const box = elementBox(element);
    const childInfo = childArrayInfo(element);
    const scaledChildren = childInfo
      ? scaleRawElements(childInfo.items, scaleX, scaleY, fontScale)
      : null;
    const scaledElement = scaleRawElementTextMetrics(element, fontScale);
    return {
      ...scaledElement,
      position: { x: box.x * scaleX, y: box.y * scaleY },
      size: { width: box.width * scaleX, height: box.height * scaleY },
      ...(childInfo && scaledChildren
        ? withUpdatedChildItems({}, childInfo, scaledChildren)
        : {}),
    };
  });
}

export function scaleRawElementTextMetrics(element: RawElement, fontScale: number) {
  if (!Number.isFinite(fontScale) || Math.abs(fontScale - 1) < 0.001) {
    return element;
  }
  const type = readString(element.type);
  if (type !== "text" && type !== "text-list" && type !== "table") {
    return element;
  }
  return scaleRawTextMetrics(element, fontScale);
}

export function positionFromNodeInParent(
  node: Konva.Node,
  parentBox: Box,
  renderedBox: Box,
): Point {
  const absolute = node.absolutePosition();
  const offsetX = node.offsetX() ? renderedBox.width / 2 : 0;
  const offsetY = node.offsetY() ? renderedBox.height / 2 : 0;
  return clampRelativePosition(
    {
      x: absolute.x - parentBox.x - offsetX,
      y: absolute.y - parentBox.y - offsetY,
    },
    renderedBox,
    parentBox,
  );
}

export function clampRelativePosition(pos: Point, box: Box, parentSize: Size): Point {
  return {
    x: clamp(pos.x, 0, Math.max(0, parentSize.width - box.width)),
    y: clamp(pos.y, 0, Math.max(0, parentSize.height - box.height)),
  };
}

export function layoutChildren(
  parent: RawElement,
  children: unknown[],
  parentBox: Box,
): LaidOutChild[] {
  const rawChildren = children.filter(isRecord) as RawElement[];
  const type = readString(parent.type);
  if (type === "container") {
    return layoutContainerChildren(parent, rawChildren, parentBox);
  }
  if (isFlowLayoutElement(parent)) {
    return layoutFlowChildren(parent, rawChildren, parentBox, {
      elementBox,
      elementSize,
      isManualPositioned,
    }) as LaidOutChild[];
  }
  return rawChildren.map((child, index) => ({
    child,
    index,
    box: null as Box | null,
    layoutManaged: false,
  }));
}

export function elementWithNormalizedLayoutChildren(
  element: RawElement,
  parentBox: Box,
): RawElement {
  const childInfo = childArrayInfo(element);
  if (!childInfo || childInfo.items.length === 0) {
    return element;
  }

  const laidOutChildren = layoutChildren(element, childInfo.items, parentBox);
  const nextChildren = childInfo.items.map((child, index) => {
    const record = asRecord(child);
    const laidOut = laidOutChildren.find((item) => item.index === index);
    if (!record || !laidOut?.box || !laidOut.layoutManaged) {
      return child;
    }
    return {
      ...record,
      position: {
        x: laidOut.box.x,
        y: laidOut.box.y,
      },
      size: {
        width: laidOut.box.width,
        height: laidOut.box.height,
      },
    };
  });

  return withUpdatedChildItems(element, childInfo, nextChildren);
}

export function shouldUseCenterOrigin(element: RawElement) {
  const type = readString(element.type);
  return type === "image";
}

export function layoutContainerChildren(
  parent: RawElement,
  children: RawElement[],
  parentBox: Box,
): LaidOutChild[] {
  if (children.length === 0) return [];
  const padding = readPadding(parent.padding);
  const content = {
    x: padding.left,
    y: padding.top,
    width: Math.max(1, parentBox.width - padding.left - padding.right),
    height: Math.max(1, parentBox.height - padding.top - padding.bottom),
  };
  const alignment = asRecord(parent.alignment) ?? {};

  return children.map((child, index) => {
    if (isManualPositioned(child)) {
      return { child, index, box: elementBox(child), layoutManaged: false };
    }

    const point = readPoint(child.position);
    const childType = readString(child.type);
    const explicitSize = readOptionalSize(child.size);
    const inferredSize =
      childType === "group" && explicitSize == null
        ? { width: content.width, height: content.height }
        : elementSize(child, content);
    const width = explicitSize?.width ?? inferredSize.width;
    const height = explicitSize?.height ?? inferredSize.height;

    if (childType === "group") {
      return {
        child,
        index,
        box: {
          x: content.x + point.x,
          y: content.y + point.y,
          width,
          height,
        },
        layoutManaged: true,
      };
    }

    const horizontal = readString(alignment.horizontal) ?? "left";
    const vertical = readString(alignment.vertical) ?? "top";
    return {
      child,
      index,
      box: {
        x:
          horizontal === "center"
            ? content.x + alignmentOffset("center", content.width, width)
            : horizontal === "right"
              ? content.x + alignmentOffset("right", content.width, width)
              : content.x + point.x,
        y:
          vertical === "middle"
            ? content.y + alignmentOffset("center", content.height, height)
            : vertical === "bottom"
              ? content.y + alignmentOffset("bottom", content.height, height)
              : content.y + point.y,
        width,
        height,
      },
      layoutManaged: true,
    };
  });
}

export function estimateTextWidth(text: string, font: ReturnType<typeof rawFont>) {
  const longestLine = text
    .split(/\r?\n/)
    .reduce((longest, line) => Math.max(longest, line.length), 0);
  const weight = font.bold ? 0.56 : TEXT_AVERAGE_CHAR_EM;
  return Math.max(font.size, longestLine * font.size * weight);
}

export function estimateTextHeight(
  text: string,
  font: ReturnType<typeof rawFont>,
  width: number,
) {
  const lineHeight = font.size * font.lineHeight;
  if (font.wrap === "none") {
    return Math.max(lineHeight, text.split(/\r?\n/).length * lineHeight);
  }
  const averageCharWidth = Math.max(1, font.size * TEXT_AVERAGE_CHAR_EM);
  const charsPerLine = Math.max(1, Math.floor(width / averageCharWidth));
  const lines = text.split(/\r?\n/).reduce((count, line) => {
    return count + Math.max(1, Math.ceil(line.length / charsPerLine));
  }, 0);
  return Math.max(lineHeight, lines * lineHeight);
}

export function getElementAtSelection(ui: RawUi, selection: ElementSelection) {
  if (selection.componentIndex === ROOT_ELEMENTS_COMPONENT_INDEX) {
    return getElementFromArray(readArray(ui.elements), selection.elementPath);
  }

  const component = asRecord(readArray(ui.components)[selection.componentIndex]);
  if (!component) return null;
  return getElementFromArray(readArray(component.elements), selection.elementPath);
}

export function getElementFromArray(elements: unknown[], path: number[]): RawElement | null {
  const [index, ...rest] = path;
  const current = asRecord(elements[index]);
  if (!current) return null;
  if (rest.length === 0) return current;
  const childInfo = childArrayInfo(current);
  return childInfo ? getElementFromArray(childInfo.items, rest) : null;
}

export function absoluteBoxForSelection(ui: RawUi, selection: Selection): Box | null {
  if (!selection) return null;
  if (selection.kind === "multi-component") {
    const components = readArray(ui.components);
    const boxes = selection.componentIndexes.flatMap((componentIndex) => {
      const component = asRecord(components[componentIndex]);
      return component ? [componentBox(component)] : [];
    });
    return boxes.length > 0 ? boxContainingBoxes(boxes) : null;
  }
  if (
    selection.kind === "element" &&
    selection.componentIndex === ROOT_ELEMENTS_COMPONENT_INDEX
  ) {
    return absoluteElementBox(rootElementsComponent(ui), selection.elementPath);
  }

  const component = asRecord(readArray(ui.components)[selection.componentIndex]);
  if (!component) return null;
  const componentOrigin = readPoint(component.position);
  if (selection.kind === "component") return componentBox(component);
  const elementBoxValue = absoluteElementBox(component, selection.elementPath);
  if (!elementBoxValue) return null;
  return {
    x: componentOrigin.x + elementBoxValue.x,
    y: componentOrigin.y + elementBoxValue.y,
    width: elementBoxValue.width,
    height: elementBoxValue.height,
  };
}

export function boxContainingBoxes(boxes: Box[]): Box {
  const minX = Math.min(...boxes.map((box) => box.x));
  const minY = Math.min(...boxes.map((box) => box.y));
  const maxX = Math.max(...boxes.map((box) => box.x + box.width));
  const maxY = Math.max(...boxes.map((box) => box.y + box.height));
  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
}

export function absoluteInlineEditBox(
  ui: RawUi,
  selection: ElementSelection,
  frame?: Box | null,
): Box | null {
  const element = getElementAtSelection(ui, selection);
  const localFrame =
    frame ?? renderedLocalBoxForElementSelection(ui, selection);
  if (!element || !localFrame) return absoluteBoxForSelection(ui, selection);

  const visualFrame =
    readString(element.type) === "text"
      ? textVisualLocalBox(element, localFrame)
      : localFrame;
  return (
    absoluteBoxForElementLocalFrame(ui, selection, visualFrame) ??
    absoluteBoxForSelection(ui, selection)
  );
}

export function absoluteBoxForElementLocalFrame(
  ui: RawUi,
  selection: ElementSelection,
  frame: Box,
): Box | null {
  if (selection.componentIndex === ROOT_ELEMENTS_COMPONENT_INDEX) {
    return absoluteElementLocalFrame(
      rootElementsComponent(ui),
      selection.elementPath,
      frame,
    );
  }

  const component = asRecord(readArray(ui.components)[selection.componentIndex]);
  if (!component) return null;
  const componentOrigin = readPoint(component.position);
  const elementFrame = absoluteElementLocalFrame(
    component,
    selection.elementPath,
    frame,
  );
  if (!elementFrame) return null;
  return {
    x: componentOrigin.x + elementFrame.x,
    y: componentOrigin.y + elementFrame.y,
    width: elementFrame.width,
    height: elementFrame.height,
  };
}

export function absoluteElementLocalFrame(
  component: RawComponent,
  path: number[],
  frame: Box,
) {
  let items = readArray(component.elements).filter(isRecord) as RawElement[];
  let parentElement: RawElement | null = null;
  let parentRenderBox: Box = {
    x: 0,
    y: 0,
    ...readSize(component.size, { width: STAGE_WIDTH, height: STAGE_HEIGHT }),
  };
  let x = 0;
  let y = 0;
  for (const index of path.slice(0, -1)) {
    const element = asRecord(items[index]);
    if (!element) return null;
    const laidOut =
      parentElement != null
        ? layoutChildren(parentElement, items, parentRenderBox).find(
          (item) => item.index === index,
        )
        : null;
    const box = laidOut?.box ?? elementBox(element);
    x += box.x;
    y += box.y;
    const childInfo = childArrayInfo(element);
    parentElement = element;
    parentRenderBox = { x: 0, y: 0, width: box.width, height: box.height };
    items = (childInfo?.items ?? []).filter(isRecord) as RawElement[];
  }
  return {
    x: x + frame.x,
    y: y + frame.y,
    width: frame.width,
    height: frame.height,
  };
}

export function renderedLocalBoxForElementSelection(
  ui: RawUi,
  selection: ElementSelection,
): Box | null {
  if (selection.componentIndex === ROOT_ELEMENTS_COMPONENT_INDEX) {
    return localElementBox(rootElementsComponent(ui), selection.elementPath);
  }

  const component = asRecord(readArray(ui.components)[selection.componentIndex]);
  if (!component) return null;
  return localElementBox(component, selection.elementPath);
}

export function rootElementsComponent(ui: RawUi): RawComponent {
  return {
    position: { x: 0, y: 0 },
    size: { width: STAGE_WIDTH, height: STAGE_HEIGHT },
    elements: readArray(ui.elements),
  };
}

export function absoluteElementBox(component: RawComponent, path: number[]) {
  const local = localElementBox(component, path);
  if (!local) return null;
  let items = readArray(component.elements).filter(isRecord) as RawElement[];
  let parentElement: RawElement | null = null;
  let parentRenderBox: Box = {
    x: 0,
    y: 0,
    ...readSize(component.size, { width: STAGE_WIDTH, height: STAGE_HEIGHT }),
  };
  let x = 0;
  let y = 0;
  for (const index of path.slice(0, -1)) {
    const element = asRecord(items[index]);
    if (!element) return null;
    const laidOut =
      parentElement != null
        ? layoutChildren(parentElement, items, parentRenderBox).find(
          (item) => item.index === index,
        )
        : null;
    const box = laidOut?.box ?? elementBox(element);
    x += box.x;
    y += box.y;
    const childInfo = childArrayInfo(element);
    parentElement = element;
    parentRenderBox = { x: 0, y: 0, width: box.width, height: box.height };
    items = (childInfo?.items ?? []).filter(isRecord) as RawElement[];
  }
  return {
    x: x + local.x,
    y: y + local.y,
    width: local.width,
    height: local.height,
  };
}

export function localElementBox(component: RawComponent, path: number[]) {
  let items = readArray(component.elements).filter(isRecord) as RawElement[];
  let parentElement: RawElement | null = null;
  let parentRenderBox: Box = {
    x: 0,
    y: 0,
    ...readSize(component.size, { width: STAGE_WIDTH, height: STAGE_HEIGHT }),
  };
  for (let depth = 0; depth < path.length; depth += 1) {
    const index = path[depth];
    const element = asRecord(items[index]);
    if (!element) return null;
    const laidOut =
      parentElement != null
        ? layoutChildren(parentElement, items, parentRenderBox).find(
          (item) => item.index === index,
        )
        : null;
    const box = laidOut?.box ?? elementBox(element);
    if (depth === path.length - 1) return box;
    const childInfo = childArrayInfo(element);
    parentElement = element;
    parentRenderBox = { x: 0, y: 0, width: box.width, height: box.height };
    items = (childInfo?.items ?? []).filter(isRecord) as RawElement[];
  }
  return null;
}

export function appendInsertedContent(
  sourceUi: RawUi,
  elements: UnknownRecord[],
  insertedComponents: UnknownRecord[],
  label?: string,
) {
  const components = [...readArray(sourceUi.components)];
  const start = components.length;
  elements.forEach((element, offset) => {
    components.push(insertedElementToComponent(element, label, start + offset));
  });
  insertedComponents.forEach((component, offset) => {
    components.push(
      insertedComponentToRaw(
        component,
        label,
        start + elements.length + offset,
      ),
    );
  });
  return { ...sourceUi, components };
}

export function insertedComponentToRaw(
  component: UnknownRecord,
  label: string | undefined,
  index: number,
): RawComponent {
  const conversion = sourceElementConversion(component);
  const box = sourceElementBox(component, conversion);
  const elements = readArray(component.elements)
    .filter(isRecord)
    .map((element) => rawElementFromInsertedElement(element, conversion));
  return {
    ...component,
    id: `${normalizeId(
      readString(component.id) ?? label ?? "inserted-component",
    )}_${index + 1}`,
    description:
      readString(component.description) ?? label ?? "Inserted component",
    position: { x: box.x, y: box.y },
    size: { width: box.width, height: box.height },
    elements,
  };
}

export function insertedElementToComponent(
  element: UnknownRecord,
  label: string | undefined,
  index: number,
) {
  const conversion = sourceElementConversion(element);
  const box = sourceElementBox(element, conversion);
  return {
    id: `${normalizeId(label ?? readString(element.type) ?? "inserted")}_${index + 1}`,
    description: label ?? "Inserted element",
    position: { x: box.x, y: box.y },
    size: { width: box.width, height: box.height },
    elements: [
      {
        ...rawElementFromInsertedElement(element, conversion),
        position: { x: 0, y: 0 },
        size: { width: box.width, height: box.height },
      },
    ],
  };
}

export function rawElementFromInsertedElement(
  element: UnknownRecord,
  conversion: InsertedElementConversion,
): RawElement {
  const type = readString(element.type) ?? "rectangle";
  const rawElement = scaleInsertedElementGeometry(element, conversion);
  const normalizedElement = {
    ...rawElement,
    font: rawFontToSource(rawElement.font),
    border_radius: scaleInsertedBorderRadius(
      rawElement.border_radius ?? rawElement.borderRadius,
      conversion,
    ),
    line_height: rawElement.line_height ?? rawElement.lineHeight,
  };
  const textScaledElement = scaleInsertedTextCollections(
    normalizedElement,
    conversion.scaleTemplateText,
  );

  if (type === "chart") {
    return editorChartToRawChart(textScaledElement, textScaledElement);
  }

  return textScaledElement;
}

export function sourceElementConversion(element: UnknownRecord): InsertedElementConversion {
  const size = sourceElementSize(element);
  const usesEditorUnits = size.width <= 20 && size.height <= 12;
  return {
    usesEditorUnits,
    scaleX: usesEditorUnits ? EDITOR_SCALE : 1,
    scaleY: usesEditorUnits ? EDITOR_SCALE_Y : 1,
    scaleTemplateText: usesEditorUnits && hasTemplateV2Metadata(element),
  };
}

export function sourceElementBox(
  element: UnknownRecord,
  conversion = sourceElementConversion(element),
): Box {
  const position = readPoint(element.position);
  const size = sourceElementSize(element);
  return {
    x: position.x * conversion.scaleX,
    y: position.y * conversion.scaleY,
    width: Math.max(1, size.width * conversion.scaleX),
    height: Math.max(1, size.height * conversion.scaleY),
  };
}

export function sourceElementSize(element: UnknownRecord): Size {
  const size = asRecord(element.size);
  return {
    width: Math.max(0.01, readNumber(size?.width) ?? 1),
    height: Math.max(0.01, readNumber(size?.height) ?? 1),
  };
}

export function scaleInsertedElementGeometry(
  element: UnknownRecord,
  conversion: InsertedElementConversion,
): RawElement {
  const convertedChildren = convertInsertedChildArrays(element, conversion);
  if (!conversion.usesEditorUnits) {
    return convertedChildren;
  }

  return stripUndefined({
    ...convertedChildren,
    position: scaleInsertedPoint(convertedChildren.position, conversion),
    size: scaleInsertedSize(convertedChildren.size, conversion),
    padding: scaleInsertedSpacing(convertedChildren.padding, conversion),
    gap: scaleInsertedDistance(convertedChildren.gap, conversion.scaleX),
    column_gap: scaleInsertedDistance(
      convertedChildren.column_gap,
      conversion.scaleX,
    ),
    row_gap: scaleInsertedDistance(convertedChildren.row_gap, conversion.scaleY),
    layout: scaleInsertedLayout(convertedChildren.layout, conversion),
  });
}

export function convertInsertedChildArrays(
  element: UnknownRecord,
  conversion: InsertedElementConversion,
): RawElement {
  const scaleChildText =
    conversion.scaleTemplateText || hasTemplateV2Metadata(element);
  const childConversion = {
    ...conversion,
    scaleTemplateText: scaleChildText,
  };
  const next: RawElement = { ...element };

  if (Array.isArray(element.children)) {
    next.children = element.children.map((child) =>
      isRecord(child) ? rawElementFromInsertedElement(child, childConversion) : child,
    );
  }
  if (Array.isArray(element.elements)) {
    next.elements = element.elements.map((child) =>
      isRecord(child) ? rawElementFromInsertedElement(child, childConversion) : child,
    );
  }
  if (isRecord(element.child)) {
    next.child = rawElementFromInsertedElement(element.child, childConversion);
  }

  return next;
}

export function scaleInsertedPoint(
  value: unknown,
  conversion: InsertedElementConversion,
) {
  const point = asRecord(value);
  if (!point) return value;
  return {
    ...point,
    x: scaleInsertedDistance(point.x, conversion.scaleX),
    y: scaleInsertedDistance(point.y, conversion.scaleY),
  };
}

export function scaleInsertedSize(
  value: unknown,
  conversion: InsertedElementConversion,
) {
  const size = asRecord(value);
  if (!size) return value;
  return {
    ...size,
    width: scaleInsertedDistance(size.width, conversion.scaleX),
    height: scaleInsertedDistance(size.height, conversion.scaleY),
  };
}

export function scaleInsertedSpacing(
  value: unknown,
  conversion: InsertedElementConversion,
) {
  const spacing = asRecord(value);
  if (!spacing) return value;
  return stripUndefined({
    ...spacing,
    top: scaleInsertedDistance(spacing.top, conversion.scaleY),
    right: scaleInsertedDistance(spacing.right, conversion.scaleX),
    bottom: scaleInsertedDistance(spacing.bottom, conversion.scaleY),
    left: scaleInsertedDistance(spacing.left, conversion.scaleX),
    x: scaleInsertedDistance(spacing.x, conversion.scaleX),
    y: scaleInsertedDistance(spacing.y, conversion.scaleY),
    horizontal: scaleInsertedDistance(spacing.horizontal, conversion.scaleX),
    vertical: scaleInsertedDistance(spacing.vertical, conversion.scaleY),
  });
}

export function scaleInsertedLayout(
  value: unknown,
  conversion: InsertedElementConversion,
) {
  const layout = asRecord(value);
  if (!layout) return value;
  return stripUndefined({
    ...layout,
    basis: scaleInsertedDistance(layout.basis, conversion.scaleX),
    min_width: scaleInsertedDistance(layout.min_width, conversion.scaleX),
    max_width: scaleInsertedDistance(layout.max_width, conversion.scaleX),
    min_height: scaleInsertedDistance(layout.min_height, conversion.scaleY),
    max_height: scaleInsertedDistance(layout.max_height, conversion.scaleY),
  });
}

export function scaleInsertedBorderRadius(
  value: unknown,
  conversion: InsertedElementConversion,
) {
  if (!conversion.usesEditorUnits) return value;
  if (typeof value === "number") return value * conversion.scaleX;
  const radius = asRecord(value);
  if (!radius) return value;
  return stripUndefined({
    ...radius,
    radius: scaleInsertedDistance(radius.radius, conversion.scaleX),
    tl: scaleInsertedDistance(radius.tl, conversion.scaleX),
    tr: scaleInsertedDistance(radius.tr, conversion.scaleX),
    bl: scaleInsertedDistance(radius.bl, conversion.scaleX),
    br: scaleInsertedDistance(radius.br, conversion.scaleX),
    topLeft: scaleInsertedDistance(radius.topLeft, conversion.scaleX),
    topRight: scaleInsertedDistance(radius.topRight, conversion.scaleX),
    bottomLeft: scaleInsertedDistance(radius.bottomLeft, conversion.scaleX),
    bottomRight: scaleInsertedDistance(radius.bottomRight, conversion.scaleX),
  });
}

export function scaleInsertedDistance(value: unknown, scale: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? value * scale
    : value;
}

export function hasTemplateV2Metadata(element: UnknownRecord) {
  return Boolean(
    element.component_id ||
    element.component_instance_id ||
    element.component_slot ||
    element.component_description ||
    (Array.isArray(element.design_variables) &&
      element.design_variables.length > 0),
  );
}

export function scaleInsertedTextCollections(
  element: RawElement,
  scaleTemplateText: boolean,
): RawElement {
  if (!scaleTemplateText) return element;
  return stripUndefined({
    ...element,
    runs: scaleInsertedTextRuns(element.runs),
    items: scaleInsertedTextListItems(element.items),
    columns: scaleInsertedTableCells(element.columns),
    rows: scaleInsertedTableRows(element.rows),
  });
}

export function scaleInsertedTextRuns(value: unknown) {
  if (!Array.isArray(value)) return value;
  return value.map((run) => {
    if (!isRecord(run)) return run;
    return {
      ...run,
      font: rawFontToSource(run.font),
    };
  });
}

export function scaleInsertedTextListItems(value: unknown) {
  if (!Array.isArray(value)) return value;
  return value.map((item) =>
    Array.isArray(item)
      ? scaleInsertedTextRuns(item)
      : item,
  );
}

export function scaleInsertedTableRows(value: unknown) {
  if (!Array.isArray(value)) return value;
  return value.map((row) =>
    Array.isArray(row)
      ? scaleInsertedTableCells(row)
      : row,
  );
}

export function scaleInsertedTableCells(value: unknown) {
  if (!Array.isArray(value)) return value;
  return value.map((cell) => {
    if (!isRecord(cell)) return cell;
    return {
      ...cell,
      font: rawFontToSource(cell.font),
      runs: scaleInsertedTextRuns(cell.runs),
    };
  });
}

export function eventTargetsThisSlide(
  detail: {
    slideId?: string | number | null;
    slideIndex?: number | null;
  },
  slideId: string | number | null | undefined,
  slideIndex: number | null,
  isSurfaceActive: () => boolean,
) {
  const currentSlideId = slideId != null ? String(slideId) : null;
  const eventSlideId =
    detail.slideId !== undefined && detail.slideId !== null
      ? String(detail.slideId)
      : null;
  if (eventSlideId && currentSlideId && eventSlideId !== currentSlideId) {
    return false;
  }
  if (
    !eventSlideId &&
    typeof detail.slideIndex === "number" &&
    (slideIndex == null || detail.slideIndex !== slideIndex)
  ) {
    return false;
  }
  const hasTarget = Boolean(eventSlideId) || typeof detail.slideIndex === "number";
  return hasTarget || isSurfaceActive();
}

export function keyForSelection(selection: Selection) {
  if (!selection) return "";
  if (selection.kind === "component") return `component:${selection.componentIndex}`;
  if (selection.kind === "multi-component") {
    return `multi-component:${selection.componentIndexes.join(".")}`;
  }
  return `element:${selection.componentIndex}:${selection.elementPath.join(".")}`;
}

export function keysForSelection(selection: Selection) {
  if (!selection) return [];
  if (selection.kind === "multi-component") {
    return selection.componentIndexes.map((componentIndex) =>
      keyForSelection({ kind: "component", componentIndex }),
    );
  }
  return [keyForSelection(selection)];
}

export function selectionWithComponentToggle(
  currentSelection: Selection,
  nextSelection: Selection,
  options?: SelectOptions,
): Selection {
  if (!options?.additive || nextSelection?.kind !== "component") {
    return nextSelection;
  }

  const componentIndex = nextSelection.componentIndex;
  const currentIndexes = componentIndexesForSelection(currentSelection);
  const nextIndexes = currentIndexes.includes(componentIndex)
    ? currentIndexes.filter((index) => index !== componentIndex)
    : [...currentIndexes, componentIndex];

  return selectionForComponentIndexes(nextIndexes);
}

export function componentIndexesForSelection(selection: Selection) {
  if (!selection) return [];
  if (selection.kind === "component") return [selection.componentIndex];
  if (selection.kind === "multi-component") return selection.componentIndexes;
  return [];
}

export function selectionForComponentIndexes(indexes: number[]): Selection {
  const uniqueIndexes = Array.from(
    new Set(indexes.filter((index) => Number.isInteger(index) && index >= 0)),
  );
  if (uniqueIndexes.length === 0) return null;
  if (uniqueIndexes.length === 1) {
    return { kind: "component", componentIndex: uniqueIndexes[0] };
  }
  return { kind: "multi-component", componentIndexes: uniqueIndexes };
}

export function componentForClipboardSelection(
  ui: RawUi,
  selection: Selection,
): { components: Array<{ component: RawComponent; box: Box }>; box: Box } | null {
  if (!selection) return null;

  if (selection.kind === "multi-component") {
    const components = selection.componentIndexes.flatMap((componentIndex) => {
      const component = asRecord(readArray(ui.components)[componentIndex]);
      return component ? [{ component, box: componentBox(component) }] : [];
    });
    return components.length > 0
      ? { components, box: unionBoxes(components.map((item) => item.box)) }
      : null;
  }

  if (selection.kind === "component") {
    const component = asRecord(readArray(ui.components)[selection.componentIndex]);
    return component
      ? {
        components: [{ component, box: componentBox(component) }],
        box: componentBox(component),
      }
      : null;
  }

  if (selection.componentIndex >= 0) {
    const component = asRecord(readArray(ui.components)[selection.componentIndex]);
    return component
      ? {
        components: [{ component, box: componentBox(component) }],
        box: componentBox(component),
      }
      : null;
  }

  const element = getElementAtSelection(ui, selection);
  const box = absoluteBoxForSelection(ui, selection);
  return element && box
    ? {
      components: [{ component: rootElementClipboardComponent(element, box), box }],
      box,
    }
    : null;
}

export function rootElementClipboardComponent(element: RawElement, box: Box): RawComponent {
  const type = readString(element.type) ?? "element";
  const label =
    readString(element.name) || readString(element.id) || `Copied ${type}`;
  return {
    id: `${normalizeId(label)}_component`,
    description: label,
    position: { x: box.x, y: box.y },
    size: { width: box.width, height: box.height },
    elements: [
      {
        ...element,
        position: { x: 0, y: 0 },
        size: { width: box.width, height: box.height },
      },
    ],
  };
}

function unionBoxes(boxes: Box[]): Box {
  if (boxes.length === 0) return { x: 0, y: 0, width: 1, height: 1 };
  const left = Math.min(...boxes.map((box) => box.x));
  const top = Math.min(...boxes.map((box) => box.y));
  const right = Math.max(...boxes.map((box) => box.x + box.width));
  const bottom = Math.max(...boxes.map((box) => box.y + box.height));
  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}

export function surfaceSelectionTarget(
  ui: RawUi,
  selection: Selection,
  slideIndex: number | null,
): TemplateV2SurfaceSelectedDetail["selection"] {
  if (!selection) return null;
  if (selection.kind === "multi-component") return null;
  if (selection.kind === "component") {
    const component = asRecord(readArray(ui.components)[selection.componentIndex]);
    const componentLabel = componentDisplayLabel(component, selection.componentIndex);
    return {
      kind: "component",
      slideIndex,
      componentIndex: selection.componentIndex,
      componentId: readString(component?.id) || undefined,
      componentLabel,
      targetLabel: componentLabel,
    };
  }

  const element = getElementAtSelection(ui, selection);
  const component = asRecord(readArray(ui.components)[selection.componentIndex]);
  const componentLabel =
    selection.componentIndex === ROOT_ELEMENTS_COMPONENT_INDEX
      ? ""
      : componentDisplayLabel(component, selection.componentIndex);
  const elementType = readString(element?.type) || "Element";
  const elementName = readString(element?.name);
  const targetLabel =
    elementName ||
    (componentLabel ? `${elementType} in ${componentLabel}` : elementType);
  return {
    kind: "element",
    slideIndex,
    componentIndex:
      selection.componentIndex === ROOT_ELEMENTS_COMPONENT_INDEX
        ? undefined
        : selection.componentIndex,
    componentId: readString(component?.id) || undefined,
    componentLabel: componentLabel || undefined,
    elementPath: elementPathForSelection(ui, selection) || undefined,
    elementType,
    elementName: elementName || undefined,
    targetLabel,
  };
}

export function componentDisplayLabel(component: UnknownRecord | null, index: number) {
  return (
    readString(component?.description) ||
    readString(component?.name) ||
    readString(component?.id) ||
    `Component ${index + 1}`
  );
}

export function elementPathForSelection(ui: RawUi, selection: ElementSelection) {
  const parts: string[] =
    selection.componentIndex === ROOT_ELEMENTS_COMPONENT_INDEX
      ? []
      : [`components[${selection.componentIndex}]`];
  let items =
    selection.componentIndex === ROOT_ELEMENTS_COMPONENT_INDEX
      ? readArray(ui.elements)
      : readArray(asRecord(readArray(ui.components)[selection.componentIndex])?.elements);
  let current: RawElement | null = null;

  for (let depth = 0; depth < selection.elementPath.length; depth += 1) {
    const index = selection.elementPath[depth] ?? -1;
    if (!Number.isFinite(index) || index < 0 || index >= items.length) return "";
    if (depth === 0) {
      parts.push(`elements[${index}]`);
    } else if (current) {
      const childInfo = childArrayInfo(current);
      if (!childInfo) return "";
      parts.push(childInfo.key === "child" ? "child" : `${childInfo.key}[${index}]`);
    }
    current = asRecord(items[index]) as RawElement | null;
    items = current ? childArrayInfo(current)?.items ?? [] : [];
  }

  return parts.join(".");
}

export function selectionFromKey(key: string): Selection {
  if (key.startsWith("component:")) {
    const componentIndex = Number(key.split(":")[1]);
    return Number.isFinite(componentIndex)
      ? { kind: "component", componentIndex }
      : null;
  }
  if (key.startsWith("multi-component:")) {
    const componentIndexes = key
      .split(":")[1]
      ?.split(".")
      .map(Number)
      .filter((value) => Number.isInteger(value) && value >= 0) ?? [];
    return selectionForComponentIndexes(componentIndexes);
  }
  const [, component, path] = key.split(":");
  const componentIndex = Number(component);
  const elementPath = path
    ?.split(".")
    .map(Number)
    .filter((value) => Number.isFinite(value));
  if (!Number.isFinite(componentIndex) || !elementPath?.length) return null;
  return { kind: "element", componentIndex, elementPath };
}

export function selectionTouchesComponent(
  key: string | null,
  componentIndex: number,
) {
  return (
    key === `component:${componentIndex}` ||
    key?.startsWith(`element:${componentIndex}:`) === true
  );
}

export function selectionTouchesElement(
  key: string | null,
  componentIndex: number,
  elementPath: number[],
) {
  if (!key) return false;
  const ownKey = `element:${componentIndex}:${elementPath.join(".")}`;
  return key === ownKey || key.startsWith(`${ownKey}.`);
}

export function numberPathEqual(previous: number[], next: number[]) {
  return (
    previous.length === next.length &&
    previous.every((value, index) => value === next[index])
  );
}

export function boxEqual(previous: Box, next: Box) {
  return (
    previous.x === next.x &&
    previous.y === next.y &&
    previous.width === next.width &&
    previous.height === next.height
  );
}

export function nullableBoxEqual(
  previous: Box | null | undefined,
  next: Box | null | undefined,
) {
  if (previous == null || next == null) return previous == null && next == null;
  return boxEqual(previous, next);
}

export function componentKey(component: RawComponent, index: number) {
  return `${readString(component.id) ?? "component"}:${index}`;
}

export function rawElementKey(element: RawElement, index: number) {
  return `${readString(element.id) ?? readString(element.name) ?? readString(element.type) ?? "element"}:${index}`;
}

export function componentBox(component: RawComponent): Box {
  return {
    ...readPoint(component.position),
    ...readSize(component.size, { width: STAGE_WIDTH, height: STAGE_HEIGHT }),
  };
}

export function elementBox(element: RawElement): Box {
  return {
    ...readPoint(element.position),
    ...elementSize(element),
  };
}

export function isManualPositioned(element: RawElement) {
  return element.__presenton_manual_position === true;
}

export function elementSize(element: RawElement, fallback?: Size): Size {
  const explicit = readOptionalSize(element.size);
  if (explicit) return explicit;

  const type = readString(element.type);
  if (type === "group") {
    return childrenBounds(childArrayInfo(element)?.items ?? []);
  }
  if (type === "container") {
    const padding = readPadding(element.padding);
    const child = asRecord(element.child);
    const childSize = child ? elementSize(child, fallback) : fallback;
    if (childSize) {
      return {
        width: Math.max(1, childSize.width + padding.left + padding.right),
        height: Math.max(1, childSize.height + padding.top + padding.bottom),
      };
    }
  }
  if (type === "text") {
    const font = rawFont(element);
    const text = displayText(rawTextContent(element));
    const width = fallback?.width ?? estimateTextWidth(text, font);
    return {
      width: Math.max(1, width),
      height: Math.max(1, estimateTextHeight(text, font, width)),
    };
  }
  if (type === "text-list") {
    const font = rawFont(element);
    const text = displayText(textRunsContent(rawTextListRunsForEditor(element)));
    const width = fallback?.width ?? estimateTextWidth(text, font);
    return {
      width: Math.max(1, width),
      height: Math.max(1, estimateTextHeight(text, font, width)),
    };
  }
  if (type === "line") {
    return {
      width: fallback?.width ?? DECORATIVE_LINE_LENGTH,
      height: fallback?.height ?? DECORATIVE_LINE_THICKNESS,
    };
  }
  if (type === "rectangle" || type === "ellipse") {
    return {
      width: fallback?.width ?? DECORATIVE_LINE_LENGTH,
      height: fallback?.height ?? DECORATIVE_LINE_LENGTH,
    };
  }
  if (type === "flex" || type === "grid") {
    return fallback ?? childrenBounds(childArrayInfo(element)?.items ?? []);
  }
  return fallback ?? { width: 1, height: 1 };
}

export function childrenBounds(children: unknown[]): Size {
  const records = children.filter(isRecord) as RawElement[];
  if (records.length === 0) return { width: 1, height: 1 };

  return records.reduce<Size>(
    (bounds, child) => {
      const box = elementBox(child);
      return {
        width: Math.max(bounds.width, box.x + box.width),
        height: Math.max(bounds.height, box.y + box.height),
      };
    },
    { width: 1, height: 1 },
  );
}

export function childArrayInfo(element: RawElement): ChildArrayInfo | null {
  if (Array.isArray(element.children)) return { key: "children", items: element.children };
  if (Array.isArray(element.elements)) return { key: "elements", items: element.elements };
  if (isRecord(element.child)) return { key: "child", items: [element.child] };
  return null;
}

export function withUpdatedChildItems(
  element: RawElement,
  childInfo: ChildArrayInfo,
  updatedChildren: unknown[],
) {
  if (childInfo.key === "child") {
    return { ...element, child: updatedChildren[0] ?? null };
  }
  return { ...element, [childInfo.key]: updatedChildren };
}

export function shouldClipElementChildren(
  element: RawElement,
  childInfo: ChildArrayInfo | null,
) {
  if (!childInfo) return false;
  const type = readString(element.type);
  return (
    type === "container" ||
    type === "flex" ||
    type === "grid"
  );
}

export function isBoxVisualType(type: string | null) {
  return (
    type === "rectangle" ||
    type === "container" ||
    type === "flex" ||
    type === "grid" ||
    type === "group"
  );
}

export function elementWithInlineDraft(
  element: RawElement,
  kind: TemplateV2InlineEditKind,
  draft: string,
  style?: TemplateV2TextEditStyle,
  frame?: Box | null,
  runs?: TextRun[],
) {
  if (kind === "text") {
    const next =
      runs != null
        ? setRawTextRunsContent(element, runs)
        : draft === rawTextContent(element)
          ? element
          : setRawTextContent(element, draft, style);
    return preserveInlineEditFrame(next, frame);
  }
  if (kind === "text-list") {
    const next =
      runs != null
        ? setRawTextListRunsContent(element, runs)
        : setRawTextListContent(element, draft);
    return preserveInlineEditFrame(
      style ? applyTextStyle(next, style) : next,
      frame,
    );
  }
  return element;
}

export function preserveInlineEditFrame(element: RawElement, frame?: Box | null) {
  if (!frame) return element;
  return {
    ...element,
    position: {
      ...(asRecord(element.position) ?? {}),
      x: frame.x,
      y: frame.y,
    },
    size: {
      ...(asRecord(element.size) ?? {}),
      width: frame.width,
      height: frame.height,
    },
    __presenton_manual_position: true,
  };
}

export function normalizeMarkdownTextInUi(ui: RawUi): RawUi {
  let changed = false;
  const nextUi: RawUi = { ...ui };
  const elements = readArray(ui.elements);
  const normalizedElements = normalizeMarkdownTextElementArray(elements);
  if (normalizedElements !== elements) {
    nextUi.elements = normalizedElements;
    changed = true;
  }

  const components = readArray(ui.components);
  let componentsChanged = false;
  const normalizedComponents = components.map((component) => {
    const record = asRecord(component);
    if (!record) return component;
    const componentElements = readArray(record.elements);
    const normalizedComponentElements =
      normalizeMarkdownTextElementArray(componentElements);
    if (normalizedComponentElements === componentElements) return component;
    componentsChanged = true;
    return {
      ...record,
      elements: normalizedComponentElements,
    };
  });

  if (componentsChanged) {
    nextUi.components = normalizedComponents;
    changed = true;
  }

  return changed ? nextUi : ui;
}

export function normalizeMarkdownTextElementArray(elements: unknown[]): unknown[] {
  let changed = false;
  const normalized = elements.map((element) => {
    const next = normalizeMarkdownTextElementTree(element);
    if (next !== element) changed = true;
    return next;
  });
  return changed ? normalized : elements;
}

export function normalizeMarkdownTextElementTree(value: unknown): unknown {
  const element = asRecord(value);
  if (!element) return value;

  let next = element;
  if (readString(element.type) === "text") {
    const normalized = normalizeRawTextMarkdownElement(element);
    next = normalized.element;
  }

  const childInfo = childArrayInfo(next);
  if (!childInfo) return next;

  const normalizedChildren = normalizeMarkdownTextElementArray(childInfo.items);
  return normalizedChildren === childInfo.items
    ? next
    : withUpdatedChildItems(next, childInfo, normalizedChildren);
}

export function rawElementForEditorToolbar(
  element: RawElement,
  absoluteBox: Box,
): SlideElement | null {
  const type = readString(element.type);
  if (!type) return null;

  const projected: UnknownRecord = {
    ...element,
    type,
    position: {
      x: absoluteBox.x / EDITOR_SCALE,
      y: absoluteBox.y / EDITOR_SCALE,
    },
    size: {
      width: absoluteBox.width / EDITOR_SCALE,
      height: absoluteBox.height / EDITOR_SCALE,
    },
    font: rawFontRecordForEditor(element.font),
    stroke: rawStrokeForEditor(element.stroke),
    border_radius: rawBorderRadiusForEditor(
      element.border_radius ?? element.borderRadius,
    ),
  };

  if (type === "text") {
    projected.runs = rawTextRunsForEditor(element).map((run) => ({
      text: run.text,
      font: rawFontRecordForEditor(run.font),
    }));
  } else if (type === "text-list") {
    projected.items = readArray(element.items).map((item) => {
      if (Array.isArray(item)) {
        return item.map((value) => {
          const run = asRecord(value) ?? {};
          return { ...run, font: rawFontRecordForEditor(run.font) };
        });
      }
      return [{ text: rawTextListItemText(item) }];
    });
  } else if (type === "table") {
    projected.columns = readArray(element.columns).map(rawTableCellForEditor);
    projected.rows = readArray(element.rows).map((row) =>
      readArray(row).map(rawTableCellForEditor),
    );
  } else if (type === "chart") {
    Object.assign(projected, rawChartToEditorChart(element));
    projected.position = {
      x: absoluteBox.x / EDITOR_SCALE,
      y: absoluteBox.y / EDITOR_SCALE,
    };
    projected.size = {
      width: absoluteBox.width / EDITOR_SCALE,
      height: absoluteBox.height / EDITOR_SCALE,
    };
  }

  return projected as unknown as SlideElement;
}

export function mergeEditorToolbarElement(
  current: RawElement,
  editorElement: SlideElement,
  renderedBox: Box,
): RawElement {
  const editor = editorElement as unknown as UnknownRecord;
  const currentPosition = readPoint(current.position);
  const editorPosition = asRecord(editor.position);
  const editorSize = asRecord(editor.size);
  const editorX = readNumber(editorPosition?.x);
  const editorY = readNumber(editorPosition?.y);
  const editorWidth = readNumber(editorSize?.width);
  const editorHeight = readNumber(editorSize?.height);
  const nextPosition = {
    x:
      currentPosition.x +
      ((editorX ?? renderedBox.x / EDITOR_SCALE) * EDITOR_SCALE -
        renderedBox.x),
    y:
      currentPosition.y +
      ((editorY ?? renderedBox.y / EDITOR_SCALE) * EDITOR_SCALE -
        renderedBox.y),
  };
  const nextSize = {
    width: Math.max(
      1,
      (editorWidth ?? renderedBox.width / EDITOR_SCALE) * EDITOR_SCALE,
    ),
    height: Math.max(
      1,
      (editorHeight ?? renderedBox.height / EDITOR_SCALE) * EDITOR_SCALE,
    ),
  };
  const merged: RawElement = {
    ...current,
    ...editor,
    position: nextPosition,
    size: nextSize,
    font: editorFontRecordToRaw(editor.font, current.font),
    stroke: editorStrokeToRaw(editor.stroke, current.stroke),
    border_radius: editorBorderRadiusToRaw(
      editor.border_radius ?? editor.borderRadius,
      current.border_radius ?? current.borderRadius,
    ),
  };

  if (Array.isArray(editor.runs)) {
    const currentRuns = readArray(current.runs);
    merged.runs = editor.runs.map((value, index) => {
      const run = asRecord(value) ?? {};
      const currentRun = asRecord(currentRuns[index]) ?? {};
      return {
        ...currentRun,
        ...run,
        font: editorFontRecordToRaw(run.font, currentRun.font),
      };
    });
  }
  if (readString(current.type) === "table") {
    merged.columns = readArray(editor.columns).map((cell, index) =>
      editorTableCellToRaw(cell, readArray(current.columns)[index]),
    );
    merged.rows = readArray(editor.rows).map((row, rowIndex) =>
      readArray(row).map((cell, colIndex) =>
        editorTableCellToRaw(
          cell,
          readArray(readArray(current.rows)[rowIndex])[colIndex],
        ),
      ),
    );
  }
  if (
    Math.abs(nextPosition.x - currentPosition.x) > 0.01 ||
    Math.abs(nextPosition.y - currentPosition.y) > 0.01 ||
    Math.abs(nextSize.width - elementSize(current).width) > 0.01 ||
    Math.abs(nextSize.height - elementSize(current).height) > 0.01
  ) {
    merged.__presenton_manual_position = true;
  }
  return merged;
}

export function rawStrokeForEditor(value: unknown) {
  const stroke = asRecord(value);
  if (!stroke) return value;
  return { ...stroke };
}

export function editorStrokeToRaw(value: unknown, fallback: unknown) {
  const stroke = asRecord(value);
  if (!stroke) return fallback;
  return {
    ...(asRecord(fallback) ?? {}),
    ...stroke,
  };
}

export function rawBorderRadiusForEditor(value: unknown) {
  const radius = asRecord(value);
  const uniform = readNumber(value);
  if (!radius && uniform == null) return value;
  const raw = radius ?? { tl: uniform, tr: uniform, bl: uniform, br: uniform };
  return {
    tl: (readNumber(raw.tl) ?? 0) / EDITOR_SCALE,
    tr: (readNumber(raw.tr) ?? 0) / EDITOR_SCALE,
    bl: (readNumber(raw.bl) ?? 0) / EDITOR_SCALE,
    br: (readNumber(raw.br) ?? 0) / EDITOR_SCALE,
  };
}

export function editorBorderRadiusToRaw(value: unknown, fallback: unknown) {
  const radius = asRecord(value);
  if (!radius) return fallback;
  return {
    tl: (readNumber(radius.tl) ?? 0) * EDITOR_SCALE,
    tr: (readNumber(radius.tr) ?? 0) * EDITOR_SCALE,
    bl: (readNumber(radius.bl) ?? 0) * EDITOR_SCALE,
    br: (readNumber(radius.br) ?? 0) * EDITOR_SCALE,
  };
}

export function rawTableCellForEditor(value: unknown) {
  const cell = asRecord(value) ?? {};
  const rawRuns = readArray(cell.runs);
  const runs =
    rawRuns.length > 0
      ? rawRuns.map((value) => {
        const run = asRecord(value) ?? {};
        return { ...run, font: rawFontRecordForEditor(run.font) };
      })
      : [{ text: rawTableCellText(cell) }];
  return {
    ...cell,
    color: cell.color ?? cell.fill,
    font: rawFontRecordForEditor(cell.font),
    runs,
  };
}

export function editorTableCellToRaw(value: unknown, fallback: unknown) {
  const cell = asRecord(value) ?? {};
  const current = asRecord(fallback) ?? {};
  const currentRuns = readArray(current.runs);
  return {
    ...current,
    ...cell,
    color: cell.color ?? current.color ?? current.fill,
    font: editorFontRecordToRaw(cell.font, current.font),
    runs: readArray(cell.runs).map((value, index) => {
      const run = asRecord(value) ?? {};
      const currentRun = asRecord(currentRuns[index]) ?? {};
      return {
        ...currentRun,
        ...run,
        font: editorFontRecordToRaw(run.font, currentRun.font),
      };
    }),
  };
}

export function rawChartToEditorChart(element: RawElement): ChartElement {
  const categories = readArray(element.categories).map(String);
  const series = readArray(element.series)
    .map((value, index): ChartSeries | null => {
      const record = asRecord(value);
      if (!record) return null;
      const values = readArray(record.values ?? record.data).map(
        (item) => readNumber(item) ?? 0,
      );
      return {
        name: readString(record.name) ?? `Series ${index + 1}`,
        values,
      };
    })
    .filter((value): value is ChartSeries => value != null);
  const normalizedSeries =
    series.length > 0 ? series : [{ name: "Series 1", values: [0] }];
  const normalizedCategories =
    categories.length > 0
      ? categories
      : normalizedSeries[0].values.map((_, index) => `Item ${index + 1}`);
  const colors = readArray(
    element.series_colors ?? element.seriesColors,
  ).map(String);
  const chartType = rawChartType(element.chart_type ?? element.chartType);
  const usesUnifiedColor =
    chartType === "bar" || chartType === "line" || chartType === "area";
  const chartColors = usesUnifiedColor
    ? [colors[0] ?? readString(element.color) ?? "7C51F8"]
    : colors;
  const firstSeries = normalizedSeries[0];
  const data = normalizedCategories.slice(0, 8).map((label, index) => ({
    label,
    value: firstSeries.values[index] ?? 0,
    color: usesUnifiedColor
      ? chartColors[0]
      : chartColors[index] ?? chartColors[0],
  }));

  return {
    ...element,
    type: "chart",
    chart_type: chartType,
    data: data.length > 0 ? data : [{ label: "Item 1", value: 0 }],
    categories: normalizedCategories,
    series: normalizedSeries,
    series_colors: chartColors,
    axis_color: element.axis_color ?? element.axisColor,
    data_labels_color: element.data_labels_color ?? element.labelColor,
    x_axis: element.x_axis ?? element.xAxis,
    y_axis: element.y_axis ?? element.yAxis,
    x_axis_title: element.x_axis_title ?? element.xAxisTitle,
    y_axis_title: element.y_axis_title ?? element.yAxisTitle,
    data_labels: element.data_labels ?? element.dataLabels,
  };
}

export function editorChartToRawChart(source: RawElement, chart: UnknownRecord) {
  return {
    ...source,
    ...chart,
    type: "chart",
    position: source.position,
    size: source.size,
    rotation: source.rotation,
    layout: source.layout,
    chart_type: chart.chartType ?? chart.chart_type ?? source.chart_type,
    series_colors: chart.seriesColors ?? chart.series_colors ?? source.series_colors,
    axis_color: chart.axisColor ?? chart.axis_color ?? source.axis_color,
    data_labels_color:
      chart.labelColor ?? chart.data_labels_color ?? source.data_labels_color,
    x_axis: chart.xAxis ?? chart.x_axis ?? source.x_axis,
    y_axis: chart.yAxis ?? chart.y_axis ?? source.y_axis,
    x_axis_title: chart.xAxisTitle ?? chart.x_axis_title ?? source.x_axis_title,
    y_axis_title: chart.yAxisTitle ?? chart.y_axis_title ?? source.y_axis_title,
    data_labels: chart.dataLabels ?? chart.data_labels ?? source.data_labels,
  };
}

export function linePoints(width: number, height: number, strokeWidthValue: number) {
  if (height <= Math.max(2, strokeWidthValue * 2)) {
    return [0, height / 2, width, height / 2];
  }
  if (width <= Math.max(2, strokeWidthValue * 2)) {
    return [width / 2, 0, width / 2, height];
  }
  return [0, 0, width, height];
}

export function valueProgress(element: RawElement) {
  const min = readNumber(element.min_value) ?? readNumber(element.minValue) ?? 0;
  const max = readNumber(element.max_value) ?? readNumber(element.maxValue) ?? 100;
  const value = readNumber(element.value) ?? min;
  const range = max - min;
  if (!Number.isFinite(range) || range === 0) return 0;
  return clamp((value - min) / range, 0, 1);
}

export function pointOnCircle(x: number, y: number, radius: number, degrees: number) {
  const radians = (degrees * Math.PI) / 180;
  return {
    x: x + Math.cos(radians) * radius,
    y: y + Math.sin(radians) * radius,
  };
}

export function backgroundColor(ui: RawUi) {
  return withHash(readString(ui.background) ?? "#FFFFFF");
}

export function fillColor(fill: unknown) {
  const value = asRecord(fill);
  return withHash(readString(value?.color));
}

export function fillOpacity(fill: unknown) {
  const value = asRecord(fill);
  return readNumber(value?.opacity) ?? 1;
}

export function strokeColor(stroke: unknown) {
  const value = asRecord(stroke);
  return withHash(readString(value?.color));
}

export function strokeWidth(stroke: unknown) {
  const value = asRecord(stroke);
  return readNumber(value?.width) ?? 0;
}

export function strokeOpacity(stroke: unknown) {
  const value = asRecord(stroke);
  return readNumber(value?.opacity) ?? 1;
}

export function colorWithOpacity(color: string | undefined, opacity: number) {
  if (!color) return undefined;
  const alpha = clamp(opacity, 0, 1);
  if (alpha >= 1) return color;
  const hex = color.startsWith("#") ? color.slice(1) : color;
  if (hex.length === 3) {
    const [r, g, b] = hex.split("").map((part) => parseInt(part + part, 16));
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  if (hex.length === 6) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return color;
}

export function shadowProps(element: RawElement) {
  const shadow = asRecord(element.shadow);
  if (!shadow) return {};
  const color = withHash(readString(shadow.color) ?? "#000000");
  const opacity = readNumber(shadow.opacity) ?? 0.2;
  const blur = readNumber(shadow.blur) ?? 0;
  const offsetX = readNumber(shadow.offset_x) ?? readNumber(shadow.offsetX) ?? 0;
  const offsetY = readNumber(shadow.offset_y) ?? readNumber(shadow.offsetY) ?? 0;
  if (opacity <= 0 || (blur <= 0 && offsetX === 0 && offsetY === 0)) return {};
  return {
    shadowColor: color,
    shadowOpacity: opacity,
    shadowBlur: blur,
    shadowOffsetX: offsetX,
    shadowOffsetY: offsetY,
  };
}

export function borderRadius(element: RawElement) {
  const value = element.border_radius ?? element.borderRadius;
  if (typeof value === "number") return value;
  const record = asRecord(value);
  const radius = readNumber(record?.radius);
  if (radius != null) return radius;
  const topLeft = readNumber(record?.tl) ?? readNumber(record?.topLeft) ?? 0;
  const topRight = readNumber(record?.tr) ?? readNumber(record?.topRight) ?? topLeft;
  const bottomRight =
    readNumber(record?.br) ?? readNumber(record?.bottomRight) ?? topRight;
  const bottomLeft =
    readNumber(record?.bl) ?? readNumber(record?.bottomLeft) ?? bottomRight;
  if (topLeft || topRight || bottomRight || bottomLeft) {
    return [topLeft, topRight, bottomRight, bottomLeft];
  }
  return 0;
}

export function readPadding(value: unknown) {
  if (typeof value === "number") {
    return { top: value, right: value, bottom: value, left: value };
  }
  const record = asRecord(value);
  const x = readNumber(record?.x) ?? readNumber(record?.horizontal);
  const y = readNumber(record?.y) ?? readNumber(record?.vertical);
  return {
    top: readNumber(record?.top) ?? y ?? 0,
    right: readNumber(record?.right) ?? x ?? 0,
    bottom: readNumber(record?.bottom) ?? y ?? 0,
    left: readNumber(record?.left) ?? x ?? 0,
  };
}

export function alignmentOffset(alignment: string | null, available: number, used: number) {
  const free = Math.max(0, available - used);
  if (alignment === "center") return free / 2;
  if (
    alignment === "right" ||
    alignment === "bottom" ||
    alignment === "end" ||
    alignment === "flex-end"
  ) {
    return free;
  }
  return 0;
}

export function readPoint(value: unknown): Point {
  const record = asRecord(value);
  return {
    x: readNumber(record?.x) ?? 0,
    y: readNumber(record?.y) ?? 0,
  };
}

export function readSize(
  value: unknown,
  fallback: Size = { width: 1, height: 1 },
): Size {
  const record = asRecord(value);
  return {
    width: Math.max(1, readNumber(record?.width) ?? fallback.width),
    height: Math.max(1, readNumber(record?.height) ?? fallback.height),
  };
}

export function readOptionalSize(value: unknown): Size | null {
  const record = asRecord(value);
  const width = readNumber(record?.width);
  const height = readNumber(record?.height);
  if (width == null || height == null) return null;
  return {
    width: Math.max(1, width),
    height: Math.max(1, height),
  };
}

export function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function stripUndefined<T extends UnknownRecord>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as T;
}

export function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

export function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(asRecord(value));
}

export function readString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function readBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

export function rawIconQuery(element: RawElement): string {
  for (const key of ["icon_query", "query", "__icon_query__"]) {
    const query = readString(element[key])?.trim();
    if (query) return query;
  }

  const name = (readString(element.name) ?? "").replace(/[_-]+/g, " ").trim();
  return name || "icon";
}

export function isRawIconElement(element: RawElement): boolean {
  return (
    readString(element.type) === "image" && readBoolean(element.is_icon) === true
  );
}

export function isStaticSvgIconSource(source: string, baseUrl: string): boolean {
  try {
    const pathname = new URL(source, baseUrl).pathname;
    return (
      pathname.startsWith("/static/icons/") &&
      pathname.toLowerCase().endsWith(".svg")
    );
  } catch {
    return false;
  }
}

export function withHash(value: string | null | undefined) {
  if (!value) return undefined;
  return value.startsWith("#") || value.startsWith("rgb") ? value : `#${value}`;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function normalizeId(value: string) {
  const normalized = value
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || "component";
}

export function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      "button,input,textarea,select,[contenteditable='true'],[role='dialog'],[data-inline-edit-ignore='true']",
    ),
  );
}
