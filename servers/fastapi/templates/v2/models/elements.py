"""Pydantic models matching the frontend slide element types."""

from __future__ import annotations

import math
from enum import Enum
from typing import Annotated, Any, Literal, Optional, TypeAlias, Union, List

from pydantic import BaseModel, BeforeValidator, Field, field_validator, model_validator


def _validate_min_max(
    min_value: int | None,
    max_value: int | None,
    *,
    min_name: str,
    max_name: str,
) -> None:
    if min_value is None or max_value is None:
        return

    expected_min = (max_value + 1) // 2
    if min_value != expected_min:
        raise ValueError(
            f"{min_name} must equal half of {max_name}, rounded up ({expected_min})"
        )


class HorizontalAlignment(str, Enum):
    LEFT = "left"
    CENTER = "center"
    RIGHT = "right"


class VerticalAlignment(str, Enum):
    TOP = "top"
    MIDDLE = "middle"
    BOTTOM = "bottom"


class LayoutAlignment(str, Enum):
    FLEX_START = "flex-start"
    FLEX_END = "flex-end"
    CENTER = "center"
    STRETCH = "stretch"


class Marker(str, Enum):
    BULLET = "bullet"
    NUMBER = "number"
    NONE = "none"


class FlexDirection(str, Enum):
    ROW = "row"
    COLUMN = "column"


class ImageFit(str, Enum):
    CONTAIN = "contain"
    COVER = "cover"
    FILL = "fill"


class IconType(str, Enum):
    BOLD = "bold"
    DUOTONE = "duotone"
    FILL = "fill"
    LIGHT = "light"
    REGULAR = "regular"
    THIN = "thin"


class ChartType(str, Enum):
    BAR = "bar"
    HORIZONTAL_BAR = "horizontal_bar"
    LINE = "line"
    AREA = "area"
    PIE = "pie"
    DONUT = "donut"
    STACKED_BAR = "stacked_bar"
    HORIZONTAL_STACKED_BAR = "horizontal_stacked_bar"
    SCATTER = "scatter"
    RADAR = "radar"
    POLAR_AREA = "polar_area"


class DataLabelPosition(str, Enum):
    BASE = "base"
    MID = "mid"
    TOP = "top"
    OUTSIDE = "outside"


class Position(BaseModel):
    x: float
    y: float


class Size(BaseModel):
    width: float
    height: float


class Padding(BaseModel):
    top: float
    right: float
    bottom: float
    left: float


class Alignment(BaseModel):
    horizontal: Optional[HorizontalAlignment] = None
    vertical: Optional[VerticalAlignment] = None


class Font(BaseModel):
    size: Optional[float] = None
    family: Optional[str] = None
    color: Optional[str] = None
    bold: Optional[bool] = None
    italic: Optional[bool] = None
    line_height: Optional[float] = None
    letter_spacing: Optional[float] = None
    ellipsis: Optional[bool] = None
    opacity: Optional[float] = None


class Fill(BaseModel):
    color: str
    opacity: Optional[float] = None


class Stroke(BaseModel):
    color: str
    opacity: Optional[float] = None
    width: float
    dash: Optional[list[float]] = None


class BorderRadius(BaseModel):
    tl: float
    tr: float
    bl: float
    br: float


class Shadow(BaseModel):
    color: str
    blur: Optional[float] = None
    opacity: Optional[float] = None
    offset_x: Optional[float] = None
    offset_y: Optional[float] = None


class ChartSeries(BaseModel):
    name: str
    values: list[float]


class TextRun(BaseModel):
    text: str
    font: Optional[Font] = None


class Text(BaseModel):  # Konva Text
    type: Literal["text"]
    position: Optional[Position] = None
    size: Optional[Size] = None
    rotation: Optional[float] = None
    font: Optional[Font] = None
    alignment: Optional[Alignment] = None
    fill: Optional[Fill] = None
    stroke: Optional[Stroke] = None
    shadow: Optional[Shadow] = None
    runs: list[TextRun]

    # Schema
    decorative: bool
    name: str
    max_length: int
    min_length: int


