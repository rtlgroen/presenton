from typing import Any, List, Optional
from datetime import datetime
import uuid

from pydantic import BaseModel

from models.sql.slide import SlideModel


class PresentationWithSlides(BaseModel):
    id: uuid.UUID
    version: Optional[str] = None
    content: str
    n_slides: int
    language: str
    title: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    tone: Optional[str] = None
    verbosity: Optional[str] = None
    slides: List[SlideModel]
    layout: Optional[dict] = None
    structure: Optional[dict] = None
    theme: Optional[dict] = None
    fonts: Optional[Any] = None


class PresentationDetailWithSlides(PresentationWithSlides):
    components: Optional[Any] = None
