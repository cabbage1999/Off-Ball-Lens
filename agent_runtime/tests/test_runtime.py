"""Integration tests run the installed MAF Agent + OpenAI provider, without network."""

from __future__ import annotations

import asyncio
from copy import deepcopy
import json
import logging

import httpx2 as httpx
import pytest

from agent_runtime.config import Credentials, RunConfig
from agent_runtime.protocol import RuntimeFailure, strict_json_loads
from agent_runtime.runtime import AgentRuntime, public_error_code

logging.disable(logging.CRITICAL)

ENDPOINT = "https://westus3.api.cognitive.microsoft.com/openai/v1/responses"
PLAN = {"claim_ids": ["C:current"], "evidence_ids": ["E:current"], "overlay_type": "receiving_heatmap"}
CONTEXT = {"scenarioId": "blocked", "player_id": "A7", "earliest_time": 0, "as_of_time": .8, "audience": "analyst", "language": "en"}
RUN = {"type": "run", "request_id": "test-request", "selected_context": CONTEXT, "question": "How did the receiving opportunity change?", "model": "gpt-5-mini", "endpoint": ENDPOINT, "deadline_ms": 40_000, "review": False}


def function(name, arguments, call_id):
    return {"type": "function_call", "id": "fc_" + call_id, "call_id": call_id, "name": name, "arguments": json.dumps(arguments), "status": "completed"}


def text(content):
    return {"type": "message", "id": "msg_fixture", "role": "assistant", "status": "completed", "content": [{"type": "output_text", "text": content if isinstance(content, str) else json.dumps(content), "annotations": [], "logprobs": []}]}


def response(output, response_id):
    return {
        "id": response_id, "object": "response", "created_at": 1_700_000_000,
        "status": "completed", "error": None, "incomplete_details": None,
        "instructions": None, "max_output_tokens": 1800, "model": "gpt-5-mini",
        "output": output, "parallel_tool_calls": False, "temperature": 1,
        "tool_choice": "auto", "tools": [], "top_p": 1, "metadata": {},
        "usage": {"input_tokens": 100, "output_tokens": 30, "total_tokens": 130,
                  "input_tokens_details": {"cached_tokens": 0}, "output_tokens_details": {"reasoning_tokens": 0}},
    }


def normal_steps(plan=PLAN):
    return [
        [function("analyze_window", {"player_id": "A7", "start_time": 0, "end_time": .8}, "call_analysis")],
        [function("get_evidence", {"evidence_ids": []}, "call_evidence")],
        [text(plan)],
    ]


class MemoryNode:
    def __init__(self, verdicts=(True,), mutate_result=None):
        self.sent = []
        self.inbox = asyncio.Queue()
        self.verdicts = iter(verdicts)
        self.mutate_result = mutate_result

    async def send(self, message):
        self.sent.append(deepcopy(message))
        if message["type"] == "tool_call":
            if message["name"] == "analyze_window":
                result = {"context": CONTEXT, "summary": {}, "available_evidence_ids": ["E:current"], "limitations": []}
            else:
                result = {"context": CONTEXT, "claims": [{"id": "C:current", "kind": "current", "evidence_ids": ["E:current"]}], "evidence": [{"id": "E:current", "status": "eligible", "das": 14}], "limitations": []}
            if self.mutate_result:
                result = self.mutate_result(message, result)
            await self.inbox.put({"type": "tool_result", "request_id": RUN["request_id"], "call_id": message["call_id"], "result": result})
        elif message["type"] == "candidate":
            accepted = next(self.verdicts)
            await self.inbox.put({"type": "validation", "request_id": RUN["request_id"], "accepted": accepted, "reason": "invalid_evidence_reference"})

    async def receive(self):
        return await self.inbox.get()


async def execute(steps, *, run=None, node=None, handler=None, credentials=None):
    node = node or MemoryNode()
    requests = []

    async def transport(request):
        requests.append(request)
        if handler:
            return await handler(request, len(requests))
        index = len(requests) - 1
        assert index < len(steps), "Unexpected provider request"
        payload = steps[index]
        if isinstance(payload, list):
            payload = response(payload, f"resp_fixture_{index + 1}")
        return httpx.Response(200, json=payload)

    runtime = AgentRuntime(RunConfig.parse(run or RUN), credentials or Credentials("test-secret-never-emit", False), node, transport=httpx.MockTransport(transport))
    error = None
    try:
        await runtime.run()
    except Exception as exc:
        error = exc
    return runtime, node, requests, error