class Container(BaseModel):  # Konva Group
    type: Literal["container"]
    position: Optional[Position] = None
    size: Optional[Size] = None
    rotation: Optional[float] = None
    alignment: Optional[Alignment] = None
    fill: Optional[Fill] = None
    stroke: Optional[Stroke] = None
    border_radius: Optional[BorderRadius] = None
    shadow: Optional[Shadow] = None
    padding: Optional[Padding] = None
    child: Optional[SlideElement] = None


class Image(BaseModel):  # Konva Image
    type: Literal["image"]
    position: Optional[Position] = None
    size: Optional[Size] = None
    rotation: Optional[float] = None
    flip_h: Optional[bool] = None
    flip_v: Optional[bool] = None
    opacity: Optional[float] = None
    data: str
    fit: Optional[ImageFit] = None
    focus_x: Optional[float] = None
    focus_y: Optional[float] = None
    crop_scale: Optional[float] = None
    border_radius: Optional[BorderRadius] = None
    clip_path: Optional[str] = None
    color: Optional[str] = None

    # Schema
    decorative: bool
    name: str
    prompt: Optional[str] = None
    is_icon: bool
    icon_type: Optional[IconType] = None


class TextList(BaseModel):  # Konva Group
    type: Literal["text-list"]
    position: Optional[Position] = None
    size: Optional[Size] = None
    rotation: Optional[float] = None
    font: Optional[Font] = None
    marker: Optional[Marker] = None
    items: list[list[TextRun]]

    # Schema
    decorative: bool
    name: str
    max_items: int
    min_items: int
    max_item_length: int
    min_item_length: int


class TableCell(BaseModel):
    color: Optional[Fill] = None
    font: Optional[Font] = None
    alignment: Optional[HorizontalAlignment] = None
    runs: List[TextRun]


class Table(BaseModel):
    type: Literal["table"]
    position: Optional[Position] = None
    size: Optional[Size] = None
    rotation: Optional[float] = None
    columns: list[TableCell]
    rows: list[list[TableCell]]

    # Schema
    decorative: bool
    name: str
    max_columns: int
    min_columns: int
    max_rows: int
    min_rows: int


class VectorShapeCurve(BaseModel):
    type: Literal["smooth", "bezier"]
    tension: Optional[float] = Field(default=None, ge=0, le=1)
    segments: Optional[int] = Field(default=16, ge=1, le=96)
    control_points: Optional[list[Position]] = None

    @field_validator("type", mode="before")
    @classmethod
    def _normalize_curve_type(cls, value: object) -> object:
        if isinstance(value, str) and value.strip().lower() == "beizer":
            return "bezier"
        return value


class VectorShape(BaseModel):
    type: Literal["vector_shape"]
    points: list[Position] = Field(min_length=2)
    closed: Optional[bool] = None
    curve: Optional[VectorShapeCurve] = None
    corner_radii: Optional[list[Annotated[float, Field(ge=0)]]] = None
    rotation: Optional[float] = None
    opacity: Optional[float] = None
    fill: Optional[Fill] = None
    stroke: Optional[Stroke] = None
    shadow: Optional[Shadow] = None


