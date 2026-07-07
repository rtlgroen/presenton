import { useState, type CSSProperties } from "react";
import { BarChart3, Palette } from "lucide-react";
import type { ChartSlideElement } from "@/components/slide-editor/state/state";
import {
  resolvedChartColorTargets,
  updateChartColorTarget,
} from "@/components/slide-editor/charts/chart-data";
import { ChartColorPaletteCard } from "@/components/slide-editor/charts/ChartColorPalette";
import {
  FloatingToolbar,
  FloatingToolbarPanel,
  type FloatingToolbarBox,
} from "@/components/slide-editor/toolbar/FloatingToolbar";
import { inlineStyles } from "@/components/slide-editor/toolbar/inlineStyles";

const DEFAULT_CHART_TOOLBAR_SIZE = { width: 2.5, height: 2.5 };

export function ChartToolbar({
  anchorBox,
  element,
  index,
  scale,
  onChange,
}: {
  anchorBox?: FloatingToolbarBox | null;
  element: ChartSlideElement;
  index: number;
  scale: number;
  onChange: (index: number, element: ChartSlideElement) => void;
}) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [activeColorIndex, setActiveColorIndex] = useState(0);
  const colorTargets = resolvedChartColorTargets(element);
  const activeTarget =
    colorTargets.find((target) => target.index === activeColorIndex) ??
    colorTargets[0];

  return (
    <FloatingToolbar
      anchorBox={
        anchorBox ?? {
          x: (element.position?.x ?? 0) * scale,
          y: (element.position?.y ?? 0) * scale,
          width: (element.size?.width ?? DEFAULT_CHART_TOOLBAR_SIZE.width) * scale,
          height:
            (element.size?.height ?? DEFAULT_CHART_TOOLBAR_SIZE.height) * scale,
        }
      }
      fallbackWidth={220}
      inlineEditIgnore
      style={inlineStyles.toolbar}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          paddingRight: 8,
          borderRight: "1px solid #E6E6EA",
        }}
      >
        <BarChart3 size={16} strokeWidth={2} />
        <select
          aria-label="Chart type"
          title="Chart type"
          value={element.chart_type}
          onChange={(event) =>
            onChange(index, {
              ...element,
              chart_type: event.target.value as ChartSlideElement["chart_type"],
            })
          }
          style={{
            ...inlineStyles.select,
            minWidth: 126,
            border: "none",
            paddingLeft: 0,
          }}
        >
          <option value="bar">Bar Chart</option>
          <option value="horizontal_bar">Horizontal Bar</option>
          <option value="stacked_bar">Stacked Bar</option>
          <option value="horizontal_stacked_bar">Horizontal Stack Bar</option>
          <option value="line">Line Chart</option>
          <option value="area">Area Chart</option>
          <option value="pie">Pie Chart</option>
          <option value="donut">Donut Chart</option>
          <option value="scatter">Scatter Chart</option>
          <option value="bubble">Bubble Chart</option>
          <option value="radar">Radar Chart</option>
          <option value="polar_area">Polar Area</option>
        </select>
      </div>

      <div style={{ position: "relative" }}>
        <button
          type="button"
          title="Chart colors"
          onClick={() => setPaletteOpen((current) => !current)}
          style={{
            ...inlineStyles.iconButton,
            ...(paletteOpen ? inlineStyles.iconButtonActive : {}),
          }}
        >
          <Palette size={16} strokeWidth={2} />
        </button>
        {paletteOpen && activeTarget ? (
          <FloatingToolbarPanel>
            <ChartColorPaletteCard
              value={activeTarget.color}
              header={
                colorTargets.length > 1 ? (
                  <div style={toolbarPaletteStyles.targetList}>
                    {colorTargets.map((target) => (
                      <button
                        key={`${target.mode}-${target.index}`}
                        type="button"
                        title={target.label}
                        style={{
                          ...toolbarPaletteStyles.targetButton,
                          ...(target.index === activeTarget.index
                            ? toolbarPaletteStyles.targetButtonActive
                            : {}),
                        }}
                        onClick={() => setActiveColorIndex(target.index)}
                      >
                        <span
                          style={{
                            ...toolbarPaletteStyles.targetDot,
                            background: `#${target.color}`,
                          }}
                        />
                        <span style={toolbarPaletteStyles.targetLabel}>
                          {target.label}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null
              }
              onChange={(color) =>
                onChange(
                  index,
                  updateChartColorTarget(element, activeTarget.index, color),
                )
              }
              onClose={() => setPaletteOpen(false)}
            />
          </FloatingToolbarPanel>
        ) : null}
      </div>
    </FloatingToolbar>
  );
}

const toolbarPaletteStyles = {
  targetButton: {
    alignItems: "center",
    background: "#FFFFFF",
    border: "1px solid #E6E6EA",
    borderRadius: 999,
    color: "#191919",
    cursor: "pointer",
    display: "inline-flex",
    flex: "0 0 auto",
    fontSize: 11,
    fontWeight: 700,
    gap: 6,
    height: 28,
    maxWidth: 132,
    padding: "0 9px",
  },
  targetButtonActive: {
    background: "#F4F3FF",
    borderColor: "#7C51F8",
    color: "#7C51F8",
  },
  targetDot: {
    border: "1px solid #E6E6EA",
    borderRadius: 999,
    flex: "0 0 auto",
    height: 12,
    width: 12,
  },
  targetLabel: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  targetList: {
    display: "flex",
    gap: 6,
    maxWidth: 212,
    overflowX: "auto",
  },
} satisfies Record<string, CSSProperties>;
