import json

import pytest
from llmai.shared import AssistantMessage, SystemMessage, UserMessage
from pydantic import BaseModel, Field, ValidationError

from templates.v2.generation import (
    GENERATE_SLIDE_LAYOUT_SYSTEM_PROMPT,
    _messages_for_json_repair_retry,
    _messages_for_model_validation_retry,
    _slide_image_content,
    generate_slide_layout,
    generate_template,
)
from templates.v2.models.elements import Image as TemplateImage
from templates.v2.models.layouts import RawSlideLayout, RawSlideLayouts, SlideLayout


class _FakeResponse:
    def __init__(self, content, messages=None):
        self.content = content
        self.messages = messages or []


class _FakeClient:
    def __init__(self, content):
        self.content = content
        self.calls = []

    def generate(self, **kwargs):
        self.calls.append(kwargs)
        return _FakeResponse(self.content)


class _ProviderResponseItem:
    id = "rs_00000000000000000000000000000000"


class _RetrySchema(BaseModel):
    title: str = Field(min_length=5)


def _raw_layout(layout_id: str = "source_slide") -> RawSlideLayout:
    return RawSlideLayout.model_validate(
        {
            "id": layout_id,
            "description": "Source slide with a title block.",
            "elements": [
                {
                    "type": "text",
                    "position": {"x": 100, "y": 80},
                    "size": {"width": 600, "height": 80},
                    "decorative": False,
                    "name": "title",
                    "min_length": 20,
                    "max_length": 40,
                    "runs": [{"text": "Original title"}],
                }
            ],
        }
    )


def _generated_layout(layout_id: str = "title_slide") -> dict:
    return {
        "id": layout_id,
        "description": "Reusable slide with a prominent title block.",
        "components": [
            {
                "id": "title_block",
                "description": "Reusable prominent title text block.",
                "position": {"x": 100, "y": 80},
                "size": {"width": 600, "height": 80},
                "elements": [
                    {
                        "type": "text",
                        "position": {"x": 0, "y": 0},
                        "size": {"width": 600, "height": 80},
                        "decorative": False,
                        "name": "title",
                        "min_length": 20,
                        "max_length": 40,
                        "runs": [{"text": "Original title"}],
                    }
                ],
            }
        ],
    }


def test_template_image_supports_optional_overlay_color():
    image = TemplateImage.model_validate(
        {
            "type": "image",
            "data": "/app_data/image.png",
            "color": "rgba(0, 0, 0, 0.35)",
            "decorative": True,
            "name": "background",
            "is_icon": False,
        }
    )
    image_without_overlay = TemplateImage.model_validate(
        {
            "type": "image",
            "decorative": True,
            "name": "background",
            "is_icon": False,
        }
    )

    assert image.color == "rgba(0, 0, 0, 0.35)"
    assert image_without_overlay.color is None


def test_generate_slide_layout_requests_complete_layout(monkeypatch):
    client = _FakeClient(_generated_layout())
    monkeypatch.setattr("templates.v2.generation.get_client", lambda **_kwargs: client)
    monkeypatch.setattr("templates.v2.generation.get_llm_config", lambda: {})
    monkeypatch.setattr("templates.v2.generation.get_model", lambda: "test-model")

    result = generate_slide_layout(
        _raw_layout(),
        2,
        "https://example.com/slide-3.png",
    )

    assert result == SlideLayout.model_validate(_generated_layout())
    result_element = result.model_dump(mode="json")["components"][0]["elements"][0]
    assert result_element["decorative"] is False
    assert "fixed" not in result_element
    assert len(client.calls) == 1
    call = client.calls[0]
    assert call["response_format"].json_schema is SlideLayout
    assert call["response_format"].name == "SlideLayoutResponse"
    assert call["max_tokens"] == 16384
    assert call["messages"][0].content == GENERATE_SLIDE_LAYOUT_SYSTEM_PROMPT
    user_content = call["messages"][1].content
    assert user_content[0].url == "https://example.com/slide-3.png"
    payload = json.loads(user_content[1])
    assert payload[0]["id"] == "source_slide"
    assert payload[0]["elements"][0]["runs"][0]["text"] == (
        "Original title"
    )


