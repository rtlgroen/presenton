from __future__ import annotations

import json
import logging
import mimetypes
import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from json import JSONDecodeError
from time import perf_counter
from typing import Any, Callable

from llmai import get_client
from llmai.shared import (
    AssistantMessage,
    ImageContentPart,
    JSONSchemaResponse,
    SystemMessage,
    UserMessage,
)
from pydantic import BaseModel, ValidationError

from templates.v2.models.layouts import (
    RawSlideLayout,
    RawSlideLayouts,
    SlideLayout,
    SlideLayouts,
)
from utils.asset_directory_utils import resolve_image_path_to_filesystem
from utils.llm_config import get_llm_config
from utils.llm_provider import get_model

DEFAULT_VALIDATION_RETRIES = 5
DEFAULT_LLM_LOG_PREVIEW_CHARS = 4000
LLM_LOG_PREVIEW_CHARS_ENV = "TEMPLATE_V2_LLM_LOG_PREVIEW_CHARS"
MAX_PARALLEL_SLIDE_LAYOUTS = 10

LOGGER = logging.getLogger(__name__)


GENERATE_SLIDE_LAYOUT_SYSTEM_PROMPT = """
Convert the provided raw slide elements to components.

# Steps:
1. Analyze/Visualize the slide using provided raw pptx elements and image.
2. Divide the slide into a list of components using slide image.
3. Identify group of elements that belongs to each component.
4. Generate `id` and `description` for the layout.

# General Rules:
- `id` and `description` must be related to layout and must not be derived from slide content.
- `id` should be about 2 to 5 words in snake_case format.
- `description` should be around 15 to 30 words.

# Layout Rules:
- Build the flexible component layout using `flex`, `grid`, `container`, etc.
- Use `table` element for table and `chart` element for chart.
- Use `text-list` element for list of text like bullet points, numbered list, unordered list, etc.
- Use `rectangle`, `ellipse`, `line` etc for geometry.
- Use `container` for flexible alignment and layout.
- Use `image` for images and icons.
- Identify icon color from slide image.

# Position and Size Rules:
- Use local coordinates relative to component for elements.
- Don't provide position for elements inside flexible elements like `flex`, `grid`, `container`, etc.
- If children of `flex` and `grid` are not equally sized, provide `size` for children.
- Must provide `position` and `size` for elements inside `group` element.

# Schema Rules:
- Set `decorative=true` for decorative or static elements like logo, decorative images, etc.
- Set `decorative=false` for content elements which should be replaced while creating new slide.
- If `flex` or `grid` contains list of same items, set the `max_length`, `min_length`, and other schema related constraints same for items.
- For same items arranged in `flex`/`grid` derive schema fields by averaging between those similar items.
"""


def generate_template(
    layouts: RawSlideLayouts,
    slide_image_urls: list[str],
) -> SlideLayouts:
    """Generate each template slide directly as a complete SlideLayout."""
    if not layouts.layouts:
        raise ValueError("layouts must contain at least one slide layout")
    if len(slide_image_urls) != len(layouts.layouts):
        raise ValueError("slide_image_urls must contain one image for each layout")

    started_at = perf_counter()
    slide_count = len(layouts.layouts)
    max_workers = min(MAX_PARALLEL_SLIDE_LAYOUTS, slide_count)
    LOGGER.info(
        "[templates.v2.generate] direct slide layout generation start "
        "slides=%d max_parallel=%d validation_retries=%d",
        slide_count,
        max_workers,
        DEFAULT_VALIDATION_RETRIES,
    )

    layouts_by_index: dict[int, SlideLayout] = {}
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {
            executor.submit(
                generate_slide_layout,
                layout,
                index,
                slide_image_urls[index],
            ): index
            for index, layout in enumerate(layouts.layouts)
        }
        for future in as_completed(futures):
            index = futures[future]
            layouts_by_index[index] = future.result()
            LOGGER.info(
                "[templates.v2.generate] slide layout complete slide=%d/%d "
                "components=%d completed=%d/%d",
                index + 1,
                slide_count,
                len(layouts_by_index[index].components),
                len(layouts_by_index),
                slide_count,
            )

    generated = SlideLayouts(
        layouts=[layouts_by_index[index] for index in range(slide_count)]
    )
    LOGGER.info(
        "[templates.v2.generate] direct slide layout generation complete "
        "slides=%d components=%d duration_ms=%.1f",
        slide_count,
        sum(len(layout.components) for layout in generated.layouts),
        _elapsed_ms(started_at),
    )
    return generated


