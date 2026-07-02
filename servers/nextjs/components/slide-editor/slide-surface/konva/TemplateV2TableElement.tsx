import { Group, Line, Rect, Text } from "react-konva";
import { renderMarkdownTextRuns } from "../../lib/markdown-text";
import type { TextRun } from "../../lib/slide-schema";
import { layoutRichText } from "../../lib/template-v2-text";
import { effectiveLineHeight } from "../../lib/text-line-height";

type UnknownRecord = Record<string, any>;
type RawElement = UnknownRecord;
type RenderTextFont = {
  family: string;
  size: number;
  color: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  lineHeight: number;
  letterSpacing: number;
  wrap: string;
};

const DEFAULT_TABLE_NAME = "Default Table";
const DEFAULT_TABLE_HEADERS = ["Name", "Title", "Status", "Position"];

export function TemplateV2TableElement({
  element,
  width,
  height,
  interactive,
  selectedCell,
  onCellSelect,
  onCellEdit,
}: {
  element: RawElement;
  width: number;
  height: number;
  interactive: boolean;
  selectedCell?: { rowIndex: number; colIndex: number } | null;
  onCellSelect?: (rowIndex: number, colIndex: number) => void;
  onCellEdit?: (rowIndex: number, colIndex: number) => void;
}) {
  const rows = rawTableRows(element);
  const rowCount = Math.max(1, rows.length);
  const colCount = Math.max(1, ...rows.map((row) => row.length));
  const cellW = width / colCount;
  const cellH = height / rowCount;
  const font = rawFont(element);

  if (isDefaultTableElement(element, rows)) {
    return (
      <RawDefaultTableElement
        rows={rows}
        width={width}
        height={height}
        interactive={interactive}
        selectedCell={selectedCell}
        onCellSelect={onCellSelect}
        onCellEdit={onCellEdit}
        font={font}
      />
    );
  }

  return (
    <Group listening={interactive}>
      {rows.map((row, rowIndex) =>
        Array.from({ length: colCount }, (_, colIndex) => {
          const cell = asRecord(row[colIndex]) ?? {};
          const firstRun = asRecord(readArray(cell.runs)[0]) ?? {};
          const cellFont = fontFromRecord(
            asRecord(cell.font) ?? asRecord(firstRun.font),
            font,
          );
          const fill =
            fillColor(cell.fill ?? cell.color) ??
            (rowIndex === 0 ? "#F2F4F7" : "#FFFFFF");
          const runs = readableTableCellRuns(
            rawTableCellRuns(cell, cellFont),
            fill,
            rowIndex === 0,
          );
          const renderRuns =
            rowIndex === 0
              ? runs.map((run) => ({
                  ...run,
                  font: { ...run.font, bold: true },
                }))
              : runs;
          const text = tableCellTextContent(runs);
          const fontSize = cellFont.size;
          const textWidth = Math.max(1, cellW - 12);
          const cellLineHeight = effectiveLineHeight({
            text,
            width: textWidth,
            fontSize,
            lineHeight: cellFont.lineHeight,
            fallback: 1.15,
            wrap: cellFont.wrap,
          });
          return (
            <Group
              key={`${rowIndex}-${colIndex}`}
              x={colIndex * cellW}
              y={rowIndex * cellH}
              onClick={(event) => {
                if (!interactive) return;
                event.cancelBubble = true;
                onCellSelect?.(rowIndex, colIndex);
              }}
              onTap={(event) => {
                if (!interactive) return;
                event.cancelBubble = true;
                onCellSelect?.(rowIndex, colIndex);
              }}
              onDblClick={(event) => {
                if (!interactive) return;
                event.cancelBubble = true;
                onCellSelect?.(rowIndex, colIndex);
                onCellEdit?.(rowIndex, colIndex);
              }}
              onDblTap={(event) => {
                if (!interactive) return;
                event.cancelBubble = true;
                onCellSelect?.(rowIndex, colIndex);
                onCellEdit?.(rowIndex, colIndex);
              }}
            >
              <Rect
                width={cellW}
                height={cellH}
                fill={fill}
                stroke={strokeColor(cell.stroke) ?? "#D0D5DD"}
                strokeWidth={strokeWidth(cell.stroke) || 1}
              />
              <TableCellText
                x={6}
                y={4}
                width={textWidth}
                height={Math.max(1, cellH - 8)}
                runs={renderRuns}
                font={rowIndex === 0 ? { ...cellFont, bold: true } : cellFont}
                align={readString(cell.alignment) ?? "left"}
                verticalAlign="middle"
                lineHeight={cellLineHeight}
              />
            </Group>
          );
        }),
      )}
      <SelectedTableCellOutline
        cellH={cellH}
        cellW={cellW}
        colCount={colCount}
        rowCount={rowCount}
        selectedCell={selectedCell}
      />
    </Group>
  );
}

