"""Apply versioned SQLite schema migrations."""

from alembic import context
from packages.db import Base, engine


# Run migrations against the configured local SQLite database.
def run():
    with engine.connect() as connection:
        context.configure(
            connection=connection, target_metadata=Base.metadata, render_as_batch=True
        )
        with context.begin_transaction():
            context.run_migrations()


run()

# What happened?	I made one purchase at Studio Supply for AED 485, but I can see two identical charges on the same day. Please investigate the duplicate.
# Supporting evidence	Test receipt: one purchase from Studio Supply, total AED 485.00.