import type { CSSProperties } from "react";
import { PT_TO_PX, PX_PER_IN, withHash } from "../../../editorUtils";
import { elementBox, elementFont } from "../../../lib/element-model";
import { rootPath, type ElementPath } from "../../../lib/element-path";
import type { ResolvedLayoutItem } from "../../../lib/layout-resolver";
import { renderMarkdownTextRuns } from "../../../lib/markdown-text";
import { fitFontToBox } from "../../../lib/textMeasure";
import type { Font, TableCell, TextRun } from "../../../lib/slide-schema";
import type { TableCellSelection } from "../../../state";
import { DomElementLayer, elementBoxStyle } from "../shared";

const TABLE_MIN_FONT_SIZE_PT = 5.5;
const TABLE_MAX_FONT_SIZE_PT = 14;
const TABLE_CELL_PADDING_X_IN = 0.08;
const TABLE_CELL_PADDING_Y_IN = 0.04;

export function TableDomElement({
  editingTableIndex,
  editingTablePath,
  items,
  scale,
  selectedCell,
}: {
  editingTableIndex?: number | null;
  editingTablePath?: ElementPath | null;
  items: ResolvedLayoutItem[];
  scale: number;
  selectedCell?: TableCellSelection | null;
}) {
  const editingPath =
    editingTablePath ??
    (editingTableIndex != null ? rootPath(editingTableIndex) : null);

  return (
    <DomElementLayer>
      {items.map((item) => {
        const element = item.element;
        if (element.type !== "table" || item.sourcePath === editingPath) {
          return null;
        }

        const rows = [element.columns, ...element.rows];
        const cols = Math.max(1, ...rows.map((row) => row.length));
        const font = elementFont(element);
        const box = elementBox(element);
        const rowHeightIn = box.h / Math.max(1, rows.length);
        const colWidthIn = box.w / cols;
        const tableStroke = element.columns[0]?.stroke ?? element.rows[0]?.[0]?.stroke;
        const borderColor = colorWithOpacity(
          tableStroke?.color ?? "D9E2EF",
          tableStroke?.opacity,
        );

        return (
          <table
            key={item.path}
            style={{
              ...elementBoxStyle(element, scale),
              ...tableStyle,
              borderColor,
              borderWidth: tableStroke?.width ?? 1,
              color: withHash(font.color),
              fontFamily: `${font.family}, Helvetica, sans-serif`,
              fontSize: font.size * PT_TO_PX * (scale / PX_PER_IN),
            }}
          >
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {Array.from({ length: cols }).map((_, colIndex) => {
                    const isHeader = rowIndex === 0;
                    const selectedCellPath =
                      selectedCell?.elementPath ??
                      (selectedCell
                        ? rootPath(selectedCell.elementIndex)
                        : null);
                    const isSelected =
                      selectedCell != null &&
                      selectedCellPath === item.sourcePath &&
                      selectedCell.rowIndex === rowIndex &&
                      selectedCell.colIndex === colIndex;
                    const cell = row[colIndex] ?? {};
                    const textAlign = colIndex === 0 ? "left" : "center";
                    const baseFont = tableCellFont(cell, font, isHeader);
                    const renderedRuns = renderMarkdownTextRuns([
                      {
                        text: cell.text ?? "",
                        font: baseFont,
                      },
                    ]);
                    const renderedText = renderedRuns
                      .map((run) => run.text)
                      .join("");
                    const effectiveFontSize = fitTableFontToCell({
                      font: baseFont,
                      text: renderedText,
                      widthIn: colWidthIn,
                      heightIn: rowHeightIn,
                    });
                    const cellBorderColor = colorWithOpacity(
                      cell.stroke?.color ?? borderColor,
                      cell.stroke?.opacity,
                    );
                    return (
                      <td
                        key={colIndex}
                        style={{
                          ...cellStyle,
                          width: `${100 / cols}%`,
                          height: `${100 / rows.length}%`,
                          borderColor: cellBorderColor,
                          borderWidth: cell.stroke?.width ?? 1,
                          background: colorWithOpacity(
                            cell.fill?.color ??
                              (isHeader ? "0B1F3A" : "FFFFFF"),
                            cell.fill?.opacity,
                          ),
                          color: withHash(baseFont.color ?? font.color),
                          fontFamily: `${baseFont.family ?? font.family}, Helvetica, sans-serif`,
                          fontSize:
                            effectiveFontSize * PT_TO_PX * (scale / PX_PER_IN),
                          fontStyle: baseFont.italic ? "italic" : "normal",
                          fontWeight: baseFont.bold ? 700 : 400,
                          lineHeight: baseFont.lineHeight ?? 1.12,
                          padding: 0,
                          textAlign,
                          boxShadow: isSelected
                            ? "inset 0 0 0 2px #6f93ff"
                            : undefined,
                        }}
                      >
                        <div
                          style={{
                            ...cellContentStyle,
                            alignItems: "center",
                            justifyContent:
                              textAlign === "center" ? "center" : "flex-start",
                            padding: `${TABLE_CELL_PADDING_Y_IN * scale}px ${
                              TABLE_CELL_PADDING_X_IN * scale
                            }px`,
                            textAlign,
                          }}
                        >
                          <span style={cellTextStyle}>
                            <TableRichTextRuns
                              baseFont={baseFont}
                              effectiveFontSize={effectiveFontSize}
                              runs={renderedRuns}
                              scale={scale}
                            />
                          </span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        );
      })}
    </DomElementLayer>
  );
}

const tableStyle: CSSProperties = {
  tableLayout: "fixed",
  borderCollapse: "collapse",
  borderWidth: 1,
  borderStyle: "solid",
  overflow: "hidden",
};

const cellStyle: CSSProperties = {
  boxSizing: "border-box",
  borderWidth: 1,
  borderStyle: "solid",
  lineHeight: 1.12,
  verticalAlign: "middle",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "normal",
  wordBreak: "break-word",
};

const cellContentStyle: CSSProperties = {
  boxSizing: "border-box",
  display: "flex",
  height: "100%",
  minHeight: 0,
  overflow: "hidden",
  width: "100%",
};

const cellTextStyle: CSSProperties = {
  display: "block",
  maxHeight: "100%",
  overflow: "hidden",
};

function tableCellFont(
  cell: TableCell,
  tableFont: ReturnType<typeof elementFont>,
  isHeader: boolean,
): Font {
  const cellFont = cell.font ?? {};
  return {
    family: cellFont.family ?? tableFont.family,
    size: cellFont.size ?? tableFont.size,
    color: cellFont.color ?? tableFont.color,
    bold: cellFont.bold ?? tableFont.bold ?? isHeader,
    italic: cellFont.italic ?? tableFont.italic,
    lineHeight: cellFont.lineHeight ?? tableFont.lineHeight ?? 1.12,
    letterSpacing: cellFont.letterSpacing ?? tableFont.letterSpacing,
    wrap: cellFont.wrap ?? tableFont.wrap ?? "word",
    ellipsis: cellFont.ellipsis ?? tableFont.ellipsis,
  };
}

function fitTableFontToCell({
  font,
  heightIn,
  text,
  widthIn,
}: {
  font: Font;
  heightIn: number;
  text: string;
  widthIn: number;
}) {
  const authoredSize = clampNumber(
    font.size ?? TABLE_MAX_FONT_SIZE_PT,
    TABLE_MIN_FONT_SIZE_PT,
    TABLE_MAX_FONT_SIZE_PT,
  );
  const innerHeight = Math.max(0.05, heightIn - TABLE_CELL_PADDING_Y_IN * 2);
  const innerWidth = Math.max(0.1, widthIn - TABLE_CELL_PADDING_X_IN * 2);
  const rowHeightCap = Math.max(
    TABLE_MIN_FONT_SIZE_PT,
    Math.min(
      TABLE_MAX_FONT_SIZE_PT,
      (innerHeight * 72 * 0.78) / (font.lineHeight ?? 1.12),
    ),
  );

  return Math.min(
    rowHeightCap,
    fitFontToBox(
      {
        text: text || " ",
        fontFace: font.family,
        fontSize: authoredSize,
        bold: font.bold,
        italic: font.italic,
        lineHeight: font.lineHeight,
        charSpacing: font.letterSpacing,
        wrap: font.wrap,
        w: innerWidth,
      },
      innerHeight,
    ),
  );
}

function TableRichTextRuns({
  baseFont,
  effectiveFontSize,
  runs,
  scale,
}: {
  baseFont: Font;
  effectiveFontSize: number;
  runs: TextRun[];
  scale: number;
}) {
  const fontScale =
    baseFont.size && baseFont.size > 0 ? effectiveFontSize / baseFont.size : 1;

  return (
    <>
      {runs.map((run, index) => {
        const runFont = run.font ?? {};
        return (
          <span
            key={`${index}-${run.text}`}
            style={{
              color: withHash(runFont.color ?? baseFont.color ?? "1A2B45"),
              fontFamily: `${runFont.family ?? baseFont.family ?? "Arial"}, Helvetica, sans-serif`,
              fontSize:
                (runFont.size != null
                  ? runFont.size * fontScale
                  : effectiveFontSize) *
                PT_TO_PX *
                (scale / PX_PER_IN),
              fontStyle: runFont.italic ? "italic" : undefined,
              fontWeight: runFont.bold ? 700 : undefined,
            }}
          >
            {run.text}
          </span>
        );
      })}
    </>
  );
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function colorWithOpacity(color: string, opacity?: number | null) {
  const clampedOpacity = Math.max(0, Math.min(opacity ?? 1, 1));
  if (clampedOpacity >= 1) return withHash(color);

  const normalized = color.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return `rgba(0, 0, 0, ${clampedOpacity})`;
  }

  const value = Number.parseInt(normalized, 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  return `rgba(${red}, ${green}, ${blue}, ${clampedOpacity})`;
}
