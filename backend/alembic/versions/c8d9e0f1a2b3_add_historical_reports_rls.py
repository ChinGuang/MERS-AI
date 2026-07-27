"""add historical reports RLS policy

Revision ID: c8d9e0f1a2b3
Revises: h1a2b3c4d5e6
Create Date: 2026-07-25 22:15:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "c8d9e0f1a2b3"
down_revision: Union[str, Sequence[str], None] = "h1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE public.historical_reports ENABLE ROW LEVEL SECURITY")
    op.execute(
        'DROP POLICY IF EXISTS "Enable read access for all users" '
        "ON public.historical_reports"
    )
    op.execute("REVOKE SELECT ON TABLE public.historical_reports FROM anon")
    op.execute("GRANT SELECT ON TABLE public.historical_reports TO authenticated")
    op.execute(
        """
        CREATE POLICY historical_reports_authenticated_select
        ON public.historical_reports
        FOR SELECT
        TO authenticated
        USING (true)
        """
    )


def downgrade() -> None:
    op.execute(
        "DROP POLICY IF EXISTS historical_reports_authenticated_select "
        "ON public.historical_reports"
    )
    op.execute("REVOKE SELECT ON TABLE public.historical_reports FROM authenticated")
