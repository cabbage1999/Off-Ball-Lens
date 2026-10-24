from copy import deepcopy
import base64
import numpy as np
import pandas as pd
import pytest

from analytics.adapter import frame_issue, geometric_offside_ids, tracking_rows
from analytics.compute_das import analyze_frame, author_call, compute_frames
from analytics.config import HEATMAP, author_kwargs
from analytics.fixtures import change_player, mirror_frame, toy_frame
from analytics.heatmap import radial_widths


def test_author_sample_and_adapter_parity():
    import accessible_space as asp
    from accessible_space.tests.resources import df_tracking
    from accessible_space.core import integrate_surfaces
    sample = df_tracking[df_tracking.frame_id <= 2].copy()
    published = asp.get_dangerous_accessible_space(
        sample.copy(), period_col="period_id", player_in_possession_col="player_in_possession",
        infer_attacking_direction=True, use_progress_bar=False,
    )
    assert float(published.acc_space.iloc[0]) == pytest.approx(2395.148926, rel=2e-6)
    assert float(published.das.iloc[0]) == pytest.approx(0.410518, rel=2e-5)
    sample["attack_direction"] = 1
    wrapped = author_call(sample)
    direct = asp.get_individual_dangerous_accessible_space(sample.copy(), **author_kwargs())
    np.testing.assert_allclose(wrapped.player_das, direct.player_das, equal_nan=True)
    np.testing.assert_allclose(wrapped.player_acc_space, direct.player_acc_space, equal_nan=True)
    integrated = integrate_surfaces(wrapped.dangerous_result).player_poss
    for i in range(len(sample)):
        if sample.iloc[i].player_id != "ball":
            assert wrapped.player_das.iloc[i] == integrated[int(wrapped.frame_index.iloc[i]), int(wrapped.player_index.iloc[i])]


def test_explicit_mapping_all_22_and_author_integral():
    frame = toy_frame()
    frame["players"].reverse()  # mapping must never assume original array order
    output, audit = compute_frames([frame])
    result = output[0]
    assert len(result["players"]) == len(audit["rawMappings"]) == 22
    tracking = pd.DataFrame(tracking_rows(frame))
    official = author_call(tracking)
    for i, row in tracking.iterrows():
        if row.player_id == "ball":
            assert np.isnan(official.player_das.iloc[i])
            continue
        p = result["players"][row.player_id]
        if p["status"] == "eligible":
            assert p["das"] == official.player_das.iloc[i]
            assert p["as"] == official.player_acc_space.iloc[i]
            assert len(base64.b64decode(p["heatmap"])) == HEATMAP["width"] * HEATMAP["height"]
        else:
            assert p["as"] is None and p["das"] is None and p["heatmap"] is None
    assert result["players"]["A6"]["status"] == "carrier"
    assert result["players"]["B3"]["status"] == "defending"


def test_mirror_and_heatmap_mapping():
    a = analyze_frame(toy_frame())
    b = analyze_frame(mirror_frame(toy_frame()))
    for pid, value in a["players"].items():
        assert value["status"] == b["players"][pid]["status"]
        assert value["das"] == b["players"][pid]["das"]
        if value["heatmap"]:
            grid = np.frombuffer(base64.b64decode(value["heatmap"]), dtype=np.uint8).reshape(23, 35)
            mirrored = np.frombuffer(base64.b64decode(b["players"][pid]["heatmap"]), dtype=np.uint8).reshape(23, 35)
            np.testing.assert_array_equal(grid[:, ::-1], mirrored)


def test_carrier_offside_and_raw_zeros():
    frame = change_player(toy_frame(), "A7", x=44, vx=7)
    assert "A7" in geometric_offside_ids(frame)
    outputs, audit = compute_frames([frame])
    assert outputs[0]["players"]["A7"]["status"] == "offside"
    assert outputs[0]["players"]["A7"]["das"] is None
    for pid in ("A6", "A7"):
        raw = next(r for r in audit["rawMappings"] if r["playerId"] == pid)
        assert raw["authorAs"] == raw["authorDas"] == 0
    # Own-half positions are not offside even if all defenders are behind them.
    frame = change_player(frame, "A7", x=-2)
    assert "A7" not in geometric_offside_ids(frame)


@pytest.mark.parametrize("case,reason", [
    ("missing_opponent", "incomplete_or_duplicate_roster"), ("duplicate", "incomplete_or_duplicate_roster"),
    ("nan", "invalid_player_tracking"), ("flight", "ball_in_flight"),
    ("height", "non_ground_ball"), ("loose", "loose_ball"), ("dead", "dead_ball"),
    ("unknown", "unknown_possession"), ("direction", "unknown_attack_direction"),
    ("carrier_distance", "ball_not_controlled_by_carrier"), ("game_mode", "not_open_play"),
])
def test_invalid_states_are_unavailable(case, reason):
    f = toy_frame()
    if case == "missing_opponent": f["players"] = [p for p in f["players"] if p["id"] != "B2"]
    elif case == "duplicate": f["players"][-1] = deepcopy(f["players"][-2])
    elif case == "nan": f["players"][2]["x"] = float("nan")
    elif case == "flight": f["ball"]["state"] = "in_flight"; f["carrierId"] = None
    elif case == "height": f["ball"]["z"] = 0.6
    elif case == "loose": f["ball"]["state"] = "loose"
    elif case == "dead": f["ball"]["state"] = "dead"
    elif case == "unknown": f["attackingTeam"] = None
    elif case == "direction": f["attackDirection"] = None
    elif case == "carrier_distance": f["ball"]["x"] = 15
    elif case == "game_mode": f["gameMode"] = "stoppage"
    assert frame_issue(f) == reason
    result = analyze_frame(f)
    assert result["status"] == "invalid" and result["reason"] == reason
    assert all(p["das"] is None and p["as"] is None and p["heatmap"] is None for p in result["players"].values())


def test_scalar_not_changed_by_display_and_same_frame_entry():
    frames = []
    for i in range(3):
        f = change_player(toy_frame(), "A7", x=26 + i)
        f.update(index=2*i, frameId=f"unit:{i:04}", t=i/5)
        frames.append(f)
    batch, _ = compute_frames(frames)
    without, _ = compute_frames(frames, include_heatmaps=False)
    for f, b, w in zip(frames, batch, without):
        one = analyze_frame(f)
        for pid, p in b["players"].items():
            assert p["das"] == w["players"][pid]["das"] == one["players"][pid]["das"]
            assert p["heatmap"] == one["players"][pid]["heatmap"]


def test_density_conversion_units_use_author_radial_cell_widths():
    np.testing.assert_array_equal(radial_widths(np.array([0., 3., 6., 9.])), [1.5, 3, 3, 1.5])


def test_direction_changes_danger_and_float32_offside_boundary():
    frame = toy_frame()
    forward = analyze_frame(frame, include_heatmaps=False)
    frame["attackDirection"] = -1
    reversed_direction = analyze_frame(frame, include_heatmaps=False)
    assert reversed_direction["players"]["A7"]["das"] != pytest.approx(forward["players"]["A7"]["das"])
    # 37 + 1e-8 rounds onto the second-last defender at the author's precision.
    near_line = change_player(toy_frame(), "A7", x=37 + 1e-8)
    assert "A7" not in geometric_offside_ids(near_line)
    assert analyze_frame(near_line, include_heatmaps=False)["players"]["A7"]["status"] == "eligible"
