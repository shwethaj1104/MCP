"""Behavioral tests for access boundaries, case actions, and durable graph pauses."""

import os
import tempfile

from fastapi.testclient import TestClient
from packages.db import initialize, Session, Case, Job, audit, now
from apps.host.main import app
import json


# Create an isolated API client without starting the live-model worker.
def client():
    initialize()
    return TestClient(app)


# Create a dispute as the default fictional customer.
def create_case(c):
    response = c.post(
        "/api/cases",
        json={
            "transaction_id": "TX-1001",
            "reason": "Duplicate charge",
            "description": "The same purchase was charged twice.",
        },
    )
    assert response.status_code == 201
    return response.json()


# Ensure customer boundaries cannot be bypassed by transaction or case identifiers.
def test_customer_isolation():
    c = client()
    case = create_case(c)
    assert (
        c.get(
            "/api/cases/" + case["id"], headers={"X-Identity": "customer-2"}
        ).status_code
        == 404
    )
    assert (
        c.post(
            "/api/cases",
            headers={"X-Identity": "customer-2"},
            json={
                "transaction_id": "TX-1001",
                "reason": "Duplicate",
                "description": "This is not my transaction",
            },
        ).status_code
        == 403
    )
    assert (
        c.get("/api/transactions", headers={"X-Identity": "customer-2"}).json()[0]["id"]
        == "TX-2001"
    )


# Ensure reviewer approvals are versioned and do not imply customer consent.
def test_approval_and_consent():
    c = client()
    case = create_case(c)
    with Session.begin() as db:
        row = db.get(Case, case["id"])
        row.status = "Under Bank Review"
        row.report = json.dumps(
            {
                "summary": "Evidence",
                "amount": 48500,
                "outcome": "Approved",
                "explanation": "Proposed demo credit",
            }
        )
        db.get(Job, row.id).state = "done"
    url = "/api/cases/" + case["id"] + "/actions"
    assert (
        c.post(
            url,
            headers={"X-Identity": "reviewer-1"},
            json={"action": "approve", "version": 0},
        ).status_code
        == 409
    )
    assert (
        c.post(
            url,
            headers={"X-Identity": "reviewer-1"},
            json={"action": "approve", "version": 1},
        ).status_code
        == 200
    )
    assert c.post(url, json={"action": "accept", "version": 2}).status_code == 409
    with Session.begin() as db:
        db.get(Job, case["id"]).state = "done"
    assert c.post(url, json={"action": "accept", "version": 2}).status_code == 200
    assert c.get("/api/cases/" + case["id"]).json()["status"] == "Resolution Pending"
    assert c.post(url, json={"action": "accept", "version": 2}).status_code == 409


# Ensure information requests require information rather than accepting consent.
def test_information_is_not_consent():
    c = client()
    case = create_case(c)
    with Session.begin() as db:
        row = db.get(Case, case["id"])
        row.status = "Awaiting Customer Consent"
        db.get(Job, row.id).state = "done"
        audit(
            db,
            row.id,
            "proposal",
            "reviewer",
            json.dumps(
                {
                    "type": "information",
                    "version": 1,
                    "message": "Please provide receipt",
                }
            ),
        )
    url = "/api/cases/" + case["id"] + "/actions"
    assert c.post(url, json={"action": "accept", "version": 1}).status_code == 400
    assert (
        c.post(
            url,
            json={
                "action": "provide_information",
                "version": 1,
                "feedback": "Here is the receipt text.",
            },
        ).status_code
        == 200
    )
    assert c.get("/api/cases/" + case["id"]).json()["status"] == "Under Bank Review"


# Verify MCP duplicate detection and reversed-charge evidence on seeded records.
def test_evidence_tools():
    initialize()
    from apps.banking_mcp.server import (
        find_possible_duplicates,
        get_existing_reversals,
        get_transaction_details,
    )

    assert (
        find_possible_duplicates("TX-1001", "customer-1")["possible_duplicates"][0][
            "id"
        ]
        == "TX-1002"
    )
    assert get_existing_reversals("TX-1003", "customer-1")["reversed"] == 1
    assert "error" in get_transaction_details("TX-1001", "customer-2")


