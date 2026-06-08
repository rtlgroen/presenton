import asyncio
import os
from datetime import datetime
from typing import Any, Optional
from urllib.parse import unquote, urlparse
import uuid

from fastapi import APIRouter, Body, Depends, HTTPException, Path, Query, Response
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from models.sql.template_v2 import TemplateV2
from services.database import get_async_session
from services.export_task_service import EXPORT_TASK_SERVICE
from templates.v2.generation import generate_template
from templates.v2.models.layouts import SlideLayouts
from utils.asset_directory_utils import resolve_app_path_to_filesystem
from utils.file_utils import get_original_file_name


TEMPLATES_V2_ROUTER = APIRouter(prefix="/templates", tags=["Templates V2"])


class CreateTemplateV2Request(BaseModel):
    pptx_url: str
    slide_image_urls: list[str]
    fonts: dict[str, Any] = Field(default_factory=dict)
    name: Optional[str] = None
    description: Optional[str] = None


class TemplateV2ListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class TemplateV2ListResponse(BaseModel):
    items: list[TemplateV2ListItem]
    total: int
    page: int
    page_size: int


class TemplateV2Response(TemplateV2ListItem):
    raw_layouts: Optional[dict[str, Any]] = None
    layouts: dict[str, Any]
    assets: Optional[dict[str, Any]] = None


def _derive_template_name(pptx_url: str, pptx_path: str) -> str:
    source = pptx_path or unquote(urlparse(pptx_url).path) or pptx_url
    basename = os.path.basename(source.rstrip("/"))
    if "----" in basename:
        basename = get_original_file_name(basename)
    name = os.path.splitext(basename)[0].strip()
    return name or "Untitled template"


def _collect_image_urls_from_layouts(layouts_json: dict[str, Any]) -> list[str]:
    images: list[str] = []
    seen: set[str] = set()

    def visit(value: Any) -> None:
        if isinstance(value, dict):
            if value.get("type") == "image":
                image_data = value.get("data")
                if isinstance(image_data, str):
                    image_url = image_data.strip()
                    if image_url and image_url not in seen:
                        seen.add(image_url)
                        images.append(image_url)

            for child_value in value.values():
                visit(child_value)
            return

        if isinstance(value, list):
            for item in value:
                visit(item)

    visit(layouts_json)
    return images


async def _generate_flexible_layouts(raw_layouts: SlideLayouts) -> SlideLayouts:
    try:
        return await asyncio.to_thread(generate_template, raw_layouts)
    except ValidationError as exc:
        raise HTTPException(
            status_code=500,
            detail="Flexible layout generation produced invalid output",
        ) from exc


@TEMPLATES_V2_ROUTER.get("", response_model=TemplateV2ListResponse)
async def list_templates_v2(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    sql_session: AsyncSession = Depends(get_async_session),
):
    offset = (page - 1) * page_size
    total = await sql_session.scalar(select(func.count()).select_from(TemplateV2))
    result = await sql_session.execute(
        select(
            TemplateV2.id,
            TemplateV2.name,
            TemplateV2.description,
            TemplateV2.created_at,
            TemplateV2.updated_at,
        )
        .order_by(TemplateV2.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )

    items = [
        TemplateV2ListItem(
            id=template_id,
            name=name,
            description=description,
            created_at=created_at,
            updated_at=updated_at,
        )
        for template_id, name, description, created_at, updated_at in result.all()
    ]
    return TemplateV2ListResponse(
        items=items,
        total=total or 0,
        page=page,
        page_size=page_size,
    )


@TEMPLATES_V2_ROUTER.post(
    "",
    status_code=201,
    response_model=TemplateV2Response,
)
async def create_template_v2(
    request: CreateTemplateV2Request = Body(...),
    sql_session: AsyncSession = Depends(get_async_session),
):
    if not request.slide_image_urls:
        raise HTTPException(
            status_code=400, detail="At least one slide image is required"
        )

    pptx_path = resolve_app_path_to_filesystem(request.pptx_url)
    if not pptx_path or not os.path.isfile(pptx_path):
        raise HTTPException(status_code=400, detail="PPTX file not found")

    pptx_json = await EXPORT_TASK_SERVICE.convert_pptx_to_json(pptx_path)
    try:
        raw_layouts = SlideLayouts.model_validate(pptx_json.model_dump(mode="json"))
    except ValidationError as exc:
        raise HTTPException(
            status_code=500,
            detail="PPTX-to-JSON export produced invalid slide layout JSON",
        ) from exc

    generated_layouts = await _generate_flexible_layouts(raw_layouts)
    raw_layouts_json = raw_layouts.model_dump(mode="json", exclude_none=True)
    generated_layouts_json = generated_layouts.model_dump(
        mode="json", exclude_none=True
    )
    template = TemplateV2(
        name=(request.name or "").strip() or _derive_template_name(
            request.pptx_url, pptx_path
        ),
        description=request.description,
        raw_layouts=raw_layouts_json,
        layouts=generated_layouts_json,
        assets={
            "fonts": request.fonts or {},
            "slide_image_urls": request.slide_image_urls,
            "images": _collect_image_urls_from_layouts(raw_layouts_json),
        },
    )
    sql_session.add(template)
    await sql_session.commit()
    await sql_session.refresh(template)
    return template


@TEMPLATES_V2_ROUTER.get("/{template_id}", response_model=TemplateV2Response)
async def get_template_v2(
    template_id: uuid.UUID = Path(...),
    sql_session: AsyncSession = Depends(get_async_session),
):
    template = await sql_session.get(TemplateV2, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template


@TEMPLATES_V2_ROUTER.delete("/{template_id}", status_code=204)
async def delete_template_v2(
    template_id: uuid.UUID = Path(...),
    sql_session: AsyncSession = Depends(get_async_session),
):
    template = await sql_session.get(TemplateV2, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    await sql_session.delete(template)
    await sql_session.commit()
    return Response(status_code=204)
