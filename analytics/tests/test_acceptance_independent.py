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
from numbers import Real

import numpy as np
import pandas as pd
import pytest

from analytics.compute_das import analyze_frame, compute_frames
from analytics.build_moments import build_moments, project_moments

ROOT = Path(__file__).resolve().parents[2]
NAMES = ("used", "unused", "blocked")
ROSTER = {f"{team}{i}" for team in "AB" for i in range(1, 12)}
# The author API defaults to float32 for simulation and unweighted integration.
# 1 ppm is about 8.39 float32 epsilons: a strict reproducibility allowance for
# architecture-dependent last bits, not a claim about scientific accuracy or a
# formal bound on propagated model error. No absolute floor relaxes small/zero AS
# or DAS. Metadata, applicability/nulls and quantized heatmaps remain exact.
SCALAR_REL_TOL = 1e-6


def read(name):
    path = ROOT / "data" / f"{name}.json"
    return path, json.loads(path.read_text()), json.loads((ROOT / "data" / "analysis" / f"{name}.json").read_text())


def assert_scalar_reproducible(actual, expected, location):
    for value in (actual, expected):
        assert isinstance(value, Real) and not isinstance(value, (bool, np.bool_)), location
        assert math.isfinite(value) and value >= 0, location
    assert math.isclose(actual, expected, rel_tol=SCALAR_REL_TOL, abs_tol=0), (
        location, actual, expected, SCALAR_REL_TOL)


def assert_export_frame_reproducible(actual, expected):
    """Only eligible AS/DAS scalars have a cross-platform numerical tolerance."""
    assert actual.keys() == expected.keys()
    for key in expected.keys() - {"players"}:
        assert type(actual[key]) is type(expected[key]) and actual[key] == expected[key], key
    assert actual["players"].keys() == expected["players"].keys()
    for pid, reference in expected["players"].items():
        player = actual["players"][pid]
        assert player.keys() == reference.keys(), pid
        for field, value in reference.items():
            location = (expected["frameId"], pid, field)
            if field in ("as", "das") and reference["status"] == "eligible":
                assert_scalar_reproducible(player[field], value, location)
            else:
                assert type(player[field]) is type(value) and player[field] == value, location


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
            assert_scalar_reproducible(official.player_acc_space.iloc[i], exported["as"], (row.frame_id, pid, "as"))
            assert_scalar_reproducible(official.player_das.iloc[i], exported["das"], (row.frame_id, pid, "das"))
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
        # Recompute the complete batch here, on this runtime; a stored macOS
        # export is not evidence of exact single/batch equality on Linux.
        batch, _ = compute_frames(scene["frames"][::2])
        live_by_index = {frame["frameIndex"]: frame for frame in batch}
        for index in indices:
            actual = analyze_frame(scene["frames"][index])
            expected = next(f for f in analysis["frames"] if f["frameIndex"] == index)
            assert actual == live_by_index[index], ("same-runtime single/batch", name, index)
            assert_export_frame_reproducible(actual, expected)


def test_cross_platform_comparator_accepts_real_ci_deltas_but_rejects_corruption():
    # Actual Linux versus stored macOS values from commit 9b871a9, Actions run
    # 40102860487 / job 120898399450. The full diff changed only these scalars;
    # all frame fields, statuses/nulls and base64 heatmap strings were identical.
    differences = (
        ("A1", "das", .0012128488939318022, .001212848905467322),
        ("A2", "das", .006900608882373127, .006900608889482253),
        ("A4", "das", .004504526969568794, .0045045270320501355),
        ("A5", "as", 985.5759887695312, 985.5760498046875),
        ("A5", "das", .00446293592673549, .004462936144055263),
        ("A6", "das", .02515254403072512, .02515254472615115),
        ("A7", "das", .04824364506523321, .04824364457879304),
        ("A8", "das", .017488702618389737, .017488702577547012),
        ("A9", "as", 28.222002029418945, 28.22200584411621),
        ("A9", "das", .03984428116095061, .039844283522967545),
        ("A10", "as", 101.11639404296875, 101.11641693115234),
        ("A10", "das", .047592114892719375, .0475921162477836),
        ("A11", "das", .002245584526940059, .002245584525335545),
    )
    _, _, analysis = read("used")
    # Keep the historical cross-platform scalar pairs as a comparator fixture.
    # Current choreography changes the current export; it must not overwrite
    # these observed CI deltas or change the tolerance. Fresh export parity is
    # checked separately above. Other fields supply only the current schema.
    stored = deepcopy(analysis["frames"][0])
    for pid, metric, mac_value, _ in differences:
        stored["players"][pid][metric] = mac_value
    linux = deepcopy(stored)
    for pid, metric, mac_value, linux_value in differences:
        linux["players"][pid][metric] = linux_value
    assert linux != stored
    assert_export_frame_reproducible(linux, stored)

    for pid, metric, mac_value, _ in differences:
        perturbed = deepcopy(stored)
        perturbed["players"][pid][metric] = mac_value * (1 + 1e-4)
        with pytest.raises(AssertionError):
            assert_export_frame_reproducible(perturbed, stored)
    for bad in (float("nan"), float("inf"), -1, None, True):
        perturbed = deepcopy(stored)
        perturbed["players"]["A7"]["das"] = bad
        with pytest.raises(AssertionError):
            assert_export_frame_reproducible(perturbed, stored)

    for path, replacement in (
        (("frameId",), "used:0001"), (("frameIndex",), 1), (("t",), 1e-12),
        (("carrierId",), "A6"), (("status",), "invalid"),
        (("players", "A7", "status"), "offside"),
        (("players", "A3", "as"), 0),
    ):
        perturbed = deepcopy(stored)
        target = perturbed
        for key in path[:-1]:
            target = target[key]
        target[path[-1]] = replacement
        with pytest.raises(AssertionError):
            assert_export_frame_reproducible(perturbed, stored)
    perturbed = deepcopy(stored)
    grid = bytearray(base64.b64decode(perturbed["players"]["A7"]["heatmap"]))
    grid[0] ^= 1
    perturbed["players"]["A7"]["heatmap"] = base64.b64encode(grid).decode("ascii")
    with pytest.raises(AssertionError):
        assert_export_frame_reproducible(perturbed, stored)
    perturbed = deepcopy(stored)
    del perturbed["players"]["B3"]
    with pytest.raises(AssertionError):
        assert_export_frame_reproducible(perturbed, stored)

    # No absolute tolerance can turn a positive metric into zero, even far below
    # display precision; reject beyond the declared relative boundary as well.
    assert_scalar_reproducible(0, 0, "zero")
    for expected in (1e-12, 1, 1000):
        assert_scalar_reproducible(expected * (1 + .99e-6), expected, "inside boundary")
        with pytest.raises(AssertionError):
            assert_scalar_reproducible(expected * (1 + 1.01e-6), expected, "outside boundary")
    with pytest.raises(AssertionError):
        assert_scalar_reproducible(1e-20, 0, "zero remains exact")


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
