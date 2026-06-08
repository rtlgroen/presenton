"""add template v2 table

Revision ID: 4b2c5d6e7f8a
Revises: c7b70d0f31b1
Create Date: 2026-06-08 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = "4b2c5d6e7f8a"
down_revision: Union[str, None] = "c7b70d0f31b1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_table(table_name: str) -> bool:
    return table_name in sa.inspect(op.get_bind()).get_table_names()


def upgrade() -> None:
    if not _has_table("template_v2"):
        op.create_table(
            "template_v2",
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("name", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("description", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("raw_layouts", sa.JSON(), nullable=True),
            sa.Column("layouts", sa.JSON(), nullable=False),
            sa.Column("assets", sa.JSON(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )


def downgrade() -> None:
    if _has_table("template_v2"):
        op.drop_table("template_v2")
