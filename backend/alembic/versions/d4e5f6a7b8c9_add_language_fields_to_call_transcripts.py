"""add language and translated_text to call_transcripts

Revision ID: d4e5f6a7b8c9
Revises: b3f8a91c6d02
Create Date: 2026-07-27 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, Sequence[str], None] = 'b3f8a91c6d02'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('call_transcripts', sa.Column('language', sa.String(), nullable=True))
    op.add_column('call_transcripts', sa.Column('translated_text', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('call_transcripts', 'translated_text')
    op.drop_column('call_transcripts', 'language')
