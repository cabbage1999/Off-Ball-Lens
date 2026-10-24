"""Strict frame validation and conversion to the author's long-table schema."""
from __future__ import annotations

import math
from .config import FILTERS, PITCH, ROSTER


def finite_number(value) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def attack_direction(frame: dict) -> int | None:
    direction = frame.get("attackDirection")
    if isinstance(direction, dict):
        direction = direction.get(frame.get("attackingTeam"))
    return direction if direction in (-1, 1) and not isinstance(direction, bool) else None


def frame_issue(frame: dict) -> str | None:
    """Reject incomplete opponents; never let an incomplete roster inflate AS."""
    if not frame.get("frameId") or not finite_number(frame.get("t")):
        return "invalid_frame_identity"
    if not isinstance(frame.get("index"), int) or frame.get("periodId") is None:
        return "invalid_frame_identity"
    pitch = frame.get("pitch", {})
    if any(pitch.get(k) != v for k, v in PITCH.items()):
        return "unsupported_pitch_coordinates"
    if frame.get("gameMode") != "open_play":
        return "not_open_play"
    players = frame.get("players", [])
    ids = [p.get("id") for p in players]
    if len(ids) != 22 or set(ids) != set(ROSTER):
        return "incomplete_or_duplicate_roster"
    for player in players:
        if player.get("team") != player["id"][0]:
            return "invalid_team_identity"
        if not all(finite_number(player.get(k)) for k in ("x", "y", "vx", "vy")):
            return "invalid_player_tracking"
        if not (-52.5 <= player["x"] <= 52.5 and -34 <= player["y"] <= 34):
            return "player_outside_pitch"
    ball = frame.get("ball") or {}
    if not all(finite_number(ball.get(k)) for k in ("x", "y", "vx", "vy", "z")):
        return "invalid_ball_tracking"
    if ball.get("state") != "possessed":
        return {"in_flight": "ball_in_flight", "loose": "loose_ball", "dead": "dead_ball"}.get(ball.get("state"), "unknown_ball_state")
    if not 0 <= ball["z"] <= FILTERS["maxGroundBallZ"]:
        return "non_ground_ball"
    if not (-52.5 <= ball["x"] <= 52.5 and -34 <= ball["y"] <= 34):
        return "ball_outside_pitch"
    if frame.get("attackingTeam") not in ("A", "B") or frame.get("carrierId") not in ids:
        return "unknown_possession"
    carrier = next(p for p in players if p["id"] == frame["carrierId"])
    if carrier["team"] != frame["attackingTeam"]:
        return "inconsistent_possession"
    if math.hypot(carrier["x"] - ball["x"], carrier["y"] - ball["y"]) > FILTERS["maxCarrierBallDistance"]:
        return "ball_not_controlled_by_carrier"
    if attack_direction(frame) is None:
        return "unknown_attack_direction"
    return None


def geometric_offside_ids(frame: dict) -> set[str]:
    """Match 2.1.0 core.simulate_passes' point-coordinate offside test."""
    import numpy as np
    direction = attack_direction(frame)
    attack = frame["attackingTeam"]
    # The pinned production API casts to float32 before testing offside. Match
    # that precision, including coordinates almost exactly on the offside line.
    normalized_x = {p["id"]: np.float32(p["x"] * direction) for p in frame["players"]}
    defenders = sorted(normalized_x[p["id"]] for p in frame["players"] if p["team"] != attack)
    line = max(defenders[-2], np.float32(frame["ball"]["x"] * direction))
    return {p["id"] for p in frame["players"] if p["team"] == attack
            and p["id"] != frame["carrierId"] and normalized_x[p["id"]] > line and normalized_x[p["id"]] > 0}


def tracking_rows(frame: dict, canonical: bool = True) -> list[dict]:
    """23 rows; preserve identities and transform position and velocity together."""
    direction = attack_direction(frame)
    factor = direction if canonical else 1
    common = {
        "frame_id": frame["frameId"], "period_id": frame["periodId"],
        "team_in_possession": frame["attackingTeam"],
        "player_in_possession": frame["carrierId"],
        "attack_direction": 1 if canonical else direction,
    }
    rows = [{**common, "player_id": p["id"], "team_id": p["team"],
             "x": p["x"] * factor, "y": p["y"], "vx": p["vx"] * factor, "vy": p["vy"]}
            for p in frame["players"]]
    ball = frame["ball"]
    rows.append({**common, "player_id": "ball", "team_id": None,
                 "x": ball["x"] * factor, "y": ball["y"], "vx": ball["vx"] * factor, "vy": ball["vy"]})
    return rows


def empty_result(frame: dict, issue: str | None) -> dict:
    return {
        "frameId": frame.get("frameId"), "frameIndex": frame.get("index"), "t": frame.get("t"),
        "status": "invalid" if issue else "valid", "reason": issue,
        "carrierId": frame.get("carrierId"), "attackingTeam": frame.get("attackingTeam"),
        "attackDirection": attack_direction(frame),
        "players": {pid: {"status": "invalid", "as": None, "das": None, "heatmap": None} for pid in ROSTER},
    }
