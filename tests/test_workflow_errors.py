"""Regression coverage for strict reports and safe task-group error reporting."""

import pytest
import httpx
from pydantic import ValidationError
from openai import AuthenticationError, RateLimitError
from apps.host.workflow import Report
from apps.host.errors import failure_message


# Keep the report schema compatible with strict OpenAI structured outputs.
def test_report_schema_has_closed_enum():
    schema = Report.model_json_schema()
    assert schema["additionalProperties"] is False
    assert schema["properties"]["outcome"]["enum"] == [
        "Approved",
        "Partially Approved",
        "Rejected",
    ]
    assert set(schema["required"]) == set(schema["properties"])


# Reject prose in the outcome field instead of silently guessing an approval decision.
def test_prose_outcome_is_not_an_approval():
    with pytest.raises(ValidationError) as captured:
        Report(
            summary="Test",
            evidence_references=[],
            completed_checks=[],
            missing_information=[],
            outcome="Further information is needed before any refund",
            amount=0,
            explanation="Test",
        )
    message = failure_message(
        ExceptionGroup("Task group", [ExceptionGroup("Nested", [captured.value])])
    )
    assert "required format" in message
    assert "ExceptionGroup" not in message
    assert "Further information" not in message


# Distinguish quota exhaustion from transient request throttling.
def test_nested_quota_error_is_actionable():
    response = httpx.Response(
        429, request=httpx.Request("POST", "https://api.openai.com/v1/responses")
    )
    error = RateLimitError(
        "secret raw provider body",
        response=response,
        body={"code": "insufficient_quota"},
    )
    assert "quota" in failure_message(ExceptionGroup("wrapper", [error]))
    assert "secret" not in failure_message(error)


# Never expose an API key even when the provider repeats it in an authentication error.
def test_authentication_error_does_not_leak_credentials():
    response = httpx.Response(
        401, request=httpx.Request("POST", "https://api.openai.com/v1/responses")
    )
    error = AuthenticationError(
        "Incorrect API key: sk-test-secret-value",
        response=response,
        body={"code": "invalid_api_key"},
    )
    message = failure_message(error)
    assert "authentication failed" in message
    assert "sk-test-secret-value" not in message


# Let clients distinguish an idle human checkpoint from an active or failed background job.
def test_case_payload_exposes_job_state(monkeypatch):
    from types import SimpleNamespace
    from unittest.mock import Mock
    import apps.host.main as host

    case = SimpleNamespace(id="C1", status="AI Review in Progress")
    monkeypatch.setattr(host, "serialize", lambda row: {"id": row.id})
    db = Mock()
    db.get.return_value = SimpleNamespace(state="failed", action="start")
    assert host.case_payload(db, case)["processing_state"] == "failed"
    db.get.return_value = SimpleNamespace(state="done", action="resume")
    assert host.case_payload(db, case)["processing_state"] == "done"
    db.get.return_value = SimpleNamespace(state="queued", action="start")
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    assert host.case_payload(db, case)["processing_state"] == "awaiting_configuration"
