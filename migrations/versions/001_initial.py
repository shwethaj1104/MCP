"""Create the initial dispute workbench schema."""

from alembic import op
from packages.db import Base

revision = "001"
down_revision = None


# Create the first version of application records.
def upgrade():
    Base.metadata.create_all(op.get_bind())


# Remove the first schema when explicitly rolling back a local migration.
def downgrade():
    Base.metadata.drop_all(op.get_bind())
