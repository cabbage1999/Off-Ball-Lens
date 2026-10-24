"""Independent v2 acceptance: exports, author mapping, and adversarial boundaries.

These checks deliberately build the author input independently of adapter helpers.
They are acceptance evidence, not football accuracy labels.
"""
from pathlib import Path
from copy import deepcopy
import base64
import hashlib
import json
import math
import importlib.metadata

import numpy as np
import pandas as pd
import pytest

from analytics.compute_das import analyze_frame
from analytics.build_moments import build_moments, project_moments

ROOT = Path(__file__).resolve().parents[2]
NAMES = ("used", "unused", "blocked")
ROSTER = {f"{team}{i}" for team in "AB" for i in range(1, 12)}


def read(name):
    path = ROOT / "data" / f"{name}.json"
    return path, json.loads(path.read_text()), json.loads((ROOT / "data" / "analysis" / f"{name}.json").read_text())


@pytest.mark.parametrize("name", NAMES)
def test_export_identity_hash_status_and_author_parity(name):
    import accessible_space as asp
    assert importlib.metadata.version("accessible-space") == "2.1.0"
    path, scene, analysis = read(name)
    assert analysis["inputFileHash"] == hashlib.sha256(path.read_bytes()).hexdigest()
    canonical = json.dumps(scene, sort_keys=True, separators=(",", ":")).encode()
    assert analysis["inputHash"] == hashlib.sha256(canonical).hexdigest()
    config = json.dumps(analysis["model"]["config"], sort_keys=True, separators=(",", ":")).encode()
    assert analysis["model"]["configHash"] == hashlib.sha256(config).hexdigest()
    assert len(analysis["frames"]) == len(scene["frames"][::2])
    assert analysis["heatmapMeta"]["scaleMax"] == .1
    rows = []
    for output, frame in zip(analysis["frames"], scene["frames"][::2]):
        assert (output["frameId"], output["frameIndex"], output["t"]) == (frame["frameId"], frame["index"], frame["t"])
        assert set(output["players"]) == ROSTER
        if frame["ball"]["state"] != "possessed":
            assert output["status"] == "invalid"
        else:
            # The authored exports contain no other unsupported controlled states.
            assert output["status"] == "valid"
        direction = frame["attackDirection"]
        defenders = sorted(np.float32(p["x"] * direction) for p in frame["players"] if p["team"] != frame["attackingTeam"])
        offside_line = max(0, np.float32(frame["ball"]["x"] * direction), defenders[-2])
        source_players = {p["id"]: p for p in frame["players"]}
        for pid, value in output["players"].items():
            expected_status = ("invalid" if output["status"] == "invalid" else
                               "carrier" if pid == frame["carrierId"] else
                               "defending" if pid[0] != frame["attackingTeam"] else
                               "offside" if np.float32(source_players[pid]["x"] * direction) > offside_line else "eligible")
            assert value["status"] == expected_status
            if value["status"] != "eligible":
                assert value["as"] is value["das"] is value["heatmap"] is None
            else:
                assert output["status"] == "valid"
                assert pid != frame["carrierId"] and pid[0] == frame["attackingTeam"]
                assert math.isfinite(value["as"]) and math.isfinite(value["das"])
                assert len(base64.b64decode(value["heatmap"], validate=True)) == 35 * 23
        if output["status"] != "valid":
            continue
        direction = frame["attackDirection"]
        common = dict(frame_id=frame["frameId"], period_id=frame["periodId"],
                      team_in_possession=frame["attackingTeam"], player_in_possession=frame["carrierId"], attack_direction=1)
        # Reverse each roster independently to catch accidental input-order indexing.
        for player in reversed(frame["players"]):
            rows.append(dict(common, player_id=player["id"], team_id=player["team"],
                             x=player["x"] * direction, y=player["y"], vx=player["vx"] * direction, vy=player["vy"]))
        ball = frame["ball"]
        rows.append(dict(common, player_id="ball", team_id=None, x=ball["x"] * direction,
                         y=ball["y"], vx=ball["vx"] * direction, vy=ball["vy"]))
    tracking = pd.DataFrame(rows)
    official = asp.get_individual_dangerous_accessible_space(
        tracking.copy(), period_col="period_id", player_in_possession_col="player_in_possession",
        attacking_direction_col="attack_direction", infer_attacking_direction=False,
        exclude_passer=True, respect_offside=True, return_cropped_result=True,
        use_progress_bar=False, chunk_size=10,
        x_pitch_min=-52.5, x_pitch_max=52.5, y_pitch_min=-34, y_pitch_max=34)
    by_id = {f["frameId"]: f for f in analysis["frames"]}
    for i, row in tracking.iterrows():
        pid = row.player_id
        if pid == "ball":
            assert np.isnan(official.player_das.iloc[i]) and np.isnan(official.player_acc_space.iloc[i])
            continue
        exported = by_id[row.frame_id]["players"][pid]
        if exported["status"] == "eligible":
            assert exported["as"] == pytest.approx(official.player_acc_space.iloc[i], rel=1e-6, abs=1e-5)
            assert exported["das"] == pytest.approx(official.player_das.iloc[i], rel=1e-6, abs=1e-7)
        elif exported["status"] in ("carrier", "offside"):
            assert official.player_acc_space.iloc[i] == 0 and official.player_das.iloc[i] == 0