# Verify the reviewer and customer interrupts survive graph reconstruction.
def test_durable_interrupts():
    from langgraph.graph import StateGraph, START, END
    from langgraph.checkpoint.sqlite import SqliteSaver
    from langgraph.types import Command
    from apps.host.workflow import State, review_node, customer_node, customer_route

    filename = tempfile.mktemp(suffix=".db")
    config = {"configurable": {"thread_id": "durability-test"}}
    with SqliteSaver.from_conn_string(filename) as saver:
        graph = StateGraph(State)
        graph.add_node("review", review_node)
        graph.add_node("customer", customer_node)
        graph.add_edge(START, "review")
        graph.add_edge("review", "customer")
        graph.add_conditional_edges("customer", customer_route)
        compiled = graph.compile(checkpointer=saver)
        compiled.invoke({"case_id": "TEST"}, config)
        assert compiled.get_state(config).next == ("review",)
        compiled.invoke(Command(resume={"action": "approve"}), config)
        assert compiled.get_state(config).next == ("customer",)
    with SqliteSaver.from_conn_string(filename) as saver:
        restored = graph.compile(checkpointer=saver)
        restored.invoke(Command(resume={"action": "disagree"}), config)
        assert restored.get_state(config).next == ("review",)


# Exercise real HTTP actions and persisted graph execution with a test-only model stub.
def test_full_workflow_worker(monkeypatch):
    import time
    import apps.host.workflow as workflow

    # Produce a deterministic report without contacting an external model during tests.
    async def model_stub(case_id, feedback):
        return {
            "summary": "Test investigation",
            "evidence_references": ["TX-1001"],
            "completed_checks": ["transaction"],
            "missing_information": [],
            "outcome": "Approved",
            "amount": 48500,
            "explanation": "Test-only proposed resolution",
        }

    monkeypatch.setattr(workflow, "investigate", model_stub)
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-only-not-a-real-key")
    initialize()
    with Session.begin() as db:
        # Isolate earlier endpoint-test jobs from this live-worker test.
        for job in db.query(Job):
            job.state = "done"

    # Poll the asynchronous worker until the expected application status is persisted.
    def await_status(c, cid, target):
        for attempt in range(100):
            result = c.get(
                "/api/cases/" + cid, headers={"X-Identity": "reviewer-1"}
            ).json()
            if result["status"] == target and not result["error"]:
                with Session() as db:
                    if db.get(Job, cid).state == "done":
                        return result
            time.sleep(0.05)
        raise AssertionError(result)

    with TestClient(app) as c:
        case = create_case(c)
        row = await_status(c, case["id"], "Under Bank Review")
        url = "/api/cases/" + case["id"] + "/actions"
        assert (
            c.post(
                url,
                headers={"X-Identity": "reviewer-1"},
                json={
                    "action": "rerun",
                    "version": row["version"],
                    "feedback": "Check reversal evidence again",
                },
            ).status_code
            == 200
        )
        row = await_status(c, case["id"], "Under Bank Review")
        assert len([r for r in row["records"] if r["kind"] == "report"]) == 2
        assert (
            c.post(
                url,
                headers={"X-Identity": "reviewer-1"},
                json={"action": "approve", "version": row["version"]},
            ).status_code
            == 200
        )
        row = await_status(c, case["id"], "Awaiting Customer Consent")
        assert (
            c.post(
                url,
                json={
                    "action": "disagree",
                    "version": row["version"],
                    "feedback": "Please review the amount again",
                },
            ).status_code
            == 200
        )
        row = await_status(c, case["id"], "Under Bank Review")
        assert (
            c.post(
                url,
                headers={"X-Identity": "reviewer-1"},
                json={"action": "approve", "version": row["version"]},
            ).status_code
            == 200
        )
        row = await_status(c, case["id"], "Awaiting Customer Consent")
        assert (
            c.post(
                url, json={"action": "accept", "version": row["version"]}
            ).status_code
            == 200
        )
        await_status(c, case["id"], "Closed")


# Verify SDK discovery and tool execution cross an actual stdio process boundary.
def test_mcp_transport():
    import asyncio
    import sys
    from mcp import ClientSession, StdioServerParameters
    from mcp.client.stdio import stdio_client

    initialize()

    # Connect a test MCP client to the same server command used by the host.
    async def exchange():
        params = StdioServerParameters(
            command=sys.executable,
            args=["-m", "apps.banking_mcp.server"],
            env={**os.environ},
        )
        async with stdio_client(params) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                listed = await session.list_tools()
                assert len(listed.tools) == 6
                result = await session.call_tool(
                    "get_transaction_details",
                    {"transaction_id": "TX-1001", "customer_id": "customer-1"},
                )
                assert not result.isError
                assert "Studio Supply" in str(result.content)

    asyncio.run(exchange())


# Prevent a new human decision from overtaking a failed graph operation.
def test_failed_operation_requires_retry():
    c = client()
    case = create_case(c)
    with Session.begin() as db:
        row = db.get(Case, case["id"])
        row.status = "Awaiting Customer Consent"
        db.get(Job, row.id).state = "failed"
    response = c.post(
        "/api/cases/" + case["id"] + "/actions", json={"action": "accept", "version": 1}
    )
    assert response.status_code == 409
    assert "Retry" in response.json()["detail"]
