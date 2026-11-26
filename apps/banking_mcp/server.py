"""Read-only banking evidence tools exposed through MCP stdio."""

from mcp.server.fastmcp import FastMCP
from packages.db import Session, Transaction, Case, Record

mcp = FastMCP("Banking evidence")


@mcp.tool()
def get_transaction_details(transaction_id: str, customer_id: str) -> dict:
    """Retrieve a transaction only within the supplied customer boundary."""
    with Session() as db:
        tx = db.get(Transaction, transaction_id)
        if not tx or tx.customer_id != customer_id:
            return {"error": "Transaction unavailable"}
        return {
            key: getattr(tx, key)
            for key in [
                "id",
                "merchant",
                "amount",
                "currency",
                "date",
                "reversed",
                "account_id",
            ]
        }


@mcp.tool()
def get_related_transactions(transaction_id: str, customer_id: str) -> list:
    """Retrieve same-merchant transactions owned by the customer."""
    target = get_transaction_details(transaction_id, customer_id)
    if "error" in target:
        return []
    with Session() as db:
        return [
            get_transaction_details(tx.id, customer_id)
            for tx in db.query(Transaction)
            .filter_by(customer_id=customer_id, merchant=target["merchant"])
            .all()
        ]


@mcp.tool()
def find_possible_duplicates(transaction_id: str, customer_id: str) -> dict:
    """Find same-day same-amount merchant matches without declaring fraud."""
    target = get_transaction_details(transaction_id, customer_id)
    matches = [
        tx
        for tx in get_related_transactions(transaction_id, customer_id)
        if tx["id"] != transaction_id
        and tx["amount"] == target.get("amount")
        and tx["date"] == target.get("date")
    ]
    return {
        "possible_duplicates": matches,
        "note": "Matches are evidence, not proof of an erroneous charge.",
    }


@mcp.tool()
def get_existing_reversals(transaction_id: str, customer_id: str) -> dict:
    """Check whether the selected transaction is already reversed."""
    tx = get_transaction_details(transaction_id, customer_id)
    if "error" in tx:
        return tx
    return {"transaction_id": transaction_id, "reversed": tx.get("reversed", False)}


@mcp.tool()
def get_dispute_policy(reason: str) -> dict:
    """Return the fictional demonstration policy relevant to the claim."""
    return {
        "reference": "DEMO-POLICY-01",
        "reason": reason,
        "policy": "Investigate evidence; duplicate matches are not conclusive. Never credit an already reversed charge. Proposed credit must not exceed the disputed transaction. Missing evidence requires a customer information request. Human approval and explicit customer consent are required. This is a fictional demo policy.",
    }


@mcp.tool()
def get_case_evidence(case_id: str, customer_id: str) -> dict:
    """Retrieve the customer statement and supporting case responses."""
    with Session() as db:
        case = db.get(Case, case_id)
        if not case or case.customer_id != customer_id:
            return {"error": "Case unavailable"}
        return {
            "statement": case.description,
            "reason": case.reason,
            "responses": [
                r.body
                for r in db.query(Record)
                .filter_by(case_id=case_id)
                .filter(Record.kind.in_(["evidence", "customer_response"]))
                .all()
            ],
        }


if __name__ == "__main__":
    mcp.run(transport="stdio")
