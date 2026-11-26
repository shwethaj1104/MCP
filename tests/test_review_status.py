"""Verify that operational failures never remain labelled as running AI reviews."""

import asyncio
from types import SimpleNamespace
from unittest.mock import Mock
from fastapi.testclient import TestClient
import apps.host.main as host
from packages.db import initialize, Session, Case, Job, now


# Preserve the business workflow while projecting an accurate runtime state to both API views.
def test_payload_distinguishes_review_states(monkeypatch):
    case = SimpleNamespace(id="STATUS", status="AI Review in Progress")
    monkeypatch.setattr(
        host, "serialize", lambda row: {"id": row.id, "status": row.status}
    )
    db = Mock()
    for state, label in [
        ("queued", "AI Review Queued"),
        ("running", "AI Review in Progress"),
        ("failed", "AI Review Failed"),
    ]:
        db.get.return_value = SimpleNamespace(state=state, action="start")
        monkeypatch.setattr(host, "model_ready", lambda: True)
        assert host.case_payload(db, case)["display_status"] == label
    monkeypatch.setattr(host, "model_ready", lambda: False)
    db.get.return_value = SimpleNamespace(state="queued", action="start")
    assert host.case_payload(db, case)["display_status"] == "AI Setup Required"
    db.get.return_value = SimpleNamespace(
        state="failed", action="resume", payload='{"action":"accept"}'
    )
    case.status = "Resolution Pending"
    assert host.case_payload(db, case)["display_status"] == "Resolution Pending"


# Persist a real worker failure and verify retry resets it to queued rather than claiming it is running.
def test_worker_failure_and_retry(monkeypatch):
    initialize()
    monkeypatch.setattr(host, "model_ready", lambda: True)
    with Session.begin() as db:
        for job in db.query(Job):
            job.state = "done"
        db.add(
            Case(
                id="STATUS-FAILURE",
                customer_id="customer-1",
                transaction_id="TX-1001",
                reason="Duplicate charge",
                description="Synthetic status regression case.",
                created=now(),
            )
        )
        db.flush()
        db.add(
            Job(case_id="STATUS-FAILURE", action="start", payload="{}", state="queued")
        )

    class FailedGraph:
        # Provide an empty initial graph checkpoint for this isolated worker test.
        async def aget_state(self, config):
            return SimpleNamespace(next=())

        # Reproduce a nested operational failure without contacting any model provider.
        async def ainvoke(self, value, config):
            raise ExceptionGroup("TaskGroup", [RuntimeError("Synthetic failure")])

    # Let the background worker reach its terminal failure and then stop the isolated task.
    async def exercise():
        task = asyncio.create_task(host.worker(FailedGraph()))
        try:
            for attempt in range(100):
                await asyncio.sleep(0.01)
                with Session() as db:
                    if db.get(Job, "STATUS-FAILURE").state == "failed":
                        return
            raise AssertionError("Worker did not record failure")
        finally:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

    asyncio.run(exercise())
    c = TestClient(host.app)
    data = c.get(
        "/api/cases/STATUS-FAILURE", headers={"X-Identity": "reviewer-1"}
    ).json()
    assert data["status"] == "AI Review Failed"
    assert data["display_status"] == "AI Review Failed"
    assert data["processing_state"] == "failed"
    response = c.post(
        "/api/cases/STATUS-FAILURE/actions",
        headers={"X-Identity": "reviewer-1"},
        json={"action": "retry", "version": data["version"]},
    )
    assert response.status_code == 200
    data = c.get(
        "/api/cases/STATUS-FAILURE", headers={"X-Identity": "reviewer-1"}
    ).json()
    assert data["status"] == "AI Review Queued"
    assert data["display_status"] == "AI Review Queued"
    assert data["error"] is None
