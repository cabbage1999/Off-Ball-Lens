from __future__ import annotations

import asyncio
import json
import os
from pathlib import Path
import subprocess
import sys

import pytest

from agent_runtime.config import Credentials, RunConfig
from agent_runtime.protocol import JsonLineChannel, MAX_LINE_BYTES, RuntimeFailure
from agent_runtime.runtime import public_error_code
from .test_runtime import MemoryNode, PLAN, RUN, execute, function, normal_steps, text


def test_jsonl_rejects_partial_oversize_nonobject_and_invalid_utf8():
    async def check(data):
        reader = asyncio.StreamReader(limit=MAX_LINE_BYTES)
        reader.feed_data(data)
        reader.feed_eof()
        with pytest.raises(RuntimeFailure):
            await JsonLineChannel(reader).receive()

    for data in (b"{}", b"[]\n", b"\xff\n", b"{" + b"a" * MAX_LINE_BYTES + b"}\n", b'{"a":1,"a":2}\n'):
        asyncio.run(check(data))


def test_tool_bridge_timeout_is_fatal_without_more_model_requests(monkeypatch):
    # Expire the real bridge-wait guard only after MAF dispatched a tool.
    # A 100 ms whole-request budget also timed out cold SDK startup on CI,
    # before reaching the behaviour this test is intended to verify.
    original_timeout = asyncio.timeout
    armed = False
    targeted = []

    def timeout_at_tool_wait(delay):
        nonlocal armed
        if armed:
            armed = False
            timeout = original_timeout(0)
            targeted.append((delay, timeout))
            return timeout
        return original_timeout(delay)

    monkeypatch.setattr(asyncio, "timeout", timeout_at_tool_wait)

    class MissingToolResult(MemoryNode):
        async def send(self, message):
            nonlocal armed
            self.sent.append(message)
            assert message["type"] == "tool_call"
            armed = True

    runtime, node, requests, error = asyncio.run(execute(normal_steps(), node=MissingToolResult()))
    assert public_error_code(error) == "cloud_timeout", repr(error)
    assert len(targeted) == 1 and targeted[0][1].expired()
    assert 0 < targeted[0][0] <= runtime.config.per_request_timeout_ms / 1000
    assert runtime.state.model_requests == 1
    assert len(requests) == 1 and len(node.sent) == 1
    assert len(runtime.state.native_calls) == 1 and runtime.state.native_calls[0]["dispatched"]


def test_total_deadline_includes_waiting_for_node_validation(monkeypatch):
    # Reschedule the existing end-to-end timer at the validation boundary.
    # Framework startup and the preceding three turns keep their normal budget.
    original_timeout = asyncio.timeout
    timeouts = []

    def record_timeout(delay):
        timeout = original_timeout(delay)
        timeouts.append(timeout)
        return timeout

    monkeypatch.setattr(asyncio, "timeout", record_timeout)

    class MissingValidation(MemoryNode):
        async def send(self, message):
            if message["type"] == "candidate":
                self.sent.append(message)
                timeouts[0].reschedule(asyncio.get_running_loop().time())
            else:
                await super().send(message)

    runtime, node, requests, error = asyncio.run(execute(normal_steps(), node=MissingValidation()))
    assert public_error_code(error) == "cloud_timeout", repr(error)
    assert timeouts[0].expired()
    assert node.sent[-1]["type"] == "candidate"
    assert runtime.state.model_requests == 3
    assert len(requests) == 3 and all(item["type"] != "done" for item in node.sent)


def test_mismatched_tool_result_id_cannot_continue():
    class MismatchedReply(MemoryNode):
        async def receive(self):
            message = await super().receive()
            message["call_id"] = "another_call"
            return message

    runtime, node, requests, error = asyncio.run(execute(normal_steps(), node=MismatchedReply()))
    assert public_error_code(error) == "invalid_protocol", repr(error)
    assert len(requests) == 1


def test_node_rejected_tool_is_not_recorded_completed():
    first = True

    def reject_first(message, result):
        nonlocal first
        if first:
            first = False
            return {"error": "invalid_tool_arguments", "selected_context": RUN["selected_context"]}
        return result

    steps = [[function("analyze_window", {"player_id": "A7", "start_time": 0, "end_time": .8}, "call_node_reject")], *normal_steps()]
    runtime, node, requests, error = asyncio.run(execute(steps, node=MemoryNode(mutate_result=reject_first)))
    assert error is None, repr(error)
    assert runtime.state.native_calls[0] == {"response_id": "resp_fixture_1", "call_id": "call_node_reject", "name": "analyze_window", "status": "rejected", "dispatched": True, "rejectionSource": "node"}


def test_unknown_native_tool_cannot_execute():
    runtime, node, requests, error = asyncio.run(execute([[function("shell", {"command": "anything"}, "call_unknown")]]))
    assert public_error_code(error) == "invalid_tool_call"
    assert node.sent == [] and len(requests) == 1


def test_duplicate_native_call_id_is_rejected():
    call = function("analyze_window", {"player_id": "A7", "start_time": 0, "end_time": .8}, "duplicate")
    runtime, node, requests, error = asyncio.run(execute([[call], [call]]))
    assert public_error_code(error) == "invalid_tool_call"
    assert len(requests) == 2 and len(node.sent) == 1


