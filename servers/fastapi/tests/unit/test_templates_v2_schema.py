from templates.v2.models.layouts import RawSlideLayout
from templates.v2.schema import (
    extract_slide_schema_from_layout,
    get_component_schema,
    get_template_schema,
)


def test_extract_slide_schema_from_layout_extracts_editable_content():
    layout = RawSlideLayout.model_validate(
        {
            "id": "content_slide",
            "description": "Editable content with static decoration.",
            "elements": [
                {
                    "type": "rectangle",
                    "fill": {"color": "#ffffff"},
                },
                {
                    "type": "text",
                    "decorative": False,
                    "name": "title",
                    "min_length": 4,
                    "max_length": 8,
                },
                {
                    "type": "text",
                    "decorative": True,
                    "name": "static_label",
                    "min_length": 1,
                    "max_length": 2,
                },
                {
                    "type": "image",
                    "decorative": False,
                    "name": "hero_image",
                    "is_icon": False,
                },
                {
                    "type": "container",
                    "decorative": True,
                    "child": {
                        "type": "text",
                        "decorative": False,
                        "name": "caption",
                        "min_length": 2,
                        "max_length": 4,
                    },
                },
                {
                    "type": "group",
                    "name": "details",
                    "children": [
                        {
                            "type": "text-list",
                            "decorative": False,
                            "name": "bullets",
                            "min_items": 2,
                            "max_items": 4,
                            "min_item_length": 5,
                            "max_item_length": 10,
                        },
                        {
                            "type": "chart",
                            "decorative": False,
                            "name": "chart",
                            "chart_type": "bar",
                            "data": [],
                        },
                    ],
                },
            ],
        }
    )

    assert extract_slide_schema_from_layout(layout) == {
        "type": "object",
        "properties": {
            "title": {"type": "string", "minLength": 4, "maxLength": 8},
            "hero_image": {
                "type": "object",
                "properties": {"prompt": {"type": "string"}},
                "required": ["prompt"],
                "additionalProperties": False,
            },
            "caption": {"type": "string", "minLength": 2, "maxLength": 4},
            "details": {
                "type": "object",
                "properties": {
                    "bullets": {
                        "type": "array",
                        "minItems": 2,
                        "maxItems": 4,
                        "items": {
                            "type": "string",
                            "minLength": 5,
                            "maxLength": 10,
                        },
                    },
                    "chart": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "label": {"type": "string"},
                                "value": {"type": "number"},
                                "color": {"type": "string"},
                            },
                            "required": ["label", "value"],
                            "additionalProperties": False,
                        },
                    },
                },
                "required": ["bullets", "chart"],
                "additionalProperties": False,
            },
        },
        "required": ["title", "hero_image", "caption", "details"],
        "additionalProperties": False,
    }


def test_extract_slide_schema_from_layout_collapses_repeated_children_to_array():
    layout = RawSlideLayout.model_validate(
        {
            "id": "cards_slide",
            "description": "Repeated card layout.",
            "elements": [
                {
                    "type": "flex",
                    "name": "cards",
                    "position": {"x": 0, "y": 0},
                    "size": {"width": 1280, "height": 240},
                    "direction": "row",
                    "min_children": 2,
                    "max_children": 4,
                    "children": [
                        {
                            "type": "group",
                            "name": "card_1",
                            "children": [
                                {
                                    "type": "text",
                                    "decorative": False,
                                    "name": "title_1",
                                    "min_length": 3,
                                    "max_length": 6,
                                },
                                {
                                    "type": "image",
                                    "decorative": False,
                                    "name": "icon_1",
                                    "is_icon": True,
                                },
                            ],
                        },
                        {
                            "type": "group",
                            "name": "card_2",
                            "children": [
                                {
                                    "type": "text",
                                    "decorative": False,
                                    "name": "title_2",
                                    "min_length": 3,
                                    "max_length": 6,
                                },
                                {
                                    "type": "image",
                                    "decorative": False,
                                    "name": "icon_2",
                                    "is_icon": True,
                                },
                            ],
                        },
                    ],
                }
            ],
        }
    )

    assert extract_slide_schema_from_layout(layout) == {
        "type": "object",
        "properties": {
            "cards": {
                "type": "array",
                "minItems": 2,
                "maxItems": 4,
                "items": {
                    "type": "object",
                    "properties": {
                        "title": {
                            "type": "string",
                            "minLength": 3,
                            "maxLength": 6,
                        },
                        "icon": {
                            "type": "object",
                            "properties": {"query": {"type": "string"}},
                            "required": ["query"],
                            "additionalProperties": False,
                        },
                    },
                    "required": ["title", "icon"],
                    "additionalProperties": False,
                },
            }
        },
        "required": ["cards"],
        "additionalProperties": False,
    }


