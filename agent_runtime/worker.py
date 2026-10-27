"""One isolated JSONL worker per explanation request.

Run with the dedicated environment: .venv-maf/bin/python -m agent_runtime.worker
"""

from __future__ import annotations

import asyncio
import logging
import os
import sys
import warnings

# SDK debug/telemetry output must never expose prompts, evidence or credentials.
# The Node launcher also supplies only its explicitly selected environment.
os.environ["OTEL_SDK_DISABLED"] = "true"
logging.disable(logging.CRITICAL)
warnings.filterwarnings("ignore")


async def main() -> int:
    from .protocol import JsonLineChannel

    channel = await JsonLineChannel.open_stdio()
    request_id = "unknown"
    runtime = None
    try:
        from .config import Credentials, RunConfig
        from .runtime import AgentRuntime, public_error_code

        async with asyncio.timeout(5):
            message = await channel.receive()
        config = RunConfig.parse(message)
        request_id = config.request_id
        credentials = Credentials.from_environment(os.environ, config)
        runtime = AgentRuntime(config, credentials, channel)
        await runtime.run()
        return 0
    except Exception as error:
        # Import failures have a fixed diagnostic too; do not print traceback or
        # provider exception text (which can contain a complete HTTP request).
        classify = locals().get("public_error_code")
        code = classify(error) if classify else "agent_runtime_unavailable"
        message = {"type": "error", "request_id": request_id, "error": {"code": code, "message": code}}
        if runtime:
            message["trace"] = runtime.state.trace()
            message["agentTrace"] = list(runtime.state.agent_trace)
        try:
            await channel.send(message)
        except Exception:
            pass
        return 1


if __name__ == "__main__":
    try:
        exit_code = asyncio.run(main())
    except Exception:
        # stdout may already be closed; a fixed stderr token is safe.
        sys.stderr.write("agent_runtime_failed\n")
        exit_code = 1
    raise SystemExit(exit_code)
