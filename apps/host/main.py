"""HTTP API and durable single-worker orchestration for the local workbench."""

import asyncio
import json
import os
import uuid
from sqlalchemy import text
from contextlib import asynccontextmanager
from typing import Literal
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver
from langgraph.types import Command
from packages.db import (
    Session,
    Identity,
    Transaction,
    Case,
    Record,
    Job,
    Resolution,
    initialize,
    audit,
    now,
)
from apps.host.workflow import build_graph
from apps.host.errors import failure_message
from apps.host.model_client import model_ready


class Submission(BaseModel):
    transaction_id: str
    reason: str = Field(min_length=3, max_length=100)
    description: str = Field(min_length=10, max_length=10000)
    evidence: str = Field(default="", max_length=100000)

    @field_validator("evidence")
    @classmethod
    def validate_evidence(cls, value):
        """Reject supporting text larger than the SQLite evidence allowance."""
        if len(value.encode("utf-8")) > 100000:
            raise ValueError("Evidence must be at most 100 KB of UTF-8 text")
        return value


class Action(BaseModel):
    action: Literal[
        "approve",
        "rerun",
        "request_information",
        "accept",
        "disagree",
        "provide_information",
        "retry",
    ]
    version: int
    feedback: str = Field(default="", max_length=100000)


def serialize(row):
    """Convert a database record to an API-safe dictionary."""
    return {column.name: getattr(row, column.name) for column in row.__table__.columns}


def identity(db, actor):
    """Validate the explicit demo identity supplied by the interface."""
    user = db.get(Identity, actor)
    if not user:
        raise HTTPException(401, "Select a demo identity")
    return user


def accessible(db, case_id, actor):
    """Apply role and customer-ownership checks before reading a case."""
    user = identity(db, actor)
    case = db.get(Case, case_id)
    if not case or (user.role == "customer" and case.customer_id != user.id):
        raise HTTPException(404, "Case not found")
    return user, case


def enqueue(db, case_id, action, payload):
    """Persist one queued operation for a dispute."""
    existing = db.get(Job, case_id)
    if existing and existing.state in ("queued", "running"):
        raise HTTPException(409, "An operation is already pending")
    if existing:
        db.delete(existing)
        db.flush()
    db.add(
        Job(case_id=case_id, action=action, payload=json.dumps(payload), state="queued")
    )


def is_analysis_job(job):
    """Identify investigations and reanalysis without classifying settlement as AI work."""
    if job.action == "start":
        return True
    try:
        return json.loads(getattr(job, "payload", "{}")).get("action") == "rerun"
    except (TypeError, ValueError, AttributeError):
        return False


async def worker(graph):
    """Process persisted jobs serially and recover interrupted work on restart."""
    while True:
        job_data = None
        with Session.begin() as db:
            pending = db.query(Job).filter_by(state="queued")
            job = next(
                (
                    candidate
                    for candidate in pending
                    if model_ready() or not is_analysis_job(candidate)
                ),
                None,
            )
            if job:
                job.state = "running"
                case = db.get(Case, job.case_id)
                if is_analysis_job(job):
                    if case.status != "AI Review in Progress":
                        audit(db, case.id, "status", "System", "AI Review in Progress")
                    case.status = "AI Review in Progress"
                job_data = (job.case_id, job.action, json.loads(job.payload))
        if not job_data:
            await asyncio.sleep(1)
            continue
        case_id, action, payload = job_data
        config = {"configurable": {"thread_id": case_id}}
        try:
            snapshot = await graph.aget_state(config)
            if action == "start":
                await graph.ainvoke(
                    None if snapshot.next else {"case_id": case_id, "feedback": ""},
                    config,
                )
            else:
                previous = snapshot.values.get("decision", {})
                if previous.get("version") == payload.get("version") and previous.get(
                    "action"
                ) == payload.get("action"):
                    # Continue unfinished graph work without repeating a consumed human response.
                    if snapshot.next and snapshot.next[0] == "analyse":
                        await graph.ainvoke(None, config)
                else:
                    await graph.ainvoke(Command(resume=payload), config)
            with Session.begin() as db:
                case = db.get(Case, case_id)
                if action == "resume" and payload.get("action") == "accept":
                    final_snapshot = await graph.aget_state(config)
                    if final_snapshot.next:
                        raise ValueError("Customer consent did not complete the graph")
                    case.status = "Resolution Pending"
                    report = json.loads(case.report)
                    if not db.get(Resolution, case_id):
                        db.add(
                            Resolution(
                                case_id=case_id,
                                amount=report["amount"],
                                outcome=report["outcome"],
                            )
                        )
                        audit(
                            db,
                            case_id,
                            "resolution",
                            "System",
                            "Simulated resolution completed; no real funds moved.",
                        )
                    case.status = "Closed"
                    audit(
                        db,
                        case_id,
                        "notification",
                        "System",
                        "Final outcome is available in the customer portal.",
                    )
                case.error = None
                db.get(Job, case_id).state = "done"
        except Exception as exc:
            with Session.begin() as db:
                case = db.get(Case, case_id)
                case.error = failure_message(exc)
                failed_job = db.get(Job, case_id)
                failed_job.state = "failed"
                if is_analysis_job(failed_job):
                    case.status = "AI Review Failed"
                    audit(db, case_id, "status", "System", "AI Review Failed")
                case.version += 1
                audit(db, case_id, "error", "System", case.error)
        await asyncio.sleep(0)


