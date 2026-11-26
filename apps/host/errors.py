"""Safe operational explanations for nested model and banking-tool failures."""

import json
from pydantic import ValidationError
from openai import (
    AuthenticationError,
    PermissionDeniedError,
    NotFoundError,
    RateLimitError,
    APITimeoutError,
    APIConnectionError,
    BadRequestError,
    APIStatusError,
)
from mcp.shared.exceptions import McpError


# Unwrap task-group failures while keeping the original exceptions available for classification.
def leaf_errors(error: BaseException) -> list[BaseException]:
    if isinstance(error, BaseExceptionGroup):
        return [leaf for child in error.exceptions for leaf in leaf_errors(child)]
    return [error]


# Explain the root cause without persisting raw provider bodies, user evidence or credentials.
def failure_message(error: BaseException) -> str:
    messages = []
    for cause in leaf_errors(error):
        if isinstance(cause, AuthenticationError):
            message = "OpenRouter authentication failed. Check OPENROUTER_API_KEY in .env and restart the backend."
        elif isinstance(cause, PermissionDeniedError):
            message = "OpenRouter access was denied. Check the project key permissions and free-model availability."
        elif isinstance(cause, NotFoundError):
            message = "No compatible free model endpoint is available. Check OPENROUTER_MODEL and retry later."
        elif isinstance(cause, RateLimitError):
            body = getattr(cause, "body", None)
            code = getattr(cause, "code", None)
            if isinstance(body, dict):
                code = (
                    body.get("code")
                    or (
                        body.get("error", {}).get("code")
                        if isinstance(body.get("error"), dict)
                        else code
                    )
                    or code
                )
            message = (
                "OpenRouter free-model quota is unavailable. Check the account limits and retry after they reset."
                if code == "insufficient_quota"
                else "OpenRouter free-model request limit reached. Wait for the rate or daily limit to reset, then retry."
            )
        elif isinstance(cause, APITimeoutError):
            message = "The OpenRouter request timed out. Retry the investigation."
        elif isinstance(cause, APIConnectionError):
            message = "Could not connect to OpenRouter. Check the network connection and retry."
        elif isinstance(cause, TimeoutError):
            message = "AI review exceeded the processing time limit. The case is preserved; retry later or choose another free model."
        elif isinstance(cause, ValidationError):
            message = "The model returned a report that did not match the required format. Retry the investigation."
        elif isinstance(cause, json.JSONDecodeError):
            message = "The model returned invalid JSON for a tool request. Retry the investigation."
        elif isinstance(cause, BadRequestError):
            message = "OpenRouter rejected the request format or model settings. Check the backend model configuration."
        elif isinstance(cause, APIStatusError):
            message = "OpenRouter could not complete the request. Check account and free-model availability, then retry."
        elif isinstance(cause, McpError):
            message = (
                "The banking-tool connection failed. Restart the backend and retry."
            )
        elif isinstance(cause, ValueError) and str(cause) in (
            "Proposed amount conflicts with transaction evidence",
            "Analysis exceeded 12 tool calls",
            "Analysis did not produce a valid report",
            "Model did not complete a report",
            "OpenRouter API key is not configured",
            "Only free OpenRouter models are allowed",
            "Required banking tools are unavailable",
            "Banking tool failed",
        ):
            message = (
                str(cause) + ". The case is preserved; review the evidence or retry."
            )
        else:
            message = "Investigation could not finish because of an internal workflow error. The case is preserved; retry or contact the developer."
        if message not in messages:
            messages.append(message)
    return " ".join(messages)
