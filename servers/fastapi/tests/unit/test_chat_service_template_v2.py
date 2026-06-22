import asyncio
import uuid

from llmai.shared import AssistantMessage, AssistantToolCall, SystemMessage, UserMessage

from models.sql.presentation import PresentationModel, PresentationVersion
from services.chat.memory_layer import PresentationChatMemoryLayer
from services.chat.service import PresentationChatService


def test_append_sanitized_assistant_tool_turn_drops_provider_response_state():
    messages = [
        SystemMessage(content="system"),
        UserMessage(content="change the slide"),
    ]
    tool_call = AssistantToolCall(
        id="call_123",
        name="saveSlide",
        arguments='{"index":0}',
    )

    updated = PresentationChatService._append_sanitized_assistant_tool_turn(
        messages,
        content=["I will save it."],
        tool_calls=[tool_call],
    )

    assistant_turn = updated[-1]
    assert isinstance(assistant_turn, AssistantMessage)
    assert assistant_turn.id is None
    assert assistant_turn.thinking is None
    assert assistant_turn.content == ["I will save it."]
    assert assistant_turn.tool_calls == [tool_call]
    assert updated[:-1] == messages


def test_chat_memory_resolves_template_v2_layout_schemas():
    presentation_id = uuid.uuid4()
    template_layout = {
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
    presentation = PresentationModel(
        id=presentation_id,
        version=PresentationVersion.V1_STANDARD,
        content="deck",
        n_slides=1,
        language="English",
        title="Deck",
        layout=template_layout,
    )
    memory = PresentationChatMemoryLayer(
        _FakeSession(presentation),
        presentation_id,
    )

    layouts = asyncio.run(memory.get_available_layouts())
    schema = asyncio.run(memory.get_content_schema_from_layout_id("intro"))

    assert layouts == [
        {
            "id": "intro",
            "name": "intro",
            "description": "Intro slide.",
        }
    ]
    assert schema is not None
    assert schema["required"] == ["hero"]
    assert schema["properties"]["hero"]["required"] == ["photo"]


class _FakeSession:
    def __init__(self, presentation: PresentationModel):
        self._presentation = presentation

    async def get(self, model, object_id):
        if model is PresentationModel and object_id == self._presentation.id:
            return self._presentation
        return None
