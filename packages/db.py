"""Shared SQLite persistence and deterministic demonstration records."""

import os
from datetime import datetime, timezone
from sqlalchemy import create_engine, event, Column, Integer, String, Text, ForeignKey
from sqlalchemy.orm import declarative_base, sessionmaker
from dotenv import load_dotenv

load_dotenv()
os.makedirs("data", exist_ok=True)
database_url = os.getenv("DATABASE_URL", "sqlite:///data/banking.db")
if not database_url.startswith("sqlite:///"):
    raise ValueError("This application supports SQLite only")
engine = create_engine(
    database_url,
    connect_args={"check_same_thread": False, "timeout": 15},
)
Base = declarative_base()
Session = sessionmaker(bind=engine, expire_on_commit=False)


@event.listens_for(engine, "connect")
def configure_sqlite(connection, record):
    """Enable foreign keys and durable concurrent SQLite access."""
    connection.execute("PRAGMA foreign_keys=ON")
    connection.execute("PRAGMA journal_mode=WAL")


class Identity(Base):
    __tablename__ = "identities"
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    role = Column(String, nullable=False)


class Transaction(Base):
    __tablename__ = "transactions"
    id = Column(String, primary_key=True)
    customer_id = Column(String, ForeignKey("identities.id"), nullable=False)
    account_id = Column(String, nullable=False)
    merchant = Column(String, nullable=False)
    amount = Column(Integer, nullable=False)
    currency = Column(String, default="AED")
    date = Column(String, nullable=False)
    reversed = Column(Integer, default=0)


class Case(Base):
    __tablename__ = "cases"
    id = Column(String, primary_key=True)
    customer_id = Column(String, ForeignKey("identities.id"), nullable=False)
    transaction_id = Column(String, ForeignKey("transactions.id"), nullable=False)
    reason = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    status = Column(String, default="Submitted")
    version = Column(Integer, default=1)
    report = Column(Text, default="{}")
    error = Column(Text, nullable=True)
    created = Column(String, nullable=False)


class Record(Base):
    __tablename__ = "records"
    id = Column(Integer, primary_key=True)
    case_id = Column(String, ForeignKey("cases.id"), nullable=False)
    kind = Column(String, nullable=False)
    actor = Column(String, nullable=False)
    body = Column(Text, nullable=False)
    created = Column(String, nullable=False)


class Job(Base):
    __tablename__ = "jobs"
    case_id = Column(String, ForeignKey("cases.id"), primary_key=True)
    action = Column(String, nullable=False)
    payload = Column(Text, default="{}")
    state = Column(String, default="queued")


class Resolution(Base):
    __tablename__ = "resolutions"
    case_id = Column(String, ForeignKey("cases.id"), primary_key=True)
    amount = Column(Integer, nullable=False)
    outcome = Column(String, nullable=False)


def now():
    """Return a timezone-aware audit timestamp."""
    return datetime.now(timezone.utc).isoformat()


def audit(db, case_id, kind, actor, body):
    """Append an immutable case-history entry."""
    db.add(Record(case_id=case_id, kind=kind, actor=actor, body=body, created=now()))


def initialize():
    """Create the schema and seed fictional identities and banking transactions."""
    Base.metadata.create_all(engine)
    with Session.begin() as db:
        if db.get(Identity, "customer-1"):
            return
        db.add_all(
            [
                Identity(id="customer-1", name="Shwetha J", role="customer"),
                Identity(id="customer-2", name="Omar Khalid", role="customer"),
                Identity(id="reviewer-1", name="Shwetha", role="reviewer"),
            ]
        )
        db.flush()
        entries = [
            ("TX-1001", "Studio Supply", 48500, 0),
            ("TX-1002", "Studio Supply", 48500, 0),
            ("TX-1003", "Cloudline Travel", 129000, 1),
            ("TX-1004", "North Coffee", 2800, 0),
            ("TX-1005", "Maison Home", 72000, 0),
        ]
        for tid, merchant, amount, reversed_flag in entries:
            db.add(
                Transaction(
                    id=tid,
                    customer_id="customer-1",
                    account_id="ACC-001",
                    merchant=merchant,
                    amount=amount,
                    date="2026-11-21",
                    reversed=reversed_flag,
                )
            )
        db.add(
            Transaction(
                id="TX-2001",
                customer_id="customer-2",
                account_id="ACC-002",
                merchant="Harbour Market",
                amount=15000,
                date="2026-11-20",
            )
        )
