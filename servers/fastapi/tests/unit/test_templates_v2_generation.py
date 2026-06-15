from templates.v2.generation import (
    Cluster,
    ClusterCandidate,
    Component,
    build_template_layouts,
)
from templates.v2.models.layouts import SlideLayouts


def test_build_template_layouts_replaces_candidates_and_keeps_fallbacks():
    raw_layouts = SlideLayouts.model_validate(
        {
            "layouts": [
                {
                    "id": "slide_1",
                    "description": "Raw slide.",
                    "elements": [
                        {
                            "type": "rectangle",
                            "position": {"x": 10, "y": 20},
                            "size": {"width": 100, "height": 80},
                            "fill": {"color": "#ffffff"},
                        },
                        {
                            "type": "rectangle",
                            "position": {"x": 200, "y": 20},
                            "size": {"width": 100, "height": 80},
                            "fill": {"color": "#eeeeee"},
                        },
                    ],
                }
            ]
        }
    )
    candidates = [
        ClusterCandidate(
            id="left_card",
            description="Standalone rectangle component.",
            slide_index=0,
            elements=[0],
        )
    ]
    clusters = [Cluster(id="card", candidates=[0])]
    components = [
        Component(
            id="card_component",
            description="Reusable rectangle card component.",
            design_variables=[],
            elements=[
                {
                    "type": "rectangle",
                    "position": {"x": 10, "y": 20},
                    "size": {"width": 100, "height": 80},
                    "fill": {"color": "#ffffff"},
                }
            ],
        )
    ]

    template, stats = build_template_layouts(
        raw_layouts,
        candidates,
        clusters,
        components,
    )

    layout = template["layouts"][0]
    assert "elements" not in layout
    assert [component["id"] for component in layout["components"]] == [
        "card_component",
        "slide_1_element_2",
    ]
    assert stats.replaced_candidates == 1
    assert stats.skipped_overlapping_candidates == 0
    assert stats.untouched_elements == 1
