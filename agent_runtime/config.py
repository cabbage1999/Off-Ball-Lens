"""Explicit configuration only: no credential discovery or provider fallback."""

from __future__ import annotations

from dataclasses import dataclass
import math
import re
from typing import Any, Mapping
from urllib.parse import urlsplit

from .protocol import RuntimeFailure

MAX_MODEL_REQUESTS = 6
MAX_TOOL_CALLS = 10
MAX_DEADLINE_MS = 40_000
MAX_REQUEST_TIMEOUT_MS = 12_000
MAX_OUTPUT_TOKENS = 1_800
FRAMEWORK = "microsoft-agent-framework"
PROVIDER = "azure-openai-responses"


def finite_number(value: Any) -> bool:
    try:
        return type(value) in (int, float) and math.isfinite(value)
    except OverflowError:
        return False


def bounded_string(value: Any, maximum: int = 200) -> bool:
    return isinstance(value, str) and 0 < len(value) <= maximum and not any(ord(c) < 32 for c in value)


@dataclass(frozen=True)
class RunConfig:
    request_id: str
    selected_context: dict[str, Any]
    question: str
    model: str
    endpoint: str
    base_url: str
    deadline_ms: int
    per_request_timeout_ms: int
    reasoning_effort: str

    @classmethod
    def parse(cls, message: dict[str, Any]) -> RunConfig:
        allowed = {"type", "request_id", "selected_context", "question", "model", "endpoint", "deadline_ms", "review", "reasoning_effort", "per_request_timeout_ms"}
        if set(message) - allowed or message.get("type") != "run":
            raise RuntimeFailure("invalid_run_config")
        request_id = message.get("request_id")
        selected = message.get("selected_context")
        if not bounded_string(request_id) or not isinstance(selected, dict):
            raise RuntimeFailure("invalid_run_config")
        if set(selected) != {"scenarioId", "player_id", "earliest_time", "as_of_time", "audience", "language"}:
            raise RuntimeFailure("invalid_run_config")
        if not all(bounded_string(selected.get(key)) for key in ("scenarioId", "player_id")):
            raise RuntimeFailure("invalid_run_config")
        start, end = selected.get("earliest_time"), selected.get("as_of_time")
        if not finite_number(start) or not finite_number(end) or not 0 <= start <= end:
            raise RuntimeFailure("invalid_run_config")
        if selected.get("audience") not in ("fan", "analyst") or selected.get("language") not in ("en", "zh"):
            raise RuntimeFailure("invalid_run_config")
        question, model = message.get("question"), message.get("model")
        if not isinstance(question, str) or len(question) > 1_000:
            raise RuntimeFailure("invalid_run_config")
        if not isinstance(model, str) or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._/-]{0,199}", model):
            raise RuntimeFailure("invalid_run_config")
        endpoint = message.get("endpoint")
        if not isinstance(endpoint, str) or len(endpoint) > 1_000:
            raise RuntimeFailure("invalid_endpoint")
        try:
            url = urlsplit(endpoint)
            valid_host = url.hostname == "westus3.api.cognitive.microsoft.com" or (url.hostname and re.fullmatch(r"[a-z0-9.-]+\.(?:openai\.azure\.com|services\.ai\.azure\.com)", url.hostname))
            valid_path = re.fullmatch(r"(?:/api/projects/[A-Za-z0-9._-]+)?/openai/v1/responses", url.path)
            valid = url.scheme == "https" and url.port in (None, 443) and not url.username and not url.password and not url.query and not url.fragment and valid_host and valid_path
        except ValueError:
            valid = False
        if not valid:
            raise RuntimeFailure("invalid_endpoint")
        deadline = message.get("deadline_ms", MAX_DEADLINE_MS)
        timeout = message.get("per_request_timeout_ms", MAX_REQUEST_TIMEOUT_MS)
        if type(deadline) is not int or not 1 <= deadline <= MAX_DEADLINE_MS:
            raise RuntimeFailure("invalid_run_config")
        if type(timeout) is not int or not 1 <= timeout <= MAX_REQUEST_TIMEOUT_MS:
            raise RuntimeFailure("invalid_run_config")
        effort = message.get("reasoning_effort", "minimal")
        if effort not in ("none", "minimal", "low", "medium", "high", "xhigh") or message.get("review", False) is not False:
            raise RuntimeFailure("invalid_run_config")
        return cls(request_id, dict(selected), question, model, endpoint, endpoint.removesuffix("responses"), deadline, timeout, effort)


@dataclass(frozen=True, repr=False)
class Credentials:
    value: str
    is_token: bool

    @classmethod
    def from_environment(cls, env: Mapping[str, str], config: RunConfig) -> Credentials:
        token, key = env.get("AZURE_FOUNDRY_AUTH_TOKEN"), env.get("AZURE_OPENAI_API_KEY")
        value = token or key
        if not value or len(value) > 32_000 or "\r" in value or "\n" in value:
            raise RuntimeFailure("missing_credentials")
        if "/api/projects/" in config.endpoint and not token:
            raise RuntimeFailure("project_requires_entra_token")
        return cls(value, bool(token))