class Chart(BaseModel):
    type: Literal["chart"]
    position: Optional[Position] = None
    size: Optional[Size] = None
    rotation: Optional[float] = None
    chart_type: ChartType
    title: Optional[str] = None
    title_color: Optional[str] = None

    # PPTX chart model emitted by the template-v2 converter.
    colors: Optional[list[str]] = None
    x_axis: Optional[bool] = None
    y_axis: Optional[bool] = None
    x_axis_title: Optional[str] = None
    y_axis_title: Optional[str] = None
    axis_color: Optional[str] = None
    categories: Optional[list[str]] = None
    series: Optional[list[ChartSeries]] = None
    data_labels: Optional[DataLabelPosition] = None
    legend: Optional[bool] = None
    x_axis_grid: Optional[bool] = None
    y_axis_grid: Optional[bool] = None
    grid_color: Optional[str] = None
    source: Optional[str] = None

    # Schema
    decorative: bool
    name: str

    @model_validator(mode="after")
    def _pie_and_donut_use_only_first_series(self) -> "Chart":
        if (
            self.chart_type in {ChartType.PIE, ChartType.DONUT}
            and self.series
            and len(self.series) > 1
        ):
            self.series = self.series[:1]
        return self

    @field_validator("data_labels", mode="before")
    @classmethod
    def _coerce_legacy_data_labels(cls, value: object) -> object:
        if value is True:
            return DataLabelPosition.TOP
        if value is False or value is None:
            return None
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {position.value for position in DataLabelPosition}:
                return normalized
        return value

    @model_validator(mode="after")
    def _size_must_be_visible_when_explicit(self) -> "Chart":
        if self.size is None:
            return self
        if self.size.width < 80 or self.size.height < 60:
            raise ValueError("chart size must be at least 80x60 px")
        return self


class InfographicType(str, Enum):
    PROGRESS_BAR = "progress_bar"
    GAUGE = "gauge"


class Infographic(BaseModel):
    type: Literal["infographic"]
    position: Optional[Position] = None
    size: Optional[Size] = None
    rotation: Optional[float] = None
    infographic_type: InfographicType
    max_value: float
    min_value: float
    value: float

    # Design
    base_color: Optional[str] = None
    highlight_color: Optional[str] = None

    # Schema
    decorative: bool
    name: str


class Flex(BaseModel):
    type: Literal["flex"]
    position: Optional[Position] = None
    size: Optional[Size] = None
    rotation: Optional[float] = None
    direction: FlexDirection
    wrap: Optional[bool] = None
    align_items: Optional[LayoutAlignment] = None
    justify_content: Optional[LayoutAlignment] = None
    gap: Optional[float] = None
    column_gap: Optional[float] = None
    row_gap: Optional[float] = None
    children: list[SlideElement]

    # Schema
    name: str
    max_children: int
    min_children: int


class Grid(BaseModel):
    type: Literal["grid"]
    position: Optional[Position] = None
    size: Optional[Size] = None
    rotation: Optional[float] = None
    columns: int
    rows: Optional[int] = None
    gap: Optional[float] = None
    column_gap: Optional[float] = None
    row_gap: Optional[float] = None
    align_items: Optional[LayoutAlignment] = None
    justify_items: Optional[LayoutAlignment] = None
    children: list[SlideElement]

    # Schema
    name: str
    max_children: int
    min_children: int


class Group(BaseModel):
    type: Literal["group"]
    position: Optional[Position] = None
    size: Optional[Size] = None
    children: list[SlideElement]

    # Schema
    name: str


def _legacy_number(value: Any, fallback: float = 0.0) -> float:
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value)
        except ValueError:
            return fallback
    return fallback


def _ellipse_points(
    x: float,
    y: float,
    width: float,
    height: float,
    segments: int = 48,
) -> list[dict[str, float]]:
    radius_x = width / 2
    radius_y = height / 2
    center_x = x + radius_x
    center_y = y + radius_y
    return [
        {
            "x": center_x + radius_x * math.cos((math.tau * index) / segments),
            "y": center_y + radius_y * math.sin((math.tau * index) / segments),
        }
        for index in range(segments)
    ]


