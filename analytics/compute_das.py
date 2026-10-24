"""Run the pinned author's API for one frame or a complete 5 Hz scene."""
from __future__ import annotations

import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import time

from .config import ANALYSIS_RATE, HEATMAP, MOMENT_CONFIG, PACKAGE_VERSION, author_kwargs, model_metadata
from .adapter import attack_direction, empty_result, frame_issue, geometric_offside_ids, tracking_rows
from .heatmap import encode_heatmap
from .build_moments import build_moments


def author_call(tracking, overrides: dict | None = None):
    """Single official call boundary, also used in parity and numerical audits."""
    import accessible_space as asp
    from importlib.metadata import version
    if version("accessible-space") != PACKAGE_VERSION:
        raise RuntimeError(f"This adapter requires accessible-space=={PACKAGE_VERSION}")
    return asp.get_individual_dangerous_accessible_space(tracking.copy(deep=True), **author_kwargs(overrides))


def compute_frames(frames: list[dict], include_heatmaps: bool = True, overrides: dict | None = None):
    import numpy as np
    import pandas as pd
    outputs, valid = [], []
    for frame in frames:
        issue = frame_issue(frame)
        output = empty_result(frame, issue)
        outputs.append(output)
        if issue is None:
            valid.append((frame, output))
    audit = {"authorSeconds": 0.0, "displaySeconds": 0.0, "validFrames": len(valid),
             "inputFrames": len(frames), "heatmapMax": 0.0, "saturatedCells": 0,
             "rawMappings": [], "invalidReasons": dict(Counter(o["reason"] for o in outputs if o["status"] == "invalid"))}
    if not valid:
        return outputs, audit
    tracking = pd.DataFrame([row for frame, _ in valid for row in tracking_rows(frame)])
    started = time.perf_counter()
    result = author_call(tracking, overrides)
    audit["authorSeconds"] = time.perf_counter() - started
    audit["rawShapes"] = {name: list(getattr(result.simulation_result, name).shape)
                          for name in ("player_poss_density", "x_grid", "y_grid", "phi_grid", "r_grid")}
    frame_by_id = {frame["frameId"]: (frame, output) for frame, output in valid}
    offside_by_id = {frame["frameId"]: geometric_offside_ids(frame) for frame, _ in valid}
    started = time.perf_counter()
    for row_index, row in tracking.iterrows():
        pid = row["player_id"]
        if pid == "ball":
            if not np.isnan(result.player_acc_space.iloc[row_index]) or not np.isnan(result.player_das.iloc[row_index]):
                raise AssertionError("The author's ball row must remain NaN, not a player score")
            continue
        frame, output = frame_by_id[row["frame_id"]]
        fi = int(result.frame_index.iloc[row_index])
        pi = int(result.player_index.iloc[row_index])
        raw_as, raw_das = float(result.player_acc_space.iloc[row_index]), float(result.player_das.iloc[row_index])
        if not np.isfinite(raw_as) or not np.isfinite(raw_das) or min(raw_as, raw_das) < 0:
            raise ArithmeticError(f"Invalid author output for {frame['frameId']} {pid}")
        status = ("carrier" if pid == frame["carrierId"] else "defending" if row["team_id"] != frame["attackingTeam"]
                  else "offside" if pid in offside_by_id[frame["frameId"]] else "eligible")
        audit["rawMappings"].append({"frameId": frame["frameId"], "playerId": pid,
                                     "frameIndex": fi, "playerIndex": pi,
                                     "authorAs": raw_as, "authorDas": raw_das, "productStatus": status})
        if status in ("carrier", "offside") and (abs(raw_as) > 1e-5 or abs(raw_das) > 1e-5):
            raise AssertionError(f"Author exclusion disagrees with product status: {pid} {status}")
        player = {"status": status, "as": raw_as if status == "eligible" else None,
                  "das": raw_das if status == "eligible" else None, "heatmap": None}
        if status == "eligible" and include_heatmaps:
            player["heatmap"], stats = encode_heatmap(result.dangerous_result, fi, pi, attack_direction(frame))
            audit["heatmapMax"] = max(audit["heatmapMax"], stats["max"])
            audit["saturatedCells"] += stats["saturatedCells"]
        output["players"][pid] = player
    audit["displaySeconds"] = time.perf_counter() - started
    return outputs, audit