def generate_slide_layout(
    source_layout: RawSlideLayout,
    slide_index: int,
    slide_image_url: str,
) -> SlideLayout:
    payload = (source_layout.model_dump(mode="json", exclude_none=True),)
    layout_json = _generate_with_validation_retries(
        client=get_client(config=get_llm_config()),
        model=get_model(),
        messages=[
            SystemMessage(content=GENERATE_SLIDE_LAYOUT_SYSTEM_PROMPT),
            UserMessage(
                content=[
                    _slide_image_content(slide_image_url),
                    json.dumps(payload, indent=2),
                ]
            ),
        ],
        label=f"slide layout {slide_index + 1}",
        output_model=SlideLayout,
        response_name="SlideLayoutResponse",
        validation_retries=DEFAULT_VALIDATION_RETRIES,
        max_tokens=16384,
    )
    return SlideLayout.model_validate(layout_json)


def _slide_image_content(slide_image_url: str) -> ImageContentPart:
    image_path = resolve_image_path_to_filesystem(slide_image_url)
    if image_path:
        with open(image_path, "rb") as image_file:
            image_bytes = image_file.read()
        mime_type = mimetypes.guess_type(image_path)[0] or "image/png"
        return ImageContentPart(data=image_bytes, mime_type=mime_type)

    return ImageContentPart(url=slide_image_url)


def _generate_with_validation_retries(
    *,
    client: Any,
    model: str,
    messages: list[Any],
    label: str,
    output_model: type[BaseModel],
    response_name: str,
    validation_retries: int,
    extra_validator: Callable[[Any], None] | None = None,
    max_tokens: int = 8192,
) -> dict[str, Any]:
    attempt_messages = list(messages)
    last_error: Exception | None = None
    max_attempts = validation_retries + 1

    for attempt in range(1, max_attempts + 1):
        attempt_started_at = perf_counter()
        LOGGER.info(
            "[templates.v2.llm] request start label=%s model=%s attempt=%d/%d "
            "retry=%d/%d messages=%d",
            label,
            model,
            attempt,
            max_attempts,
            attempt - 1,
            validation_retries,
            len(attempt_messages),
        )
        try:
            response = client.generate(
                model=model,
                messages=attempt_messages,
                response_format=JSONSchemaResponse(
                    name=response_name,
                    strict=False,
                    json_schema=output_model,
                ),
                max_tokens=max_tokens,
            )
        except Exception as exc:
            last_error = exc
            LOGGER.warning(
                "[templates.v2.llm] request failed label=%s model=%s "
                "attempt=%d/%d duration_ms=%.1f error=%s",
                label,
                model,
                attempt,
                max_attempts,
                _elapsed_ms(attempt_started_at),
                exc,
            )
            if attempt > validation_retries:
                raise
            attempt_messages = _messages_for_generation_error_retry(
                messages=attempt_messages,
                label=label,
                error=exc,
            )
            continue

        try:
            parsed = _parse_json_content(response.content)
            validated = _validate_output_model(
                parsed,
                output_model,
                extra_validator=extra_validator,
            )
            LOGGER.info(
                "[templates.v2.llm] response validated label=%s model=%s "
                "attempt=%d/%d duration_ms=%.1f preview=%s",
                label,
                model,
                attempt,
                max_attempts,
                _elapsed_ms(attempt_started_at),
                _preview_for_log(response.content),
            )
            return validated
        except ValidationError as exc:
            last_error = exc
            if attempt > validation_retries:
                raise
            attempt_messages = _messages_for_model_validation_retry(
                messages=attempt_messages,
                response=response,
                label=label,
                output_model=output_model,
                error=exc,
                invalid_response=parsed,
            )
        except (JSONDecodeError, ValueError) as exc:
            last_error = exc
            if attempt > validation_retries:
                raise
            attempt_messages = _messages_for_json_repair_retry(
                messages=attempt_messages,
                response=response,
                label=label,
                error=exc,
            )

    if last_error is not None:
        raise last_error
    raise RuntimeError(f"LLM failed to generate {label}")


def _validate_output_model(
    parsed: dict[str, Any],
    output_model: type[BaseModel],
    *,
    extra_validator: Callable[[Any], None] | None = None,
) -> dict[str, Any]:
    validated = output_model.model_validate(parsed)
    if extra_validator is not None:
        extra_validator(validated)
    return validated.model_dump(mode="json")


def _parse_json_content(content: Any) -> dict[str, Any]:
    text_content = _text_from_content(content)
    parsed = json.loads(text_content) if text_content is not None else content
    if not isinstance(parsed, dict):
        raise ValueError("LLM response must be a JSON object")
    return parsed


