"""Bounded JSONL transport. Nothing except protocol messages belongs on stdout."""

from __future__ import annotations

import asyncio
import json
import sys
from typing import Any, Protocol

MAX_LINE_BYTES = 262_144


class RuntimeFailure(Exception):
    """A public, fixed error code; never construct this from provider error text."""


def _unique_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("duplicate_json_key")
        result[key] = value
    return result


def strict_json_loads(text: str) -> Any:
    def invalid_constant(_: str) -> None:
        raise ValueError("nonfinite_json_number")

    return json.loads(text, object_pairs_hook=_unique_object, parse_constant=invalid_constant)


class Channel(Protocol):
    async def send(self, message: dict[str, Any]) -> None: ...

    async def receive(self) -> dict[str, Any]: ...


class JsonLineChannel:
    def __init__(self, reader: asyncio.StreamReader) -> None:
        self.reader = reader

    @classmethod
    async def open_stdio(cls) -> JsonLineChannel:
        reader = asyncio.StreamReader(limit=MAX_LINE_BYTES)
        protocol = asyncio.StreamReaderProtocol(reader)
        await asyncio.get_running_loop().connect_read_pipe(lambda: protocol, sys.stdin.buffer)
        return cls(reader)

    async def receive(self) -> dict[str, Any]:
        try:
            line = await self.reader.readline()
            if not line:
                raise RuntimeFailure("bridge_closed")
            if len(line) > MAX_LINE_BYTES or not line.endswith(b"\n"):
                raise RuntimeFailure("invalid_protocol")
            message = strict_json_loads(line.decode("utf-8"))
            if not isinstance(message, dict):
                raise RuntimeFailure("invalid_protocol")
            return message
        except (ValueError, UnicodeError, RecursionError) as exc:
            raise RuntimeFailure("invalid_protocol") from exc

    async def send(self, message: dict[str, Any]) -> None:
        line = json.dumps(message, separators=(",", ":"), ensure_ascii=False, allow_nan=False)
        if len(line.encode("utf-8")) + 1 > MAX_LINE_BYTES:
            raise RuntimeFailure("protocol_message_limit")
        try:
            sys.stdout.write(line + "\n")
            sys.stdout.flush()
        except (BrokenPipeError, OSError) as exc:
            raise RuntimeFailure("bridge_closed") from exc
