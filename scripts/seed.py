"""Initialize demo records, with an explicit optional local-only reset."""

import argparse
import os
from pathlib import Path
from packages.db import (
    Base,
    engine,
    initialize,
    Session,
    Case,
    Resolution,
    audit,
    now,
)
import json


# Initialize the local schema and optionally add clearly labelled walkthrough fixtures.
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--reset-local-demo", action="store_true")
    parser.add_argument("--fixtures", action="store_true")
    args = parser.parse_args()
    if args.reset_local_demo:
        expected = Path(__file__).resolve().parents[1] / "data" / "banking.db"
        if Path(engine.url.database).resolve() != expected:
            parser.error(
                "Reset is restricted to this repository’s default data/banking.db"
            )
        Base.metadata.drop_all(engine)
        for filename in [
            "data/checkpoints.db",
            "data/checkpoints.db-wal",
            "data/checkpoints.db-shm",
        ]:
            if os.path.exists(filename):
                os.remove(filename)
    initialize()
    if args.fixtures:
        with Session.begin() as db:
            for index, (tid, status, reason) in enumerate(
                [
                    ("TX-1001", "Under Bank Review", "Duplicate charge"),
                    ("TX-1003", "Under Bank Review", "Charge already reversed"),
                    ("TX-1005", "Closed", "Incorrect amount"),
                ]
            ):
                cid = f"FIXTURE-{index+1:03}"
                if db.get(Case, cid):
                    continue
                report = {
                    "summary": "UI FIXTURE ONLY — not an AI-generated investigation. Submit a new case for live execution.",
                    "evidence_references": [tid, "DEMO-POLICY-01"],
                    "completed_checks": ["Static walkthrough fixture"],
                    "missing_information": [],
                    "outcome": (
                        "Rejected"
                        if index == 1
                        else "Partially Approved" if index == 2 else "Approved"
                    ),
                    "amount": 0 if index == 1 else 36000 if index == 2 else 48500,
                    "explanation": "UI fixture for viewing layout only. Do not action this case; create a new dispute to test the live graph.",
                }
                db.add(
                    Case(
                        id=cid,
                        customer_id="customer-1",
                        transaction_id=tid,
                        reason=reason,
                        description="UI fixture only: customer reports a problem with this transaction.",
                        status=status,
                        report=json.dumps(report),
                        created=now(),
                    )
                )
                db.flush()
                if status == "Closed":
                    db.add(
                        Resolution(
                            case_id=cid,
                            amount=report["amount"],
                            outcome=report["outcome"],
                        )
                    )
                audit(
                    db,
                    cid,
                    "submitted",
                    "Fixture generator",
                    "Static fixture for UI preview; not backed by a live workflow.",
                )
                audit(db, cid, "report", "Fixture generator", json.dumps(report))
        print(
            "UI fixtures created. They are read-only; submit new cases for live workflow testing."
        )
    print("SQLite database initialized.")


if __name__ == "__main__":
    main()
