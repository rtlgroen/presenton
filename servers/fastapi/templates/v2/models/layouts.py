from __future__ import annotations

from pydantic import BaseModel, Field, model_validator

from .elements import Position, Size, SlideElement


class RawSlideLayout(BaseModel):
    id: str
    description: str
    elements: list[SlideElement]


class RawSlideLayouts(BaseModel):
    layouts: list[RawSlideLayout]


class Component(BaseModel):
    id: str = Field(min_length=1, max_length=80)
    description: str = Field(min_length=10, max_length=300)
    position: Position
    size: Size
    elements: list[SlideElement] = Field(min_length=1)


class SlideLayout(BaseModel):
    id: str = Field(min_length=1, max_length=80)
    description: str = Field(min_length=10, max_length=300)
    components: list[Component]

    @model_validator(mode="after")
    def _component_ids_must_be_unique(self) -> "SlideLayout":
        ids = [component.id for component in self.components]
        if len(ids) != len(set(ids)):
            raise ValueError("component ids must be unique within a slide layout")
        return self


class SlideLayouts(BaseModel):
    layouts: list[SlideLayout] = Field(min_length=1)

    @model_validator(mode="after")
    def _layout_ids_must_be_unique(self) -> "SlideLayouts":
        ids = [layout.id for layout in self.layouts]
        if len(ids) != len(set(ids)):
            raise ValueError("slide layout ids must be unique")
        return self