def test_repair_does_not_reset_global_model_request_budget():
    steps = [
        [function("analyze_window", {"player_id": "A9", "start_time": 0, "end_time": .8}, f"call_invalid_{index}")]
        for index in range(3)
    ] + normal_steps()
    runtime, node, requests, error = asyncio.run(execute(steps, node=MemoryNode((False,))))
    assert public_error_code(error) == "round_limit"
    assert len(requests) == 6 and runtime.state.repair_count == 1
    assert len([item for item in node.sent if item["type"] == "candidate"]) == 1


def test_empty_plan_cannot_be_accepted_even_by_bad_node_reply():
    runtime, node, requests, error = asyncio.run(execute([[text("invalid JSON")]]))
    assert public_error_code(error) == "invalid_protocol"
    assert all(item["type"] != "done" for item in node.sent)


def test_worker_missing_credentials_is_sanitized_jsonl_and_nonzero_exit():
    project = Path(__file__).resolve().parents[2]
    # No Azure/OpenAI credentials or provider environment enters this subprocess.
    env = {"PATH": os.environ.get("PATH", ""), "PYTHONNOUSERSITE": "1"}
    completed = subprocess.run([sys.executable, "-m", "agent_runtime.worker"], input=json.dumps(RUN) + "\n", capture_output=True, text=True, cwd=project, env=env, timeout=5)
    assert completed.returncode == 1
    assert completed.stderr == ""
    messages = [json.loads(line) for line in completed.stdout.splitlines()]
    assert messages == [{"type": "error", "request_id": RUN["request_id"], "error": {"code": "missing_credentials", "message": "missing_credentials"}}]


def test_worker_bad_run_does_not_echo_credentials_or_arbitrary_input():
    project = Path(__file__).resolve().parents[2]
    env = {"PATH": os.environ.get("PATH", ""), "AZURE_OPENAI_API_KEY": "do-not-echo-secret"}
    bad_run = {**RUN, "endpoint": "https://evil.example/do-not-echo-secret"}
    completed = subprocess.run([sys.executable, "-m", "agent_runtime.worker"], input=json.dumps(bad_run) + "\n", capture_output=True, text=True, cwd=project, env=env, timeout=5)
    assert completed.returncode == 1 and completed.stderr == ""
    assert "do-not-echo-secret" not in completed.stdout
    assert json.loads(completed.stdout)["error"]["code"] == "invalid_endpoint"


@pytest.mark.parametrize("updates", [
    {"deadline_ms": 40_001}, {"deadline_ms": 0}, {"deadline_ms": True},
    {"per_request_timeout_ms": 12_001}, {"review": True}, {"reasoning_effort": "unsupported"},
])
def test_runtime_limits_cannot_be_raised_by_run_message(updates):
    with pytest.raises(RuntimeFailure, match="invalid_run_config"):
        RunConfig.parse({**RUN, **updates})


def test_project_endpoint_requires_explicit_entra_token():
    config = RunConfig.parse({**RUN, "endpoint": "https://resource.services.ai.azure.com/api/projects/test/openai/v1/responses"})
    with pytest.raises(RuntimeFailure, match="project_requires_entra_token"):
        Credentials.from_environment({"AZURE_OPENAI_API_KEY": "test-key"}, config)
    assert Credentials.from_environment({"AZURE_FOUNDRY_AUTH_TOKEN": "test-token"}, config).is_token


def test_empty_question_and_explicit_reasoning_options_match_node_contract():
    for effort in ("none", "minimal", "low", "medium", "high", "xhigh"):
        config = RunConfig.parse({**RUN, "question": "", "reasoning_effort": effort})
        assert config.question == "" and config.reasoning_effort == effort


def test_real_worker_stdio_completes_only_after_validation_and_exits_cleanly():
    async def scenario():
        project = Path(__file__).resolve().parents[2]
        env = {"PATH": os.environ.get("PATH", ""), "PYTHONNOUSERSITE": "1", "AZURE_OPENAI_API_KEY": "fixture-secret"}
        process = await asyncio.create_subprocess_exec(
            sys.executable, "-m", "agent_runtime.tests.fake_provider_worker",
            stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE, cwd=project, env=env,
        )
        node = MemoryNode()
        messages = []
        try:
            async with asyncio.timeout(5):
                process.stdin.write((json.dumps(RUN) + "\n").encode())
                await process.stdin.drain()
                while line := await process.stdout.readline():
                    message = json.loads(line)
                    messages.append(message)
                    await node.send(message)
                    if message["type"] in ("tool_call", "candidate"):
                        reply = await node.receive()
                        process.stdin.write((json.dumps(reply) + "\n").encode())
                        await process.stdin.drain()
                    elif message["type"] == "done":
                        process.stdin.close()
                code = await process.wait()
                stderr = await process.stderr.read()
        finally:
            if process.returncode is None:
                process.kill()
                await process.wait()
        assert code == 0 and stderr == b""
        assert [message["type"] for message in messages] == ["tool_call", "tool_call", "candidate", "done"]
        assert messages[-1]["trace"]["responseIds"] == ["resp_process_fixture_1", "resp_process_fixture_2", "resp_process_fixture_3"]
        assert "fixture-secret" not in json.dumps(messages)

    asyncio.run(scenario())