def test_real_maf_native_tool_loop_and_origin_ids():
    runtime, node, requests, error = asyncio.run(execute(normal_steps()))
    assert error is None, repr(error)
    assert len(requests) == 3
    assert [item["type"] for item in node.sent] == ["tool_call", "tool_call", "candidate", "done"]
    for index, tool_call in enumerate(node.sent[:2], 1):
        assert tool_call["origin"]["response_id"] == f"resp_fixture_{index}"
        assert tool_call["origin"]["call_id"] == tool_call["call_id"]
    bodies = [json.loads(request.content) for request in requests]
    assert [tool["name"] for tool in bodies[0]["tools"]] == ["analyze_window", "get_evidence"]
    assert all(body["model"] == "gpt-5-mini" and body["store"] is False for body in bodies)
    assert all(body["reasoning"] == {"effort": "minimal"} for body in bodies)
    assert all(body["parallel_tool_calls"] is False for body in bodies)
    assert all(body["max_output_tokens"] == 1800 for body in bodies)
    assert bodies[0]["text"]["format"]["strict"] is True
    assert bodies[0]["text"]["format"]["type"] == "json_schema"
    assert bodies[0]["text"]["format"]["name"] == "receiving_evidence_plan"
    assert bodies[0]["text"]["format"]["schema"]["additionalProperties"] is False
    assert set(bodies[0]["text"]["format"]) == {"type", "name", "schema", "strict"}
    assert bodies[0]["tools"][0]["parameters"]["required"] == ["player_id", "start_time", "end_time"]
    assert any(item["type"] == "function_call_output" and item["call_id"] == "call_analysis" for item in bodies[1]["input"])
    assert any(item["type"] == "function_call_output" and item["call_id"] == "call_evidence" for item in bodies[2]["input"])
    assert all(str(request.url) == ENDPOINT and request.headers["api-key"] == "test-secret-never-emit" and "authorization" not in request.headers for request in requests)
    trace = node.sent[-1]["trace"]
    assert trace["frameworkVersion"] == "1.23.0" and trace["providerVersion"] == "1.17.0"
    assert trace["modelRequests"] == 3 and trace["toolCalls"] == 2 and trace["repairCount"] == 0
    assert trace["nativeToolCalls"] == [
        {"response_id": "resp_fixture_1", "call_id": "call_analysis", "name": "analyze_window", "status": "completed", "dispatched": True},
        {"response_id": "resp_fixture_2", "call_id": "call_evidence", "name": "get_evidence", "status": "completed", "dispatched": True},
    ]
    assert "test-secret" not in json.dumps(node.sent)
    assert any(event["event"] == "agent_run" for event in node.sent[-1]["agentTrace"])


@pytest.mark.parametrize("arguments", [
    {"player_id": "A9", "start_time": 0, "end_time": .8},
    {"player_id": "A7", "start_time": 0, "end_time": .9},
    {"player_id": "A7", "start_time": -.1, "end_time": .8},
    {"player_id": "A7", "start_time": "0", "end_time": .8},
    {"player_id": "A7", "start_time": False, "end_time": .8},
    {"player_id": "A7", "start_time": 10**400, "end_time": .8},
    {"player_id": "A7", "start_time": 0, "end_time": .8, "extra": 1},
])
def test_invalid_native_arguments_are_rejected_before_node(arguments):
    steps = [[function("analyze_window", arguments, "call_invalid")], *normal_steps()]
    runtime, node, requests, error = asyncio.run(execute(steps))
    assert error is None, repr(error)
    assert len(requests) == 4
    assert len([item for item in node.sent if item["type"] == "tool_call"]) == 2
    rejected = runtime.state.trace()["nativeToolCalls"][0]
    assert rejected["status"] == "rejected" and rejected["dispatched"] is False and rejected["rejectionSource"] == "python"
    second_input = json.loads(requests[1].content)["input"]
    returned = [item for item in second_input if item.get("type") == "function_call_output" and item["call_id"] == "call_invalid"]
    assert json.loads(returned[0]["output"])["error"] == "invalid_tool_arguments"


def test_get_evidence_requires_analysis_and_current_ids():
    steps = [
        [function("get_evidence", {"evidence_ids": []}, "call_early")],
        normal_steps()[0],
        [function("get_evidence", {"evidence_ids": ["invented"]}, "call_unknown")],
        *normal_steps()[1:],
    ]
    runtime, node, requests, error = asyncio.run(execute(steps))
    assert error is None, repr(error)
    assert len(requests) == 5
    assert [call["status"] for call in runtime.state.native_calls] == ["rejected", "completed", "rejected", "completed"]


def test_one_repair_uses_same_maf_session_and_shared_budget():
    wrong = {**PLAN, "claim_ids": ["C:invented"]}
    runtime, node, requests, error = asyncio.run(execute([*normal_steps(wrong), [text(PLAN)]], node=MemoryNode((False, True))))
    assert error is None, repr(error)
    assert len(requests) == 4 and runtime.state.repair_count == 1
    final_input = json.loads(requests[-1].content)["input"]
    assert any(item.get("call_id") == "call_evidence" for item in final_input)
    assert "invalid_evidence_reference" in json.dumps(final_input)
    assert len([item for item in node.sent if item["type"] == "candidate"]) == 2
    assert node.sent[-1]["type"] == "done"


def test_malformed_final_can_repair_without_exposing_prose():
    runtime, node, requests, error = asyncio.run(execute([*normal_steps()[:2], [text("not a JSON plan")], [text(PLAN)]], node=MemoryNode((False, True))))
    assert error is None, repr(error)
    candidate = [item for item in node.sent if item["type"] == "candidate"][0]
    assert candidate["plan"] is None and candidate["parse_error"] == "invalid_json"
    assert "not a JSON plan" not in json.dumps(node.sent)