def test_generate_template_generates_each_slide_and_preserves_order(monkeypatch):
    raw_layouts = RawSlideLayouts(
        layouts=[_raw_layout("first"), _raw_layout("second")]
    )
    calls = []

    def fake_generate(source_layout, slide_index, slide_image_url):
        calls.append((source_layout.id, slide_index, slide_image_url))
        return SlideLayout.model_validate(
            _generated_layout(f"generated_{source_layout.id}")
        )

    monkeypatch.setattr(
        "templates.v2.generation.generate_slide_layout", fake_generate
    )

    generated = generate_template(
        raw_layouts,
        ["https://example.com/first.png", "https://example.com/second.png"],
    )

    assert sorted(calls) == [
        ("first", 0, "https://example.com/first.png"),
        ("second", 1, "https://example.com/second.png"),
    ]
    assert [layout.id for layout in generated.layouts] == [
        "generated_first",
        "generated_second",
    ]


def test_generate_template_rejects_empty_source():
    with pytest.raises(ValueError, match="at least one"):
        generate_template(RawSlideLayouts(layouts=[]), [])


def test_generate_template_requires_one_image_per_layout():
    with pytest.raises(ValueError, match="one image for each layout"):
        generate_template(
            RawSlideLayouts(layouts=[_raw_layout("first"), _raw_layout("second")]),
            ["https://example.com/first.png"],
        )


def test_slide_image_content_embeds_local_image_bytes(tmp_path, monkeypatch):
    image_path = tmp_path / "slide.png"
    image_path.write_bytes(b"png-image-bytes")
    monkeypatch.setattr(
        "templates.v2.generation.resolve_image_path_to_filesystem",
        lambda _url: str(image_path),
    )

    image_content = _slide_image_content("/app_data/images/slide.png")

    assert image_content.data == b"png-image-bytes"
    assert image_content.mime_type == "image/png"
    assert image_content.url is None


def test_slide_layout_rejects_duplicate_component_ids():
    layout = _generated_layout()
    layout["components"].append(layout["components"][0])

    with pytest.raises(ValidationError, match="component ids must be unique"):
        SlideLayout.model_validate(layout)


def test_slide_layout_does_not_accept_fixed_component_metadata():
    layout = _generated_layout()
    element = layout["components"][0]["elements"][0]
    element["fixed"] = element.pop("decorative")

    with pytest.raises(ValidationError):
        SlideLayout.model_validate(layout)


def test_direct_generation_prompt_uses_decorative_element_metadata():
    assert "Convert the provided raw slide elements to components" in (
        GENERATE_SLIDE_LAYOUT_SYSTEM_PROMPT
    )
    assert "`decorative=true`" in GENERATE_SLIDE_LAYOUT_SYSTEM_PROMPT
    assert "`decorative=false`" in GENERATE_SLIDE_LAYOUT_SYSTEM_PROMPT


def test_json_repair_retry_rebuilds_messages_without_provider_response_items():
    original_messages = [
        SystemMessage(content="Return JSON."),
        UserMessage(content="{}"),
    ]
    provider_response_item = _ProviderResponseItem()
    response = _FakeResponse(
        content='{"bad": true',
        messages=[provider_response_item],
    )

    retry_messages = _messages_for_json_repair_retry(
        messages=original_messages,
        response=response,
        label="slide layout",
        error=ValueError("invalid JSON"),
    )

    assert provider_response_item not in retry_messages
    assert retry_messages[:2] == original_messages
    assert isinstance(retry_messages[2], AssistantMessage)
    assert retry_messages[2].content == ['"{\\"bad\\": true"']
    assert isinstance(retry_messages[3], UserMessage)
    assert "Return a complete replacement JSON object." in retry_messages[3].content


def test_validation_retry_rebuilds_messages_without_provider_response_items():
    original_messages = [
        SystemMessage(content="Return schema JSON."),
        UserMessage(content='{"title":"ok"}'),
    ]
    provider_response_item = _ProviderResponseItem()
    invalid_response = {"title": "bad"}
    response = _FakeResponse(
        content=invalid_response,
        messages=[provider_response_item],
    )
    with pytest.raises(ValidationError) as exc:
        _RetrySchema.model_validate(invalid_response)

    retry_messages = _messages_for_model_validation_retry(
        messages=original_messages,
        response=response,
        label="slide layout",
        output_model=_RetrySchema,
        error=exc.value,
        invalid_response=invalid_response,
    )

    assert provider_response_item not in retry_messages
    assert retry_messages[:2] == original_messages
    assert isinstance(retry_messages[2], AssistantMessage)
    assert retry_messages[2].content == ['{\n  "title": "bad"\n}']
    assert isinstance(retry_messages[3], UserMessage)
    assert "required_json_schema:" in retry_messages[3].content
