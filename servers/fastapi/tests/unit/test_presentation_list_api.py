import asyncio
from typing import Any

from sqlalchemy.dialects import sqlite

from api.v1.ppt.endpoints import presentation as presentation_endpoint
from models.sql.presentation import PresentationVersion


class _RowsResult:
    def all(self):
        return []


class _CapturingAsyncSession:
    def __init__(self):
        self.executed_statement: Any = None

    async def execute(self, statement: Any):
        self.executed_statement = statement
        return _RowsResult()


def _compile_statement(statement: Any) -> str:
    return str(
        statement.compile(
            dialect=sqlite.dialect(),
            compile_kwargs={"literal_binds": True},
        )
    )


def test_get_all_presentations_filters_by_version():
    session = _CapturingAsyncSession()

    response = asyncio.run(
        presentation_endpoint.get_all_presentations(
            version=PresentationVersion.V2_STANDARD,
            sql_session=session,
        )
    )

    assert response == []
    compiled = _compile_statement(session.executed_statement)
    assert "WHERE presentations.version = 'v2-standard'" in compiled
    assert "ORDER BY presentations.created_at DESC" in compiled


def test_get_all_presentations_omits_version_filter_by_default():
    session = _CapturingAsyncSession()

    response = asyncio.run(
        presentation_endpoint.get_all_presentations(
            sql_session=session,
        )
    )

    assert response == []
    compiled = _compile_statement(session.executed_statement)
    assert "presentations.version =" not in compiled
    assert "ORDER BY presentations.created_at DESC" in compiled
