from datetime import datetime
from typing import Optional
import uuid

from sqlmodel import Field, SQLModel
from sqlalchemy import JSON, Column, DateTime

from utils.datetime_utils import get_current_utc_datetime


def _new_template_v2_id() -> str:
    return str(uuid.uuid4())


class TemplateV2(SQLModel, table=True):
    __tablename__ = "template_v2"

    id: str = Field(primary_key=True, default_factory=_new_template_v2_id)
    name: str = Field(nullable=False)
    description: Optional[str] = Field(default=None, nullable=True)
    raw_layouts: Optional[dict] = Field(
        default=None, sa_column=Column(JSON, nullable=True)
    )
    components: Optional[dict] = Field(
        default=None, sa_column=Column(JSON, nullable=True)
    )
    merged_components: Optional[dict] = Field(
        default=None, sa_column=Column(JSON, nullable=True)
    )
    layouts: Optional[dict] = Field(
        default=None, sa_column=Column(JSON, nullable=True)
    )
    assets: Optional[dict] = Field(
        default=None, sa_column=Column(JSON, nullable=True)
    )
    is_default: bool = Field(default=False, nullable=False)
    created_at: datetime = Field(
        sa_column=Column(
            DateTime(timezone=True), nullable=False, default=get_current_utc_datetime
        )
    )
    updated_at: datetime = Field(
        sa_column=Column(
            DateTime(timezone=True),
            nullable=False,
            default=get_current_utc_datetime,
            onupdate=get_current_utc_datetime,
        )
    )