function RawDefaultTableElement({
  rows,
  width,
  height,
  interactive,
  selectedCell,
  onCellSelect,
  onCellEdit,
  font,
}: {
  rows: unknown[][];
  width: number;
  height: number;
  interactive: boolean;
  selectedCell?: { rowIndex: number; colIndex: number } | null;
  onCellSelect?: (rowIndex: number, colIndex: number) => void;
  onCellEdit?: (rowIndex: number, colIndex: number) => void;
  font: RenderTextFont;
}) {
  const colCount = Math.max(1, ...rows.map((row) => row.length));
  const bodyRowCount = Math.max(1, rows.length - 1);
  const headerH = clamp(height * 0.26, 46, 104);
  const bodyH = Math.max(1, height - headerH);
  const rowH = bodyH / bodyRowCount;
  const cellW = width / colCount;
  const headerPadX = clamp(width * 0.025, 18, 32);
  const bodyPadX = clamp(width * 0.018, 12, 26);
  const headerFontSize = clamp(font.size, 15, 30);
  const bodyFontSize = clamp(font.size * 0.9, 13, 24);
  const headerFill = "#F7F7FA";
  const bodyFill = "#FFFFFF";
  const lineColor = "#E8EAEE";
  const headerDivider = "#FFFFFF";

  return (
    <Group listening={interactive}>
      <Rect width={width} height={height} fill={bodyFill} />
      {Array.from({ length: colCount }, (_, colIndex) => {
        const cell = rows[0]?.[colIndex];
        const cellRecord = asRecord(cell) ?? {};
        const cellFont = fontFromRecord(asRecord(cellRecord.font), font);
        const fill = fillColor(cellRecord.color ?? cellRecord.fill) ?? headerFill;
        const runs = readableTableCellRuns(
          rawTableCellRuns(cell, cellFont),
          fill,
          true,
        );
        const text = tableCellTextContent(runs);
        const fontSize = cellFont.size || headerFontSize;
        const textWidth = Math.max(1, cellW - headerPadX * 2);
        const cellLineHeight = effectiveLineHeight({
          text,
          width: textWidth,
          fontSize,
          lineHeight: cellFont.lineHeight,
          fallback: 1.15,
          wrap: "none",
        });
        return (
          <Group
            key={`default-header-${colIndex}`}
            x={colIndex * cellW}
            onClick={(event) => {
              if (!interactive) return;
              event.cancelBubble = true;
              onCellSelect?.(0, colIndex);
            }}
            onTap={(event) => {
              if (!interactive) return;
              event.cancelBubble = true;
              onCellSelect?.(0, colIndex);
            }}
            onDblClick={(event) => {
              if (!interactive) return;
              event.cancelBubble = true;
              onCellSelect?.(0, colIndex);
              onCellEdit?.(0, colIndex);
            }}
            onDblTap={(event) => {
              if (!interactive) return;
              event.cancelBubble = true;
              onCellSelect?.(0, colIndex);
              onCellEdit?.(0, colIndex);
            }}
          >
            <Rect width={cellW} height={headerH} fill={fill} />
            <TableCellText
              x={headerPadX}
              y={0}
              width={textWidth}
              height={headerH}
              runs={runs.map((run) => ({
                ...run,
                font: { ...run.font, bold: true, size: fontSize },
              }))}
              font={{ ...cellFont, bold: true, size: fontSize }}
              align={readString(cellRecord.alignment) ?? "left"}
              verticalAlign="middle"
              lineHeight={cellLineHeight}
              wrap="none"
            />
            {colIndex > 0 ? (
              <Line
                points={[0, 0, 0, headerH]}
                stroke={headerDivider}
                strokeWidth={2}
              />
            ) : null}
          </Group>
        );
      })}
      <Line points={[0, headerH, width, headerH]} stroke={lineColor} strokeWidth={1} />
      {Array.from({ length: bodyRowCount }, (_, rowIndex) => {
        const y = headerH + rowIndex * rowH;
        return (
          <Group key={`default-body-row-${rowIndex}`} y={y}>
            {Array.from({ length: colCount }, (_, colIndex) => {
              const cell = rows[rowIndex + 1]?.[colIndex];
              const cellRecord = asRecord(cell) ?? {};
              const cellFont = fontFromRecord(asRecord(cellRecord.font), font);
              const fill = fillColor(cellRecord.color ?? cellRecord.fill);
              const runs = readableTableCellRuns(
                rawTableCellRuns(cell, cellFont),
                fill,
                false,
              );
              const text = tableCellTextContent(runs);
              const fontSize = cellFont.size || bodyFontSize;
              const textWidth = Math.max(1, cellW - bodyPadX * 2);
              const cellLineHeight = effectiveLineHeight({
                text,
                width: textWidth,
                fontSize,
                lineHeight: cellFont.lineHeight,
                fallback: 1.15,
                wrap: cellFont.wrap,
              });
              return (
                <Group
                  key={`default-body-cell-${rowIndex}-${colIndex}`}
                  x={colIndex * cellW}
                  onClick={(event) => {
                    if (!interactive) return;
                    event.cancelBubble = true;
                    onCellSelect?.(rowIndex + 1, colIndex);
                  }}
                  onTap={(event) => {
                    if (!interactive) return;
                    event.cancelBubble = true;
                    onCellSelect?.(rowIndex + 1, colIndex);
                  }}
                  onDblClick={(event) => {
                    if (!interactive) return;
                    event.cancelBubble = true;
                    onCellSelect?.(rowIndex + 1, colIndex);
                    onCellEdit?.(rowIndex + 1, colIndex);
                  }}
                  onDblTap={(event) => {
                    if (!interactive) return;
                    event.cancelBubble = true;
                    onCellSelect?.(rowIndex + 1, colIndex);
                    onCellEdit?.(rowIndex + 1, colIndex);
                  }}
                >
                  <Rect
                    width={cellW}
                    height={rowH}
                    fill={fill ?? "rgba(0,0,0,0.01)"}
                  />
                  {text ? (
                    <TableCellText
                      x={bodyPadX}
                      y={0}
                      width={textWidth}
                      height={rowH}
                      runs={runs.map((run) => ({
                        ...run,
                        font: { ...run.font, size: fontSize },
                      }))}
                      font={{ ...cellFont, size: fontSize }}
                      align={readString(cellRecord.alignment) ?? "left"}
                      verticalAlign="middle"
                      lineHeight={cellLineHeight}
                    />
                  ) : null}
                </Group>
              );
            })}
            {rowIndex < bodyRowCount - 1 ? (
              <Line points={[0, rowH, width, rowH]} stroke={lineColor} strokeWidth={1} />
            ) : null}
          </Group>
        );
      })}
      <SelectedTableCellOutline
        colCount={colCount}
        headerH={headerH}
        rowH={rowH}
        selectedCell={selectedCell}
        totalRows={rows.length}
        width={width}
      />
    </Group>
  );
}