@asynccontextmanager
async def lifespan(app):
    """Open the persistent graph and run the recoverable local worker."""
    initialize()
    with Session.begin() as db:
        for job in db.query(Job).filter_by(state="running"):
            job.state = "queued"
    async with AsyncSqliteSaver.from_conn_string(
        os.getenv("CHECKPOINT_DB_PATH", "data/checkpoints.db")
    ) as saver:
        graph = build_graph(saver)
        task = asyncio.create_task(worker(graph))
        yield
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass


app = FastAPI(title="ResolveDesk Dispute Workbench", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    """Expose model readiness without leaking configuration secrets."""
    return {
        "configured": bool(model_ready()),
        "model": os.getenv("OPENROUTER_MODEL", "openrouter/free"),
        "provider": "OpenRouter",
        "mode": "Live OpenRouter free models · simulated banking",
    }


@app.get("/api/identities")
def identities():
    """List the seeded identities available in the local demonstration."""
    with Session() as db:
        return [serialize(user) for user in db.query(Identity)]


@app.get("/api/accounts")
def accounts(x_identity: str = Header(default="customer-1")):
    """List account references visible to the selected demonstration identity."""
    with Session() as db:
        user = identity(db, x_identity)
        query = db.query(Transaction)
        if user.role == "customer":
            query = query.filter_by(customer_id=user.id)
        visible = {}
        for tx in query:
            visible.setdefault(
                tx.account_id,
                {
                    "id": tx.account_id,
                    "customer_id": tx.customer_id,
                    "currency": tx.currency,
                },
            )
        return list(visible.values())


@app.get("/api/transactions")
def transactions(x_identity: str = Header(default="customer-1")):
    """List transactions within the selected demo identity's permissions."""
    with Session() as db:
        user = identity(db, x_identity)
        query = db.query(Transaction)
        if user.role == "customer":
            query = query.filter_by(customer_id=user.id)
        return [serialize(tx) for tx in query]


def case_payload(db, case):
    """Expose authoritative AI runtime status independently of the business workflow stage."""
    payload = serialize(case)
    job = db.get(Job, case.id)
    state = job.state if job else None
    analysis = job is not None and is_analysis_job(job)
    if analysis and state == "queued" and not model_ready():
        state = "awaiting_configuration"
    payload["processing_state"] = state
    review_state = None
    if analysis:
        review_state = {
            "failed": "failed",
            "running": "running",
            "queued": "queued",
            "awaiting_configuration": "awaiting_configuration",
            "done": "completed",
        }.get(state)
    payload["ai_review_state"] = review_state
    payload["display_status"] = {
        "failed": "AI Review Failed",
        "running": "AI Review in Progress",
        "queued": "AI Review Queued",
        "awaiting_configuration": "AI Setup Required",
    }.get(review_state, case.status)
    return payload


@app.get("/api/cases")
def cases(x_identity: str = Header(default="customer-1")):
    """List owned disputes or the bank reviewer's full case queue."""
    with Session() as db:
        user = identity(db, x_identity)
        query = db.query(Case)
        if user.role == "customer":
            query = query.filter_by(customer_id=user.id)
        return [case_payload(db, case) for case in query.order_by(Case.created.desc())]


@app.get("/api/cases/{case_id}")
def detail(case_id: str, x_identity: str = Header(default="customer-1")):
    """Read a case with its permitted report and chronological history."""
    with Session() as db:
        user, case = accessible(db, case_id, x_identity)
        result = case_payload(db, case)
        resolution = db.get(Resolution, case_id)
        result["resolution"] = serialize(resolution) if resolution else None
        records = db.query(Record).filter_by(case_id=case_id).order_by(Record.id).all()
        if user.role == "customer":
            records = [
                r
                for r in records
                if r.kind not in ("tool", "report", "reviewer_feedback")
            ]
            result["report"] = "{}"
        result["records"] = [serialize(r) for r in records]
        if user.role == "customer":
            for record in result["records"]:
                if record["kind"] == "proposal":
                    proposal = json.loads(record["body"])
                    proposal["report"] = {
                        key: proposal.get("report", {}).get(key)
                        for key in ("outcome", "amount", "explanation")
                    }
                    record["body"] = json.dumps(proposal)
        result["transaction"] = serialize(db.get(Transaction, case.transaction_id))
        return result


@app.post("/api/cases", status_code=201)
def submit(body: Submission, x_identity: str = Header(default="customer-1")):
    """Save a customer dispute and durably queue its live investigation."""
    with Session.begin() as db:
        user = identity(db, x_identity)
        tx = db.get(Transaction, body.transaction_id)
        if user.role != "customer" or not tx or tx.customer_id != user.id:
            raise HTTPException(403, "Choose your own transaction")
        case_id = "DSP-" + uuid.uuid4().hex[:8].upper()
        case = Case(
            id=case_id,
            customer_id=user.id,
            transaction_id=tx.id,
            reason=body.reason,
            description=body.description,
            status="Submitted",
            created=now(),
        )
        db.add(case)
        db.flush()
        audit(db, case_id, "submitted", user.name, body.description)
        if body.evidence:
            audit(db, case_id, "evidence", user.name, body.evidence)
        enqueue(db, case_id, "start", {})
        return serialize(case)


@app.post("/api/cases/{case_id}/actions")
def act(case_id: str, body: Action, x_identity: str = Header(default="customer-1")):
    """Validate versioned human decisions and queue graph resumption atomically."""
    with Session.begin() as db:
        db.execute(text("BEGIN IMMEDIATE"))
        user, case = accessible(db, case_id, x_identity)
        if case_id.startswith("FIXTURE-"):
            raise HTTPException(
                409,
                "Read-only UI fixture. Submit a new dispute to run the live workflow.",
            )
        if case.version != body.version:
            raise HTTPException(409, "Case changed; refresh before taking action")
        job = db.get(Job, case_id)
        if job and job.state in ("queued", "running"):
            raise HTTPException(409, "An operation is already pending")
        if job and job.state == "failed" and body.action != "retry":
            raise HTTPException(
                409, "Retry the failed workflow operation before taking another action"
            )
        if body.action == "retry":
            if user.role != "reviewer" or not job or job.state != "failed":
                raise HTTPException(409, "No failed operation to retry")
            job.state = "queued"
            case.error = None
            if is_analysis_job(job):
                case.status = "AI Review Queued"
                audit(db, case_id, "status", user.name, "AI Review Queued")
            case.version += 1
            return {"ok": True}
        if user.role == "reviewer" and case.status == "Under Bank Review":
            if body.action not in ("approve", "rerun", "request_information"):
                raise HTTPException(400, "Invalid reviewer action")
            if body.action != "approve" and len(body.feedback.strip()) < 5:
                raise HTTPException(422, "Explain the requested changes")
            report = json.loads(case.report)
            if not report:
                raise HTTPException(409, "No report is available")
            if body.action == "rerun":
                case.status = "AI Review Queued"
                audit(db, case_id, "reviewer_feedback", user.name, body.feedback)
            else:
                case.status = "Awaiting Customer Consent"
                audit(
                    db,
                    case_id,
                    "proposal",
                    user.name,
                    json.dumps(
                        {
                            "type": (
                                "information"
                                if body.action == "request_information"
                                else "resolution"
                            ),
                            "report": report,
                            "message": body.feedback,
                            "version": case.version + 1,
                        }
                    ),
                )
            enqueue(db, case_id, "resume", body.model_dump())
        elif user.role == "customer" and case.status == "Awaiting Customer Consent":
            proposals = (
                db.query(Record)
                .filter_by(case_id=case_id, kind="proposal")
                .order_by(Record.id.desc())
                .first()
            )
            proposal = json.loads(proposals.body)
            allowed = (
                ["provide_information"]
                if proposal["type"] == "information"
                else ["accept", "disagree"]
            )
            if body.action not in allowed:
                raise HTTPException(400, "Response does not match the request")
            if body.action != "accept" and len(body.feedback.strip()) < 5:
                raise HTTPException(422, "Please provide your response")
            case.status = (
                "Resolution Pending" if body.action == "accept" else "Under Bank Review"
            )
            audit(
                db,
                case_id,
                "consent" if body.action == "accept" else "customer_response",
                user.name,
                json.dumps(
                    {
                        "action": body.action,
                        "message": body.feedback,
                        "proposal_version": proposal["version"],
                    }
                ),
            )
            enqueue(db, case_id, "resume", body.model_dump())
        else:
            raise HTTPException(
                409, "This action is unavailable for your role or case status"
            )
        case.version += 1
        return {"ok": True}