@pytest.mark.parametrize("name", NAMES)
def test_every_tracking_prefix_has_same_moment_projection(name):
    _, scene, analysis = read(name)
    for frame in scene["frames"]:
        time = frame["t"]
        prefix = [f for f in analysis["frames"] if f["t"] <= time + 1e-9]
        events = [e for e in scene["events"] if e["t"] <= time + 1e-9]
        actual = project_moments(analysis["moments"], time)
        reconstructed = project_moments(build_moments(prefix, events, as_of_time=time), time)
        assert actual == reconstructed, (name, time)
        for moment in actual:
            assert moment["detectedAtTime"] <= time + 1e-9
            assert moment["peakTime"] <= time + 1e-9
            assert moment["endTime"] is None or moment["endTime"] <= time + 1e-9
            assert moment["outcomeKnownAtTime"] <= time + 1e-9
            if moment["outcome"]["status"] == "not_selected":
                assert moment["endTime"] is not None
            if moment["outcome"]["status"] == "received":
                event = next(e for e in events if e["id"] == moment["outcome"]["eventId"])
                assert event["type"] == "reception" and event["playerId"] == moment["playerId"]


def test_single_frame_export_agreement_including_b_possession():
    for name, indices in (("used", (0, 104, 124, 306)), ("unused", (118, 130)), ("blocked", (82, 202, 254, 300))):
        _, scene, analysis = read(name)
        for index in indices:
            actual = analyze_frame(scene["frames"][index])
            expected = next(f for f in analysis["frames"] if f["frameIndex"] == index)
            assert actual == expected, (name, index)


def test_loss_of_trustworthy_input_is_indeterminate_not_not_selected():
    frames = [dict(t=round(i * .2, 1), frameId=f"probe:{i}", status="valid", reason=None,
                   attackingTeam="A", carrierId="A6", players={"A7":dict(status="eligible", das=1)}) for i in range(5)]
    reasons = ("unknown_attack_direction", "invalid_team_identity", "unsupported_pitch_coordinates",
               "player_outside_pitch", "ball_outside_pitch", "unknown_ball_state")
    for reason in reasons:
        invalid = deepcopy(frames[-1])
        invalid.update(t=1, frameId="probe:5", status="invalid", reason=reason)
        invalid["players"]["A7"] = dict(status="invalid", das=None)
        result = build_moments(frames + [invalid], [])[0]
        assert result["outcome"]["status"] == "closed", reason