function TableCellText({
  x,
  y,
  width,
  height,
  runs,
  font,
  align,
  verticalAlign,
  lineHeight,
  wrap,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  runs: Array<{ text: string; font: RenderTextFont }>;
  font: RenderTextFont;
  align: string;
  verticalAlign: string;
  lineHeight: number;
  wrap?: string;
}) {
  const baseFont = { ...font, lineHeight };
  const renderRuns = runs.map((run) => ({
    ...run,
    font: {
      ...run.font,
      lineHeight: run.font.lineHeight || lineHeight,
    },
  }));
  const { tokens } = layoutRichText(
    renderRuns,
    width,
    baseFont,
    align,
    verticalAlign,
    height,
    wrap ?? font.wrap,
  );

  return (
    <Group x={x} y={y} listening={false}>
      {tokens.map((token, index) => (
        <Text
          key={index}
          x={token.x}
          y={token.y}
          width={token.width}
          height={token.height}
          text={token.text}
          fill={withHash(token.font.color)}
          fontFamily={`${token.font.family}, Helvetica, sans-serif`}
          fontSize={token.font.size}
          fontStyle={`${token.font.bold ? "bold" : "normal"} ${
            token.font.italic ? "italic" : ""
          }`}
          textDecoration={token.font.underline ? "underline" : ""}
          lineHeight={token.font.lineHeight}
          letterSpacing={token.font.letterSpacing}
          wrap="none"
          listening={false}
        />
      ))}
    </Group>
  );
}

