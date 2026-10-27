"""Test-only subprocess: genuine MAF worker with an in-memory Responses provider.

There is deliberately no mock switch in the production worker or run protocol.
Invoke this module explicitly from integration tests that need the real JSONL IPC.
"""

from __future__ import annotations

import asyncio
import json

import httpx2 as httpx

from agent_runtime import worker  # Disables logging before provider execution.
from agent_runtime import runtime
from .test_runtime import function, response, text

request_count = 0


def _context(body):
    for item in body["input"]:
        if item.get("role") != "user":
            continue
        content = item.get("content", [])
        raw = content if isinstance(content, str) else "".join(part.get("text", "") for part in content)
        try:
            payload = json.loads(raw)
        except (ValueError, TypeError):
            continue
        if isinstance(payload, dict) and isinstance(payload.get("selected_context"), dict):
            return payload["selected_context"]
    raise AssertionError("Missing selected_context in native MAF request")


async def fake_responses(request):
    global request_count
    request_count += 1
    body = json.loads(request.content)
    results = [json.loads(item["output"]) for item in body["input"] if item.get("type") == "function_call_output"]
    latest = results[-1] if results else None
    if latest is None:
        selected = _context(body)
        output = [function("analyze_window", {"player_id": selected["player_id"], "start_time": selected["earliest_time"], "end_time": selected["as_of_time"]}, "call_fixture_analysis")]
    elif "claims" not in latest:
        output = [function("get_evidence", {"evidence_ids": []}, "call_fixture_evidence")]
    else:
        claim = next((claim for claim in latest["claims"] if claim.get("kind") == "current"), None)
        if claim is None:
            claim = next(claim for claim in latest["claims"] if claim.get("kind") != "limits")
        output = [text({"claim_ids": [claim["id"]], "evidence_ids": claim["evidence_ids"], "overlay_type": claim.get("overlay_type", "none")})]
    return httpx.Response(200, json=response(output, f"resp_process_fixture_{request_count}"))


RealAgentRuntime = runtime.AgentRuntime


def injected_runtime(config, credentials, channel):
    return RealAgentRuntime(config, credentials, channel, transport=httpx.MockTransport(fake_responses))


if __name__ == "__main__":
    runtime.AgentRuntime = injected_runtime
    raise SystemExit(asyncio.run(worker.main()))
