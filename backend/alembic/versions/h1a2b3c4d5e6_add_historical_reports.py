"""add_historical_reports

Revision ID: h1a2b3c4d5e6
Revises: f7c2a1b3d4e5
Create Date: 2026-07-24 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'h1a2b3c4d5e6'
down_revision: Union[str, Sequence[str], None] = 'f7c2a1b3d4e5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'historical_reports',
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('id', sa.String(), nullable=False, primary_key=True),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('outcome', sa.String(), nullable=False),
        sa.Column('incident_type', sa.String(), nullable=False),
        sa.Column('severity', sa.String(), nullable=False),
        sa.Column('location', sa.Text(), nullable=False),
        sa.Column('caller', sa.String(), nullable=False),
        sa.Column('caller_number', sa.String(), nullable=True),
        sa.Column('spoken_dialects', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='[]'),
        sa.Column('call_duration', sa.String(), nullable=False),
        sa.Column('dispatch_confidence', sa.Float(), nullable=False),
        sa.Column('response_time_seconds', sa.Integer(), nullable=True),
        sa.Column('call_received_at', sa.DateTime(), nullable=False),
        sa.Column('dispatched_at', sa.DateTime(), nullable=True),
        sa.Column('arrived_at', sa.DateTime(), nullable=True),
        sa.Column('resolved_at', sa.DateTime(), nullable=True),
        sa.Column('operator_verdict', sa.Text(), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('incident_sha', sa.String(), nullable=False),
        sa.Column('reasoning_report', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('sop_actions', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='[]'),
        sa.Column('emotional_analysis', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('human_intervention', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('supervising_release', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('closing_report', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('event_timeline', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='[]'),
        sa.Column('transcript', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='[]'),
    )
    op.create_index(op.f('ix_historical_reports_id'), 'historical_reports', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_historical_reports_id'), table_name='historical_reports')
    op.drop_table('historical_reports')
