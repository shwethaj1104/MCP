"""Free-only OpenRouter configuration and OpenAI-compatible request boundary."""

import asyncio
import os
from openai import OpenAI


# Read only the OpenRouter credential; never reuse the former OpenAI key at a new destination.
def model_ready():
    return bool(os.getenv("OPENROUTER_API_KEY", "").strip())


# Restrict the application to the free router or explicitly free model variants.
def model_name():
    model = os.getenv("OPENROUTER_MODEL", "openrouter/free").strip()
    if model != "openrouter/free" and not model.endswith(":free"):
        raise ValueError("Only free OpenRouter models are allowed")
    return model


# Construct a client pinned to OpenRouter, with an optional local transport for tests.
def make_model_client(http_client=None):
    if not model_ready():
        raise ValueError("OpenRouter API key is not configured")
    return OpenAI(
        api_key=os.environ["OPENROUTER_API_KEY"].strip(),
        base_url="https://openrouter.ai/api/v1",
        timeout=90,
        max_retries=0,
        http_client=http_client,
        default_headers={"X-OpenRouter-Title": "ResolveDesk Local"},
    )


# Request tool calls or a strict report only from compatible zero-price provider endpoints.
async def model_turn(client, messages, tools, schema, require_tools=False):
    arguments = {
        "model": model_name(),
        "messages": messages,
        "max_tokens": 4096,
        "extra_body": {
            "provider": {
                "require_parameters": True,
                "max_price": {"prompt": 0, "completion": 0},
            }
        },
    }
    if tools:
        arguments["tools"] = tools
        if require_tools:
            arguments["tool_choice"] = "required"
    if schema is not None:
        arguments["response_format"] = {
            "type": "json_schema",
            "json_schema": {"name": "investigation", "strict": True, "schema": schema},
        }
    return await asyncio.wait_for(
        asyncio.to_thread(client.chat.completions.create, **arguments), timeout=90
    )