def _text_from_content(content: Any) -> str | None:
    if isinstance(content, str):
        return content
    if not isinstance(content, list):
        return None

    parts: list[str] = []
    for part in content:
        if isinstance(part, str):
            parts.append(part)
            continue
        text = getattr(part, "text", None)
        if isinstance(text, str):
            parts.append(text)
    return "".join(parts) if parts else None


def _messages_for_generation_error_retry(
    *,
    messages: list[Any],
    label: str,
    error: Exception,
) -> list[Any]:
    return [
        *messages,
        UserMessage(
            content=_json_repair_prompt(
                label=label,
                invalid_response=None,
                error=error,
            )
        ),
    ]


def _messages_for_json_repair_retry(
    *,
    messages: list[Any],
    response: Any,
    label: str,
    error: Exception,
) -> list[Any]:
    invalid_response = _text_from_content(response.content) or response.content
    return [
        *messages,
        AssistantMessage(content=[_json_dumps_for_prompt(invalid_response)]),
        UserMessage(
            content=_json_repair_prompt(
                label=label,
                invalid_response=invalid_response,
                error=error,
            )
        ),
    ]


def _messages_for_model_validation_retry(
    *,
    messages: list[Any],
    response: Any,
    label: str,
    output_model: type[BaseModel],
    error: ValidationError,
    invalid_response: dict[str, Any],
) -> list[Any]:
    return [
        *messages,
        AssistantMessage(content=[_json_dumps_for_prompt(invalid_response)]),
        UserMessage(
            content=_model_validation_repair_prompt(
                label=label,
                output_model=output_model,
                invalid_response=invalid_response,
                error=error,
            )
        ),
    ]


def _json_repair_prompt(
    *,
    label: str,
    invalid_response: Any | None,
    error: Exception,
) -> str:
    parts = [
        f"The previous {label} response was not valid for this task.",
        "Return a complete replacement JSON object.",
        "Return raw JSON only. Do not include markdown fences, comments, explanations, or text outside the JSON object.",
        "",
        "errors:",
        _format_error_for_prompt(error),
    ]
    if invalid_response is not None:
        parts.extend(
            ["", "invalid_response:", _json_dumps_for_prompt(invalid_response)]
        )
    return "\n".join(parts)


def _model_validation_repair_prompt(
    *,
    label: str,
    output_model: type[BaseModel],
    invalid_response: dict[str, Any],
    error: ValidationError,
) -> str:
    return "\n".join(
        [
            f"The previous {label} JSON did not match the required schema.",
            "Return a complete corrected replacement JSON object.",
            "For a SlideLayout, return id, description, and the complete components list in the same response.",
            "Each component must include position, size, and local-coordinate elements.",
            "Return raw JSON only. Do not include markdown fences, comments, explanations, or text outside the JSON object.",
            "",
            "validation_errors:",
            _format_error_for_prompt(error),
            "",
            "invalid_response:",
            _json_dumps_for_prompt(invalid_response),
            "",
            "required_json_schema:",
            _json_dumps_for_prompt(output_model.model_json_schema()),
        ]
    )


def _format_error_for_prompt(error: Exception) -> str:
    if isinstance(error, ValidationError):
        return _json_dumps_for_prompt(error.errors(include_input=False))
    if isinstance(error, JSONDecodeError):
        return _json_dumps_for_prompt([{"type": "JSONDecodeError", "msg": str(error)}])
    return _json_dumps_for_prompt([{"type": type(error).__name__, "msg": str(error)}])


def _json_dumps_for_prompt(value: Any) -> str:
    return json.dumps(value, indent=2, ensure_ascii=False, default=str)


def _elapsed_ms(started_at: float) -> float:
    return (perf_counter() - started_at) * 1000


def _preview_for_log(value: Any) -> str:
    text = _text_from_content(value)
    if text is None:
        text = _json_dumps_for_prompt(value)
    max_chars = _llm_log_preview_chars()
    if max_chars <= 0:
        return "<disabled>"
    if len(text) <= max_chars:
        return text
    return f"{text[:max_chars]}... <truncated {len(text) - max_chars} chars>"


def _llm_log_preview_chars() -> int:
    raw = os.getenv(LLM_LOG_PREVIEW_CHARS_ENV)
    if raw is None:
        return DEFAULT_LLM_LOG_PREVIEW_CHARS
    try:
        return int(raw)
    except ValueError:
        LOGGER.warning(
            "[templates.v2.llm] invalid %s=%r; using default preview chars=%d",
            LLM_LOG_PREVIEW_CHARS_ENV,
            raw,
            DEFAULT_LLM_LOG_PREVIEW_CHARS,
        )
        return DEFAULT_LLM_LOG_PREVIEW_CHARS
