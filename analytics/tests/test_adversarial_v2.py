"""Independent source binding and display-field audits, not football ground truth."""
import base64
import hashlib
import json
import math
import sys
from pathlib import Path

import numpy as np
import pandas as pd

from analytics.config import author_kwargs
from analytics import compute_das


ROOT = Path(__file__).resolve().parents[2]


def test_cli_hash_binds_the_bytes_that_were_actually_analyzed(tmp_path, monkeypatch):
    """An input rewrite during computation must never bless stale values."""
    (tmp_path / "analytics").mkdir()
    source_path = tmp_path / "scene.json"
    source = {"metadata": {"id": "race-fixture"}, "frames": [{"x": 1}]}
    source_path.write_text(json.dumps(source))
    original_bytes = source_path.read_bytes()

    def compute_while_input_changes(old_scene):
        old_value = old_scene["frames"][0]["x"]
        old_hash = hashlib.sha256(json.dumps(old_scene, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
        source["frames"][0]["x"] = 999
        source_path.write_text(json.dumps(source))
        return {"sourceValueSeenByAnalysis": old_value, "inputHash": old_hash}, {"validFrames": 1}

    monkeypatch.setattr(compute_das, "__file__", str(tmp_path / "analytics" / "compute_das.py"))
    monkeypatch.setattr(compute_das, "analyze_scene", compute_while_input_changes)
    monkeypatch.setattr(sys, "argv", ["audit", str(source_path)])
    compute_das.main()
    output = json.loads((tmp_path / "data" / "analysis" / "race-fixture.json").read_text())
    assert output["sourceValueSeenByAnalysis"] == 1
    assert output["inputFileHash"] == hashlib.sha256(original_bytes).hexdigest()
    assert output["inputFileHash"] != hashlib.sha256(source_path.read_bytes()).hexdigest()


def test_official_fields_survive_roster_reordering_and_independent_grid_conversion():
    """Rebuild long rows, area sectors and display interpolation independently.

    Deliberately do not call adapter.tracking_rows, heatmap.radial_widths,
    heatmap.display_field or compute_frames. Negative attacking direction and
    all eligible players in the chosen frames are included.
    """
    import accessible_space as author

    choices = [("used", 0), ("used", 104), ("used", 200), ("unused", 104),
               ("blocked", 168), ("blocked", 214)]
    fields_checked = 0
    cells_checked = 0
    max_code_difference = 0
    max_das_difference = 0.0
    max_as_difference = 0.0
    negative_direction_checked = False
    for name, index in choices:
        scene = json.loads((ROOT / "data" / f"{name}.json").read_text())
        exported = json.loads((ROOT / "data" / "analysis" / f"{name}.json").read_text())
        frame = scene["frames"][index]
        output = next(item for item in exported["frames"] if item["frameIndex"] == index)
        assert output["status"] == "valid"
        direction = frame["attackDirection"]
        if isinstance(direction, dict):
            direction = direction[frame["attackingTeam"]]
        negative_direction_checked |= direction == -1
        common = {"frame_id": frame["frameId"], "period_id": frame["periodId"],
                  "team_in_possession": frame["attackingTeam"],
                  "player_in_possession": frame["carrierId"], "attack_direction": 1}
        ball = frame["ball"]
        records = [{**common, "player_id": "ball", "team_id": None,
                    "x": ball["x"] * direction, "y": ball["y"],
                    "vx": ball["vx"] * direction, "vy": ball["vy"]}]
        records += [{**common, "player_id": p["id"], "team_id": p["team"],
                     "x": p["x"] * direction, "y": p["y"],
                     "vx": p["vx"] * direction, "vy": p["vy"]}
                    for p in reversed(frame["players"])]
        official = author.get_individual_dangerous_accessible_space(pd.DataFrame(records), **author_kwargs())
        raw = official.dangerous_result
        radii = list(map(float, raw.r_grid))
        angles = list(map(float, raw.phi_grid[0]))
        radial_low = [radii[0]] + [(a + b) / 2 for a, b in zip(radii, radii[1:])]
        radial_high = radial_low[1:] + [radii[-1]]
        widths = np.array([b - a for a, b in zip(radial_low, radial_high)])
        angular_low = [angles[0]] + [(a + b) / 2 for a, b in zip(angles, angles[1:])]
        angular_high = angular_low[1:] + [angles[-1]]
        sector_areas = np.array([(b - a) / 2 for a, b in zip(angular_low, angular_high)])[:, None]
        sector_areas = sector_areas * (np.array(radial_high) ** 2 - np.array(radial_low) ** 2)[None, :]
        meta = exported["heatmapMeta"]
        assert (meta["width"], meta["height"], meta["scaleMax"]) == (35, 23, .1)
        assert meta["unit"] == "dimensionless"
        for row, record in enumerate(records):
            player_id = record["player_id"]
            if player_id == "ball" or output["players"][player_id]["status"] != "eligible":
                continue
            fi, pi = int(official.frame_index.iloc[row]), int(official.player_index.iloc[row])
            product = output["players"][player_id]
            density = raw.player_poss_density[fi, pi].astype(float)
            independent_das = float(np.sum(density * widths[None, :] * sector_areas))
            independent_as = float(np.sum(official.simulation_result.player_poss_density[fi, pi].astype(float) * widths[None, :] * sector_areas))
            max_das_difference = max(max_das_difference, abs(independent_das - product["das"]))
            max_as_difference = max(max_as_difference, abs(independent_as - product["as"]))
            assert math.isclose(independent_das, product["das"], rel_tol=2e-6, abs_tol=2e-6)
            assert math.isclose(independent_as, product["as"], rel_tol=2e-6, abs_tol=1e-3)
            field = density * widths[None, :]
            codes = []
            for yi in range(meta["height"]):
                y = meta["yMin"] + (yi + .5) * (meta["yMax"] - meta["yMin"]) / meta["height"]
                for xi in range(meta["width"]):
                    x = (meta["xMin"] + (xi + .5) * (meta["xMax"] - meta["xMin"]) / meta["width"]) * direction
                    radius = math.hypot(x - ball["x"] * direction, y - ball["y"])
                    angle = (math.atan2(y - ball["y"], x - ball["x"] * direction) - angles[0]) % (2 * math.pi)
                    fractional_ray = angle * len(angles) / (2 * math.pi)
                    ray = math.floor(fractional_ray)
                    weight = fractional_ray - ray
                    # Reverse the production interpolation order: radial first.
                    first = float(np.interp(radius, radii, field[ray % len(angles)], left=0, right=0))
                    second = float(np.interp(radius, radii, field[(ray + 1) % len(angles)], left=0, right=0))
                    value = (1 - weight) * first + weight * second
                    codes.append(round(255 * min(1, max(0, value / meta["scaleMax"]))))
            actual = list(base64.b64decode(product["heatmap"]))
            assert len(actual) == len(codes) == 805
            # At most one uint8 code allows independently ordered roundoff.
            difference = max(abs(a - b) for a, b in zip(actual, codes))
            assert difference <= 1
            max_code_difference = max(max_code_difference, difference)
            cells_checked += len(actual)
            fields_checked += 1
    assert fields_checked >= 50
    assert negative_direction_checked
    print("adversarial_heatmap_audit=" + json.dumps({
        "frames": len(choices), "eligiblePlayerFields": fields_checked,
        "decodedCells": cells_checked, "maxQuantizedCodeDifference": max_code_difference,
        "maxIndependentDasIntegralAbsDifference": max_das_difference,
        "maxIndependentAsIntegralAbsDifference": max_as_difference,
    }))