def _legacy_corner_radii(value: Any) -> list[float] | None:
    if isinstance(value, (int, float, str)):
        radius = _legacy_number(value)
        return [radius, radius, radius, radius] if radius > 0 else None
    if not isinstance(value, dict):
        return None
    top_left = _legacy_number(value.get("tl", value.get("topLeft")))
    top_right = _legacy_number(value.get("tr", value.get("topRight")), top_left)
    bottom_right = _legacy_number(value.get("br", value.get("bottomRight")), top_right)
    bottom_left = _legacy_number(value.get("bl", value.get("bottomLeft")), bottom_right)
    radii = [top_left, top_right, bottom_right, bottom_left]
    return radii if any(radius > 0 for radius in radii) else None


def _legacy_geometry_to_vector_shape(value: Any) -> Any:
    if not isinstance(value, dict):
        return value

    element_type = value.get("type")
    if element_type == "vector_shape":
        return value
    if element_type not in {"line", "rectangle", "ellipse"}:
        return value

    position = value.get("position") if isinstance(value.get("position"), dict) else {}
    size = value.get("size") if isinstance(value.get("size"), dict) else {}
    x = _legacy_number(position.get("x") if isinstance(position, dict) else None)
    y = _legacy_number(position.get("y") if isinstance(position, dict) else None)
    width = _legacy_number(size.get("width") if isinstance(size, dict) else None)
    height = _legacy_number(size.get("height") if isinstance(size, dict) else None)

    vector_shape = {
        key: item
        for key, item in value.items()
        if key not in {"type", "position", "size", "border_radius"}
    }
    vector_shape["type"] = "vector_shape"
    if element_type == "line":
        vector_shape["points"] = [
            {"x": x, "y": y},
            {"x": x + width, "y": y + height},
        ]
        vector_shape.setdefault("closed", False)
    elif element_type == "rectangle":
        vector_shape["points"] = [
            {"x": x, "y": y},
            {"x": x + width, "y": y},
            {"x": x + width, "y": y + height},
            {"x": x, "y": y + height},
        ]
        vector_shape.setdefault("closed", True)
        radii = _legacy_corner_radii(value.get("border_radius"))
        if radii is not None:
            vector_shape.setdefault("corner_radii", radii)
    else:
        vector_shape["points"] = _ellipse_points(x, y, width, height)
        vector_shape.setdefault("closed", True)

    return vector_shape


def normalize_legacy_geometry_tree(value: Any) -> Any:
    if isinstance(value, list):
        return [normalize_legacy_geometry_tree(item) for item in value]
    if not isinstance(value, dict):
        return value

    converted = _legacy_geometry_to_vector_shape(value)
    normalized = dict(converted)
    for key in ("children", "elements"):
        if isinstance(normalized.get(key), list):
            normalized[key] = normalize_legacy_geometry_tree(normalized[key])
    if "child" in normalized:
        normalized["child"] = normalize_legacy_geometry_tree(normalized["child"])
    return normalized


SlideElement: TypeAlias = Annotated[
    Union[
        Text,
        Container,
        Image,
        TextList,
        Table,
        VectorShape,
        Chart,
        Infographic,
        Flex,
        Grid,
        Group,
    ],
    BeforeValidator(_legacy_geometry_to_vector_shape),
    Field(discriminator="type"),
]


for _model in (Container, Flex, Grid, Group):
    _model.model_rebuild()


__all__ = [
    "Alignment",
    "BorderRadius",
    "Chart",
    "ChartSeries",
    "ChartType",
    "Container",
    "Fill",
    "Flex",
    "FlexDirection",
    "Font",
    "Grid",
    "HorizontalAlignment",
    "Image",
    "ImageFit",
    "IconType",
    "Infographic",
    "InfographicType",
    "LayoutAlignment",
    "Marker",
    "normalize_legacy_geometry_tree",
    "Padding",
    "Position",
    "Shadow",
    "Size",
    "SlideElement",
    "Group",
    "Stroke",
    "Table",
    "TableCell",
    "Text",
    "TextList",
    "TextRun",
    "VerticalAlignment",
    "VectorShape",
    "VectorShapeCurve",
]
