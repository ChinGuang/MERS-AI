"""add dispatch_center to incidents

Revision ID: b3f8a91c6d02
Revises: c8d9e0f1a2b3
Create Date: 2026-07-27 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b3f8a91c6d02'
down_revision: Union[str, Sequence[str], None] = 'c8d9e0f1a2b3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('incidents', sa.Column('dispatch_center', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('incidents', 'dispatch_center')