function SelectedTableCellOutline({
  cellH,
  cellW,
  colCount,
  headerH,
  rowCount,
  rowH,
  selectedCell,
  totalRows,
  width,
}: {
  cellH?: number;
  cellW?: number;
  colCount: number;
  headerH?: number;
  rowCount?: number;
  rowH?: number;
  selectedCell?: { rowIndex: number; colIndex: number } | null;
  totalRows?: number;
  width?: number;
}) {
  if (!selectedCell) return null;
  if (selectedCell.colIndex < 0 || selectedCell.colIndex >= colCount) return null;

  if (headerH != null && rowH != null && width != null && totalRows != null) {
    if (selectedCell.rowIndex < 0 || selectedCell.rowIndex >= totalRows) return null;
    const defaultCellW = width / colCount;
    const selectedY =
      selectedCell.rowIndex === 0
        ? 0
        : headerH + (selectedCell.rowIndex - 1) * rowH;
    return (
      <Rect
        x={selectedCell.colIndex * defaultCellW}
        y={selectedY}
        width={defaultCellW}
        height={selectedCell.rowIndex === 0 ? headerH : rowH}
        fill="rgba(0,0,0,0)"
        stroke="#7C51F8"
        strokeWidth={2}
        listening={false}
      />
    );
  }

  if (cellW == null || cellH == null || rowCount == null) return null;
  if (selectedCell.rowIndex < 0 || selectedCell.rowIndex >= rowCount) return null;

  return (
    <Rect
      x={selectedCell.colIndex * cellW}
      y={selectedCell.rowIndex * cellH}
      width={cellW}
      height={cellH}
      fill="rgba(0,0,0,0)"
      stroke="#7C51F8"
      strokeWidth={2}
      listening={false}
    />
  );
}

function isDefaultTableElement(element: RawElement, rows: unknown[][]) {
  const headers = rows[0]?.map(rawTableCellText) ?? [];
  const hasDefaultName = readString(element.name) === DEFAULT_TABLE_NAME;
  const hasDefaultHeaders =
    headers.length === DEFAULT_TABLE_HEADERS.length &&
    DEFAULT_TABLE_HEADERS.every((header, index) => headers[index] === header);

  return hasDefaultName || hasDefaultHeaders;
}

function rawTableRows(element: RawElement) {
  const columns = readArray(element.columns);
  const rows = readArray(element.rows);
  return [columns, ...rows].filter((row) => Array.isArray(row)) as unknown[][];
}

function rawTableCellText(cell: unknown) {
  return tableCellTextContent(rawTableCellRuns(cell, rawFont({})));
}

function rawTableCellRuns(cell: unknown, fallbackFont: RenderTextFont) {
  const sourceRuns = rawTableCellSourceRuns(cell, fallbackFont);
  return renderMarkdownTextRuns(sourceRuns).map((run) => ({
    text: run.text,
    font: fontFromRecord(asRecord(run.font), fallbackFont),
  }));
}

function rawTableCellSourceRuns(
  cell: unknown,
  fallbackFont: RenderTextFont,
): TextRun[] {
  if (typeof cell === "string" || typeof cell === "number") {
    return [{ text: String(cell), font: fontToTextRunFont(fallbackFont) }];
  }
  const record = asRecord(cell);
  if (!record) return [{ text: "", font: fontToTextRunFont(fallbackFont) }];
  const cellFont = fontFromRecord(asRecord(record.font), fallbackFont);
  const runs = readArray(record.runs);
  if (runs.length > 0) {
    return runs
      .map((run) => {
        const runRecord = asRecord(run) ?? {};
        return {
          text: readString(runRecord.text) ?? "",
          font: fontToTextRunFont(
            fontFromRecord(asRecord(runRecord.font), cellFont),
          ),
        };
      })
      .filter((run) => run.text.length > 0);
  }
  const textRecord = asRecord(record.text);
  return [
    {
      text: readString(textRecord?.text) ?? readString(record.text) ?? "",
      font: fontToTextRunFont(cellFont),
    },
  ];
}

