"""add template v2 artifacts

Revision ID: 9f1a2b3c4d5e
Revises: 4b2c5d6e7f8a
Create Date: 2026-06-15 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "9f1a2b3c4d5e"
down_revision: Union[str, None] = "4b2c5d6e7f8a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_table(table_name: str) -> bool:
    return table_name in sa.inspect(op.get_bind()).get_table_names()


def _has_column(table_name: str, column_name: str) -> bool:
    columns = sa.inspect(op.get_bind()).get_columns(table_name)
    return column_name in {column["name"] for column in columns}


def upgrade() -> None:
    if not _has_table("template_v2"):
        return

    for column_name in ("cluster_candidates", "clusters", "components"):
        if not _has_column("template_v2", column_name):
            op.add_column("template_v2", sa.Column(column_name, sa.JSON(), nullable=True))


def downgrade() -> None:
    if not _has_table("template_v2"):
        return

    for column_name in ("components", "clusters", "cluster_candidates"):
        if _has_column("template_v2", column_name):
            op.drop_column("template_v2", column_name)