def test_get_component_schema_extracts_generated_component_content():
    component = {
        "id": "feature_card",
        "description": "Reusable feature card component.",
        "elements": [
            {
                "type": "text",
                "decorative": False,
                "name": "headline",
                "min_length": 4,
                "max_length": 12,
            },
            {
                "type": "image",
                "decorative": False,
                "name": "icon",
                "is_icon": True,
            },
            {
                "type": "table",
                "decorative": False,
                "name": "metrics",
                "min_columns": 2,
                "max_columns": 4,
                "min_rows": 1,
                "max_rows": 3,
            },
        ],
    }

    assert get_component_schema(component) == {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "title": "feature_card",
        "description": "Reusable feature card component.",
        "additionalProperties": False,
        "properties": {
            "headline": {
                "type": "string",
                "minLength": 4,
                "maxLength": 12,
                "title": "Headline",
                "x-element-type": "text",
                "x-element-path": "elements.0",
            },
            "icon": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "icon_query": {
                        "type": "string",
                        "description": "Search query for the replacement icon.",
                    }
                },
                "required": ["icon_query"],
                "title": "Icon",
                "x-element-type": "image",
                "x-element-path": "elements.1",
            },
            "metrics": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "columns": {
                        "type": "array",
                        "items": {"type": "string"},
                        "minItems": 2,
                        "maxItems": 4,
                    },
                    "rows": {
                        "type": "array",
                        "items": {
                            "type": "array",
                            "items": {"type": "string"},
                            "minItems": 2,
                            "maxItems": 4,
                        },
                        "minItems": 1,
                        "maxItems": 3,
                    },
                },
                "required": ["columns", "rows"],
                "title": "Metrics",
                "x-element-type": "table",
                "x-element-path": "elements.2",
            },
        },
        "required": ["headline", "icon", "metrics"],
    }


def test_get_component_schema_collapses_repeated_component_children_to_array():
    component = {
        "id": "card_grid",
        "description": "Reusable card grid component.",
        "elements": [
            {
                "type": "grid",
                "name": "cards",
                "min_children": 2,
                "max_children": 4,
                "children": [
                    {
                        "type": "group",
                        "name": "card_1",
                        "children": [
                            {
                                "type": "text",
                                "decorative": False,
                                "name": "title_1",
                                "min_length": 3,
                                "max_length": 8,
                            }
                        ],
                    },
                    {
                        "type": "group",
                        "name": "card_2",
                        "children": [
                            {
                                "type": "text",
                                "decorative": False,
                                "name": "title_2",
                                "min_length": 5,
                                "max_length": 12,
                            }
                        ],
                    },
                ],
            }
        ],
    }

    schema = get_component_schema(component)

    assert schema is not None
    assert schema["properties"]["cards"] == {
        "type": "array",
        "minItems": 2,
        "maxItems": 4,
        "items": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "title": {
                    "type": "string",
                    "minLength": 3,
                    "maxLength": 12,
                    "title": "Title",
                    "x-element-type": "text",
                }
            },
            "required": ["title"],
        },
    }


def test_get_template_schema_strips_component_metadata():
    template = {
        "layouts": [
            {
                "id": "intro",
                "description": "Intro slide.",
                "components": [
                    {
                        "id": "hero",
                        "description": "Hero image component.",
                        "elements": [
                            {
                                "type": "image",
                                "decorative": False,
                                "name": "photo",
                                "is_icon": False,
                            }
                        ],
                    }
                ],
            }
        ]
    }

    assert get_template_schema(template) == {
        "source_file": "template.json",
        "layout_count": 1,
        "layouts": [
            {
                "slide": 1,
                "layout_id": "intro",
                "schema": {
                    "$schema": "https://json-schema.org/draft/2020-12/schema",
                    "type": "object",
                    "title": "intro",
                    "description": "Intro slide.",
                    "additionalProperties": False,
                    "properties": {
                        "hero": {
                            "type": "object",
                            "additionalProperties": False,
                            "properties": {
                                "photo": {
                                    "type": "object",
                                    "additionalProperties": False,
                                    "properties": {
                                        "image_prompt": {"type": "string"}
                                    },
                                    "required": ["image_prompt"],
                                }
                            },
                            "required": ["photo"],
                        }
                    },
                    "required": ["hero"],
                },
            }
        ],
    }


def test_get_template_schema_numbers_duplicate_component_fields_from_zero():
    template = {
        "layouts": [
            {
                "id": "comparison",
                "description": "Comparison slide.",
                "components": [
                    {
                        "id": "metric_card",
                        "description": "Metric card component.",
                        "elements": [
                            {
                                "type": "text",
                                "decorative": False,
                                "name": "value",
                                "min_length": 1,
                                "max_length": 8,
                            }
                        ],
                    },
                    {
                        "id": "metric_card",
                        "description": "Metric card component.",
                        "elements": [
                            {
                                "type": "text",
                                "decorative": False,
                                "name": "value",
                                "min_length": 1,
                                "max_length": 8,
                            }
                        ],
                    },
                ],
            }
        ]
    }

    schema = get_template_schema(template)["layouts"][0]["schema"]

    assert schema is not None
    assert list(schema["properties"]) == ["metric_card_0", "metric_card_1"]
    assert schema["required"] == ["metric_card_0", "metric_card_1"]
    assert schema["properties"]["metric_card_0"] == schema["properties"]["metric_card_1"]