function fontToTextRunFont(font: RenderTextFont): TextRun["font"] {
  return {
    family: font.family,
    size: font.size,
    color: font.color,
    bold: font.bold,
    italic: font.italic,
    underline: font.underline,
    line_height: font.lineHeight,
    letter_spacing: font.letterSpacing,
    wrap: readFontWrap(font.wrap),
  };
}

function tableCellTextContent(runs: Array<{ text: string }>) {
  return runs.map((run) => run.text).join("");
}

function readableTableCellRuns(
  runs: Array<{ text: string; font: RenderTextFont }>,
  fill: string | undefined,
  isHeader: boolean,
) {
  if (isHeader) return runs;
  return runs.map((run) => ({
    ...run,
    font: {
      ...run.font,
      color: readableTableTextColor(run.font.color, fill),
    },
  }));
}

function rawFont(element: RawElement) {
  const font = asRecord(element.font) ?? {};
  return fontFromRecord(font, {
    family: "Arial",
    size: 18,
    color: "#111827",
    bold: false,
    italic: false,
    underline: false,
    lineHeight: 1.15,
    letterSpacing: 0,
    wrap: "word",
  });
}

function fontFromRecord(
  font: UnknownRecord | null,
  fallback: RenderTextFont,
): RenderTextFont {
  return {
    family: readString(font?.family) ?? fallback.family,
    size: readNumber(font?.size) ?? fallback.size,
    color: readString(font?.color) ?? fallback.color,
    bold: readBoolean(font?.bold) ?? fallback.bold,
    italic: readBoolean(font?.italic) ?? fallback.italic,
    underline:
      readBoolean(font?.underline) ??
      (readString(font?.text_decoration) === "underline" ||
        readString(font?.textDecoration) === "underline"
        ? true
        : fallback.underline),
    lineHeight:
      readNumber(font?.line_height) ??
      readNumber(font?.lineHeight) ??
      fallback.lineHeight,
    letterSpacing:
      readNumber(font?.letter_spacing) ??
      readNumber(font?.letterSpacing) ??
      fallback.letterSpacing,
    wrap: readString(font?.wrap) ?? fallback.wrap,
  };
}

function fillColor(fill: unknown) {
  const value = asRecord(fill);
  return withHash(readString(value?.color));
}

function strokeColor(stroke: unknown) {
  const value = asRecord(stroke);
  return withHash(readString(value?.color));
}

function strokeWidth(stroke: unknown) {
  const value = asRecord(stroke);
  return readNumber(value?.width) ?? 0;
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function readFontWrap(value: unknown) {
  return value === "word" || value === "char" || value === "none"
    ? value
    : undefined;
}

function withHash(value: string | null | undefined) {
  if (!value) return undefined;
  return value.startsWith("#") || value.startsWith("rgb") ? value : `#${value}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function readableTableTextColor(color: string, fill: string | undefined) {
  const textColor = withHash(color) ?? color;
  const textLuminance = colorLuminance(textColor);
  const fillLuminance = colorLuminance(fill);
  if (textLuminance == null || fillLuminance == null) return textColor;

  const contrast = contrastRatio(textLuminance, fillLuminance);
  if (contrast >= 3) return textColor;
  return fillLuminance > 0.5 ? "#111827" : "#FFFFFF";
}

function contrastRatio(left: number, right: number) {
  const lighter = Math.max(left, right);
  const darker = Math.min(left, right);
  return (lighter + 0.05) / (darker + 0.05);
}

function colorLuminance(color: string | undefined) {
  const rgb = parseColor(color);
  if (!rgb) return null;
  const [r, g, b] = rgb.map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : Math.pow((normalized + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function parseColor(color: string | undefined): [number, number, number] | null {
  if (!color) return null;
  const value = color.trim();
  const hex = value.startsWith("#") ? value.slice(1) : value;
  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    return [
      parseInt(hex[0] + hex[0], 16),
      parseInt(hex[1] + hex[1], 16),
      parseInt(hex[2] + hex[2], 16),
    ];
  }
  if (/^[0-9a-fA-F]{6}$/.test(hex)) {
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
    ];
  }

  const rgb = value.match(
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i,
  );
  if (!rgb) return null;
  return [
    clamp(Number(rgb[1]), 0, 255),
    clamp(Number(rgb[2]), 0, 255),
    clamp(Number(rgb[3]), 0, 255),
  ];
}