def analyze_frame(frame: dict, include_heatmaps: bool = True) -> dict:
    """The online entry uses exactly the same numerical and display path as batch."""
    return compute_frames([frame], include_heatmaps=include_heatmaps)[0][0]


def analyze_scene(scene: dict, include_heatmaps: bool = True):
    started = time.perf_counter()
    rate = scene["metadata"]["sampleRate"]
    stride = round(rate / ANALYSIS_RATE)
    if stride < 1 or abs(rate / stride - ANALYSIS_RATE) > 1e-9:
        raise ValueError("Tracking rate must be an integer multiple of 5 Hz")
    all_frames = scene["frames"]
    ids = [f["frameId"] for f in all_frames]
    if len(ids) != len(set(ids)) or any(b["t"] <= a["t"] for a, b in zip(all_frames, all_frames[1:])):
        raise ValueError("Frame identities must be unique and timestamps strictly increasing")
    samples = all_frames[::stride]
    frames, audit = compute_frames(samples, include_heatmaps=include_heatmaps)
    moments = build_moments(frames, scene.get("events", []))
    audit["totalSeconds"] = time.perf_counter() - started
    audit["msPerSampleIncludingInvalid"] = 1000 * audit["totalSeconds"] / len(samples)
    audit["secondsOfTracking"] = all_frames[-1]["t"] - all_frames[0]["t"]
    audit["opportunityWindowCount"] = len(moments)
    analysis = {
        "schemaVersion": "2.0", "scenarioId": scene["metadata"]["id"],
        "model": model_metadata(), "mode": "precomputed", "sampleRate": ANALYSIS_RATE,
        "frames": frames, "moments": moments, "heatmapMeta": dict(HEATMAP),
        "momentDetector": dict(MOMENT_CONFIG),
        "inputHash": hashlib.sha256(json.dumps(scene, sort_keys=True, separators=(",", ":")).encode()).hexdigest(),
        "summary": {"frames": len(frames), "validFrames": audit["validFrames"],
                    "invalidReasons": audit["invalidReasons"], "heatmapSaturatedCells": audit["saturatedCells"]},
    }
    return analysis, audit


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("scenes", nargs="*", default=["used", "unused", "blocked"])
    parser.add_argument("--frame", type=int, help="Analyze one tracking frame and print JSON")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    destination = root / "data" / "analysis"
    destination.mkdir(parents=True, exist_ok=True)
    audits = root / "analytics" / "reports"
    audits.mkdir(parents=True, exist_ok=True)
    for name in args.scenes:
        path = Path(name) if name.endswith(".json") else root / "data" / f"{name}.json"
        source_bytes = path.read_bytes()
        scene = json.loads(source_bytes)
        if args.frame is not None:
            print(json.dumps(analyze_frame(scene["frames"][args.frame]), allow_nan=False))
            continue
        analysis, audit = analyze_scene(scene)
        analysis["inputFileHash"] = hashlib.sha256(source_bytes).hexdigest()
        audit["inputHash"] = analysis["inputHash"]
        audit["inputFileHash"] = analysis["inputFileHash"]
        scenario_id = scene["metadata"]["id"]
        # Avoid showing a half-written analysis file during UI integration.
        target = destination / f"{scenario_id}.json"
        temporary = target.with_suffix(".tmp")
        temporary.write_text(json.dumps(analysis, ensure_ascii=False, separators=(",", ":"), allow_nan=False))
        temporary.replace(target)
        (audits / f"{scenario_id}-audit.json").write_text(json.dumps(audit, indent=2, allow_nan=False))
        print(json.dumps({"scenario": scenario_id, **{k: v for k, v in audit.items() if k != "rawMappings"}}))


if __name__ == "__main__":
    main()
