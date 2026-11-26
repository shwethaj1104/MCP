"""OpenRouter free-only routing and real SDK request-contract tests without external calls."""

import asyncio
import json
import httpx
import pytest
from apps.host.model_client import (
    make_model_client,
    model_name,
    model_ready,
    model_turn,
)
from apps.host.workflow import Report


# Never use the old OpenAI credential when the OpenRouter key is absent.
def test_old_key_does_not_enable_router(monkeypatch):
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    monkeypatch.setenv("OPENAI_API_KEY", "old-key-must-not-be-used")
    assert not model_ready()
    with pytest.raises(ValueError, match="not configured"):
        make_model_client()


# Block paid models before issuing any network request.
def test_paid_models_are_rejected(monkeypatch):
    monkeypatch.setenv("OPENROUTER_MODEL", "openai/gpt-4.1-mini")
    with pytest.raises(ValueError, match="Only free"):
        model_name()
    monkeypatch.setenv("OPENROUTER_MODEL", "example/model:free")
    assert model_name() == "example/model:free"


# Verify the actual serialized SDK request is pinned to free, schema-capable OpenRouter endpoints.
def test_router_request_contract(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "synthetic-router-key")
    monkeypatch.setenv("OPENAI_API_KEY", "unused-previous-key")
    monkeypatch.setenv("OPENROUTER_MODEL", "openrouter/free")
    captured = []

    # Respond locally without transmitting the test prompt or credentials.
    def respond(request):
        captured.append(request)
        return httpx.Response(
            200,
            json={
                "id": "test",
                "object": "chat.completion",
                "created": 1,
                "model": "synthetic/model:free",
                "choices": [
                    {
                        "index": 0,
                        "finish_reason": "stop",
                        "message": {
                            "role": "assistant",
                            "content": json.dumps(
                                {
                                    "summary": "Test",
                                    "evidence_references": [],
                                    "completed_checks": [],
                                    "missing_information": [],
                                    "outcome": "Rejected",
                                    "amount": 0,
                                    "explanation": "Test",
                                }
                            ),
                        },
                    }
                ],
            },
        )

    with make_model_client(
        httpx.Client(transport=httpx.MockTransport(respond))
    ) as client:
        result = asyncio.run(
            model_turn(
                client,
                [{"role": "user", "content": "Synthetic request"}],
                [],
                Report.model_json_schema(),
            )
        )
    request = captured[0]
    payload = json.loads(request.content)
    assert str(request.url) == "https://openrouter.ai/api/v1/chat/completions"
    assert request.headers["Authorization"] == "Bearer synthetic-router-key"
    assert payload["model"] == "openrouter/free"
    assert payload["provider"] == {
        "require_parameters": True,
        "max_price": {"prompt": 0, "completion": 0},
    }
    assert payload["response_format"]["json_schema"]["strict"] is True
    assert (
        payload["response_format"]["json_schema"]["schema"]["additionalProperties"]
        is False
    )
    assert result.choices[0].finish_reason == "stop"


# Exercise the real MCP boundary with a locally mocked OpenRouter conversation and batched tool calls.
@pytest.mark.parametrize("native_tools", [True, False])
def test_router_tool_loop_keeps_case_scope(monkeypatch, native_tools):
    import apps.host.workflow as workflow
    from packages.db import Session, Case, initialize, now

    initialize()
    with Session.begin() as db:
        db.add(
            Case(
                id=f"MODEL-CONTRACT-{native_tools}",
                customer_id="customer-1",
                transaction_id="TX-1001",
                reason="Duplicate charge",
                description="Synthetic model contract test.",
                created=now(),
            )
        )
    monkeypatch.setenv("OPENROUTER_API_KEY", "synthetic-router-key")
    monkeypatch.setenv("OPENROUTER_MODEL", "openrouter/free")
    requests = []
    report = {
        "summary": "Synthetic report",
        "evidence_references": ["TX-1001"],
        "completed_checks": ["Transaction", "Reversals", "Policy", "Evidence"],
        "missing_information": [],
        "outcome": "Approved",
        "amount": 48500,
        "explanation": "Synthetic recommendation only",
    }
    tool_args = [
        (
            "get_transaction_details",
            {"transaction_id": "TX-2001", "customer_id": "customer-2"},
        ),
        (
            "get_existing_reversals",
            {"transaction_id": "TX-2001", "customer_id": "customer-2"},
        ),
        ("get_dispute_policy", {"reason": "Duplicate charge"}),
        ("get_case_evidence", {"case_id": "OTHER-CASE", "customer_id": "customer-2"}),
        (
            "find_possible_duplicates",
            {"transaction_id": "TX-2001", "customer_id": "customer-2"},
        ),
    ]

    # Supply deterministic SDK responses in memory without contacting a model service.
    def respond(request):
        body = json.loads(request.content)
        requests.append(body)
        if len(requests) == 1 and native_tools:
            message = {
                "role": "assistant",
                "content": None,
                "tool_calls": [
                    {
                        "id": f"call-{index}",
                        "type": "function",
                        "function": {"name": name, "arguments": json.dumps(args)},
                    }
                    for index, (name, args) in enumerate(tool_args)
                ],
            }
            finish = "tool_calls"
        else:
            message = {"role": "assistant", "content": json.dumps(report)}
            finish = "stop"
        return httpx.Response(
            200,
            json={
                "id": "test",
                "object": "chat.completion",
                "created": 1,
                "model": "synthetic/model:free",
                "choices": [{"index": 0, "finish_reason": finish, "message": message}],
            },
        )

    # Inject the local HTTP transport while preserving the production SDK and request builder.
    def factory():
        return make_model_client(httpx.Client(transport=httpx.MockTransport(respond)))

    monkeypatch.setattr(workflow, "make_model_client", factory)
    result = asyncio.run(workflow.investigate(f"MODEL-CONTRACT-{native_tools}", ""))
    assert result["amount"] == 48500
    assert len(requests) == 2
    assert "response_format" not in requests[0]
    assert requests[0]["tool_choice"] == "required"
    assert "tools" not in requests[1]
    assert requests[1]["response_format"]["json_schema"]["strict"] is True
    if not native_tools:
        evidence = next(message["content"] for message in requests[1]["messages"] if "workflow retrieved" in (message.get("content") or ""))
        assert "Studio Supply" in evidence
        assert "Synthetic model contract test." in evidence
        assert "Harbour Market" not in evidence
        return
    responses = [
        message for message in requests[1]["messages"] if message["role"] == "tool"
    ]
    assert len(responses) == 5
    assert "Studio Supply" in responses[0]["content"]
    assert "Harbour Market" not in responses[0]["content"]
    assert "Synthetic model contract test." in responses[3]["content"]
