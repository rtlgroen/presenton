import asyncio
import json
from pathlib import Path
from typing import Any

from models.sql.template_v2 import TemplateV2
from templates import default_templates


def _component() -> dict[str, Any]:
    return {
        "id": "photo_component",
        "description": "Reusable photo component for a default template.",
        "position": {"x": 10, "y": 20},
        "size": {"width": 320, "height": 180},
        "elements": [
            {
                "type": "image",
                "position": {"x": 0, "y": 0},
                "size": {"width": 320, "height": 180},
                "data": "static/image.png",
                "decorative": False,
                "name": "photo",
                "is_icon": False,
            }
        ],
    }


def _write_template_bundle(root: Path) -> Path:
    template_dir = root / "general"
    static_dir = template_dir / "static"
    static_dir.mkdir(parents=True)
    (static_dir / "image.png").write_bytes(b"image")
    (static_dir / "thumbnail.png").write_bytes(b"thumbnail")
    (template_dir / "template.json").write_text(
        json.dumps(
            {
                "id": "general",
                "name": "General",
                "description": "General purpose default template.",
                "thumbnail": "static/thumbnail.png",
                "fonts": {"Inter": "static/inter.ttf"},
                "layouts": [
                    {
                        "id": "slide_1",
                        "description": "A valid slide layout for default import.",
                        "components": [_component()],
                    }
                ],
                "merged_components": [
                    {
                        "id": "photo_component",
                        "description": "Merged reusable photo component.",
                        "variants": [_component()],
                    }
                ],
            }
        ),
        encoding="utf-8",
    )
    return template_dir


class _FakeSession:
    def __init__(self, existing: TemplateV2 | None = None):
        self.existing = existing
        self.added: list[TemplateV2] = []
        self.commit_count = 0

    async def get(self, _model: Any, _key: str):
        return self.existing

    def add(self, template: TemplateV2) -> None:
        self.added.append(template)

    async def commit(self) -> None:
        self.commit_count += 1


class _SessionContext:
    def __init__(self, session: _FakeSession):
        self.session = session

    async def __aenter__(self):
        return self.session

    async def __aexit__(self, *_args):
        return None


def test_default_template_import_normalizes_shapes_and_copies_static(
    tmp_path,
    monkeypatch,
):
    templates_root = tmp_path / "templates"
    _write_template_bundle(templates_root)
    app_data_dir = tmp_path / "app_data"
    session = _FakeSession()
    monkeypatch.setenv("APP_DATA_DIRECTORY", str(app_data_dir))
    monkeypatch.setattr(
        default_templates,
        "async_session_maker",
        lambda: _SessionContext(session),
    )

    asyncio.run(default_templates.import_default_templates_on_startup(templates_root))

    assert session.commit_count == 1
    assert len(session.added) == 1
    template = session.added[0]
    assert template.id == "general"
    assert template.is_default is True
    assert list(template.layouts) == ["layouts"]
    assert list(template.merged_components) == ["components"]
    assert (
        template.layouts["layouts"][0]["components"][0]["elements"][0]["data"]
        == "/app_data/templates/general/static/image.png"
    )
    assert (
        template.merged_components["components"][0]["variants"][0]["elements"][0][
            "data"
        ]
        == "/app_data/templates/general/static/image.png"
    )
    assert template.assets["thumbnail"] == (
        "/app_data/templates/general/static/thumbnail.png"
    )
    assert template.assets["fonts"] == {
        "Inter": "/app_data/templates/general/static/inter.ttf"
    }
    assert template.assets["images"] == ["/app_data/templates/general/static/image.png"]
    assert (
        app_data_dir / "templates/general/static/image.png"
    ).read_bytes() == b"image"


def test_default_template_import_skips_existing_database_row(tmp_path, monkeypatch):
    templates_root = tmp_path / "templates"
    _write_template_bundle(templates_root)
    app_data_dir = tmp_path / "app_data"
    session = _FakeSession(existing=TemplateV2(id="general", name="General"))
    monkeypatch.setenv("APP_DATA_DIRECTORY", str(app_data_dir))
    monkeypatch.setattr(
        default_templates,
        "async_session_maker",
        lambda: _SessionContext(session),
    )

    asyncio.run(default_templates.import_default_templates_on_startup(templates_root))

    assert session.commit_count == 0
    assert session.added == []
    assert not (app_data_dir / "templates/general/static/image.png").exists()


def test_bundled_general_template_json_matches_template_v2_shapes():
    template_dir = Path(__file__).resolve().parents[4] / "templates" / "general"

    template = default_templates._load_default_template(template_dir)

    assert template.id == "general"
    assert template.is_default is True
    assert list(template.layouts) == ["layouts"]
    assert len(template.layouts["layouts"]) > 0
    assert list(template.merged_components) == ["components"]
    assert len(template.merged_components["components"]) > 0
    assert template.assets["thumbnail"] == (
        "/app_data/templates/general/static/thumbnail.png"
    )