def test_second_rejection_fails_without_third_attempt_or_done():
    runtime, node, requests, error = asyncio.run(execute([*normal_steps(), [text(PLAN)]], node=MemoryNode((False, False))))
    assert public_error_code(error) == "validation_rejected"
    assert len(requests) == 4 and all(item["type"] != "done" for item in node.sent)


def test_six_model_request_hard_cap_blocks_maf_final_extra_request():
    steps = [[function("analyze_window", {"player_id": "A7", "start_time": 0, "end_time": .8}, f"call_{index}")] for index in range(6)]
    runtime, node, requests, error = asyncio.run(execute(steps))
    assert public_error_code(error) == "round_limit", repr(error)
    assert len(requests) == 6 and runtime.state.model_requests == 6
    assert all(item["type"] not in ("candidate", "done") for item in node.sent)


def test_ten_native_call_cap_blocks_oversize_provider_batch():
    calls = [function("analyze_window", {"player_id": "A7", "start_time": 0, "end_time": .8}, f"call_{index}") for index in range(11)]
    runtime, node, requests, error = asyncio.run(execute([calls]))
    assert public_error_code(error) == "tool_limit", repr(error)
    assert len(requests) == 1 and len(runtime.state.native_calls) == 10
    assert node.sent == []


def test_rejected_calls_consume_tool_budget():
    calls = [function("analyze_window", {"player_id": "A9", "start_time": 0, "end_time": .8}, f"call_{index}") for index in range(10)]
    runtime, node, requests, error = asyncio.run(execute([calls, [function("get_evidence", {"evidence_ids": []}, "call_11")]]))
    assert public_error_code(error) == "tool_limit", repr(error)
    assert len(requests) == 2 and len(runtime.state.native_calls) == 10
    assert node.sent == []


def test_http_429_not_retried_and_error_body_never_exposed():
    async def handler(request, count):
        return httpx.Response(429, json={"error": {"message": "super-secret-body", "type": "rate_limit", "code": "rate_limit"}})
    runtime, node, requests, error = asyncio.run(execute([], handler=handler))
    assert len(requests) == 1 and public_error_code(error) == "cloud_http_429"
    assert "super-secret-body" not in json.dumps(node.sent)


def test_redirect_is_not_followed():
    async def handler(request, count):
        return httpx.Response(307, headers={"Location": "https://evil.example/responses"})
    runtime, node, requests, error = asyncio.run(execute([], handler=handler))
    assert len(requests) == 1 and public_error_code(error) == "redirect_blocked", repr(error)


def test_per_call_timeout_aborts_provider_without_retry():
    async def handler(request, count):
        await asyncio.sleep(.1)
        return httpx.Response(200, json=response([text(PLAN)], "resp_slow"))
    runtime, node, requests, error = asyncio.run(execute([], handler=handler, run={**RUN, "per_request_timeout_ms": 10}))
    assert public_error_code(error) == "cloud_timeout" and len(requests) == 1


@pytest.mark.parametrize("change", [
    {"status": "incomplete", "incomplete_details": {"reason": "max_output_tokens"}},
    {"status": "failed", "error": {"code": "server_error", "message": "private body"}},
    {"output": [{"type": "message", "id": "msg_refusal", "role": "assistant", "status": "completed", "content": [{"type": "refusal", "refusal": json.dumps(PLAN)}]}]},
])
def test_incomplete_error_and_refusal_responses_cannot_be_candidates(change):
    payload = {**response([text(PLAN)], "resp_invalid"), **change}
    runtime, node, requests, error = asyncio.run(execute([payload]))
    assert public_error_code(error) == "invalid_provider_response", repr(error)
    assert node.sent == []


def test_token_auth_uses_bearer_without_api_key():
    runtime, node, requests, error = asyncio.run(execute(normal_steps(), credentials=Credentials("test-token", True)))
    assert error is None, repr(error)
    assert all(request.headers["authorization"] == "Bearer test-token" and "api-key" not in request.headers for request in requests)


@pytest.mark.parametrize("endpoint", [
    "https://api.openai.com/v1/responses", "http://westus3.api.cognitive.microsoft.com/openai/v1/responses",
    "https://user:secret@westus3.api.cognitive.microsoft.com/openai/v1/responses",
    ENDPOINT + "?key=secret", ENDPOINT + "#fragment", ENDPOINT + "/",
    "https://westus3.api.cognitive.microsoft.com.evil.example/openai/v1/responses",
    "https://other.api.cognitive.microsoft.com/openai/v1/responses",
    "https://westus3.api.cognitive.microsoft.com:444/openai/v1/responses",
])
def test_endpoint_validation(endpoint):
    with pytest.raises(RuntimeFailure, match="invalid_endpoint"):
        RunConfig.parse({**RUN, "endpoint": endpoint})


def test_strict_json_rejects_duplicate_keys_and_nonfinite_values():
    for value in ['{"a":1,"a":2}', '{"a":NaN}', '{"a":Infinity}']:
        with pytest.raises(ValueError):
            strict_json_loads(value)
