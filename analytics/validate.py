"""Reproducible numerical, temporal, qualitative and timing audit."""
from __future__ import annotations

from copy import deepcopy
import hashlib
from importlib import metadata
import json
from pathlib import Path
import platform
import time

from .config import HEATMAP, MOMENT_CONFIG, model_metadata
from .adapter import frame_issue, tracking_rows
from .compute_das import analyze_frame, analyze_scene, author_call, compute_frames
from .fixtures import mirror_frame, qualitative_cases
from .build_moments import build_moments, project_moments

ROOT = Path(__file__).resolve().parents[1]


def metrics(result, ids):
    return {pid: {k: result["players"][pid][k] for k in ("status", "as", "das")} for pid in ids}


def run_qualitative():
    records = []
    for case in qualitative_cases():
        records.append({
            "id": case["id"], "question": case["description"],
            "playerIds": case["playerIds"], "snapshots": [
                {"input": frame, "status": (r := analyze_frame(frame, include_heatmaps=False))["status"],
                 "reason": r["reason"], "metrics": metrics(r, case["playerIds"])} for frame in case["frames"]],
        })
    return {"reviewType": "Internal, model-assisted qualitative scrutiny; no independent football expert labels or accuracy ground truth.",
            "caseCount": len(records), "cases": records}


def value_error(reference, other):
    import numpy as np
    absolute, relative = [], []
    statuses = 0
    for a, b in zip(reference, other):
        for pid, pa in a["players"].items():
            pb = b["players"][pid]
            if pa["status"] != pb["status"]:
                statuses += 1
            if pa["das"] is not None and pb["das"] is not None:
                absolute.append(abs(pa["das"] - pb["das"]))
                if pa["das"] >= 0.1:
                    relative.append(abs(pa["das"] - pb["das"]) / pa["das"])
    return {"maxAbsoluteDas": max(absolute, default=0),
            "medianRelativeDasAbove0p1": float(np.median(relative)) if relative else None,
            "maxRelativeDasAbove0p1": max(relative, default=0), "statusChanges": statuses}


def window_brief(moments, pid="A7"):
    return [{k: m[k] for k in ("startTime", "detectedAtTime", "endTime", "peakTime", "peakDas")} | {"outcome": m["outcome"]["status"]}
            for m in moments if m["playerId"] == pid]


def main():
    import numpy as np
    import pandas as pd
    import accessible_space as asp
    report_dir = ROOT / "analytics" / "reports"
    report_dir.mkdir(exist_ok=True)
    config = model_metadata()
    report = {"modelConfigHash": config["configHash"], "python": platform.python_version(),
              "platform": platform.platform(), "machine": platform.machine(),
              "timingScope": "Local Python process only, warm author import; includes validation, official integration, heatmap conversion and moments where stated; excludes browser, network and LLM. Not a production SLA.",
              "scenes": {}}
    package_dir = Path(asp.__file__).parent
    report["authorSourceSha256"] = {name: hashlib.sha256((package_dir / name).read_bytes()).hexdigest()
                                   for name in ("interface.py", "core.py", "motion_models.py", "utility.py")}
    wheel = ROOT / "analytics/.cache/wheels/accessible_space-2.1.0-py3-none-any.whl"
    if wheel.exists():
        report["authorWheelSha256"] = hashlib.sha256(wheel.read_bytes()).hexdigest()
    qualitative = run_qualitative()  # also warms numeric and plotting imports
    (report_dir / "qualitative-cases.json").write_text(json.dumps(qualitative, indent=2, ensure_ascii=False, allow_nan=False))
    for name in ("used", "unused", "blocked"):
        scene = json.loads((ROOT / "data" / f"{name}.json").read_text())
        analysis, audit = analyze_scene(scene)
        frames = analysis["frames"]
        # Every cutoff projects identical complete objects, including peaks and outcomes.
        for frame in frames:
            prefix = build_moments(frames, scene["events"], as_of_time=frame["t"])
            if project_moments(prefix, frame["t"]) != project_moments(analysis["moments"], frame["t"]):
                raise AssertionError(f"Future leakage at {frame['frameId']}")
        valid = [f for f in scene["frames"][::2] if frame_issue(f) is None]
        picks = [valid[i] for i in np.linspace(0, len(valid)-1, min(10, len(valid)), dtype=int)]
        latency = []
        for frame in picks:
            start = time.perf_counter(); single = analyze_frame(frame); latency.append(1000*(time.perf_counter()-start))
            batch = next(f for f in frames if f["frameId"] == single["frameId"])
            if batch != single:
                raise AssertionError("Single-frame and batch outputs differ")
        mir_frames, _ = compute_frames([mirror_frame(f) for f in picks], include_heatmaps=False)
        ref_frames, _ = compute_frames(picks, include_heatmaps=False)
        mirror_error = value_error(ref_frames, mir_frames)
        if mirror_error["maxAbsoluteDas"] != 0:
            raise AssertionError("Canonical left-right mirror mismatch")
        # Record default-grid numerical approximation rather than silently patching
        # the author's integration or treating a finer grid as ground truth.
        fine_frames, _ = compute_frames(picks, include_heatmaps=False,
                                       overrides={"n_angles": 60, "radial_gridsize": 1.5})
        direct_errors = []
        for frame in picks:
            mirrored = mirror_frame(frame)
            canonical = author_call(pd.DataFrame(tracking_rows(mirrored)))
            direct = author_call(pd.DataFrame(tracking_rows(mirrored, canonical=False)))
            ids = [r["player_id"] for r in tracking_rows(mirrored)]
            for i, pid in enumerate(ids):
                if pid != "ball" and pid.startswith(mirrored["attackingTeam"]):
                    direct_errors.append(abs(float(canonical.player_das.iloc[i]) - float(direct.player_das.iloc[i])))
        rng = np.random.default_rng(20261024)
        perturbed = deepcopy(scene["frames"][::2])
        for f in perturbed:
            for p in f["players"]:
                dx, dy = rng.normal(0, 0.1, size=2)
                p["x"] = float(np.clip(p["x"] + dx, -52.5, 52.5)); p["y"] = float(np.clip(p["y"] + dy, -34, 34))
                if p["id"] == f["carrierId"]:
                    f["ball"]["x"] += dx; f["ball"]["y"] += dy
        noise_frames, _ = compute_frames(perturbed, include_heatmaps=False)
        noise_moments = build_moments(noise_frames, scene["events"])
        sampled = frames[::2]
        low_rate_moments = build_moments(sampled, scene["events"], config={"samplingRate": 2.5})
        threshold_sweep = {}
        for threshold in (0.25, 0.5, 1.0):
            ms = build_moments(frames, scene["events"], config={"openDas": threshold, "closeDas": 0.6*threshold})
            threshold_sweep[str(threshold)] = {"totalWindows": len(ms), "A7": window_brief(ms)}
        report["scenes"][name] = {
            "inputHash": analysis["inputHash"],
            "inputFileHash": hashlib.sha256((ROOT / "data" / f"{name}.json").read_bytes()).hexdigest(),
            "warmBatchSeconds": audit["totalSeconds"],
            "authorSeconds": audit["authorSeconds"], "displaySeconds": audit["displaySeconds"],
            "analysisFrames": len(frames), "validFrames": audit["validFrames"],
            "rawShape": audit["rawShapes"]["player_poss_density"],
            "singleFrameMsMedian": float(np.median(latency)), "singleFrameMsP95": float(np.percentile(latency,95)),
            "prefixChecks": len(frames), "mirror": mirror_error,
            "directWorldVsCanonicalMaxAbsoluteDas": max(direct_errors),
            "coarseVs60Angles1p5m": value_error(ref_frames, fine_frames),
            "positionNoise0p1m": value_error(frames, noise_frames),
            "A7Windows": window_brief(analysis["moments"]), "A7WindowsWithPositionNoise": window_brief(noise_moments),
            "A7WindowsAt2p5Hz": window_brief(low_rate_moments), "thresholdSensitivity": threshold_sweep,
            "heatmapMax": audit["heatmapMax"], "saturatedCells": audit["saturatedCells"],
        }
        print(name, "validated", json.dumps({k: report["scenes"][name][k] for k in ("warmBatchSeconds", "singleFrameMsMedian", "mirror", "coarseVs60Angles1p5m", "positionNoise0p1m")}))
    (report_dir / "validation.json").write_text(json.dumps(report, indent=2, allow_nan=False))
    dependencies = sorted({d.metadata["Name"]: d.version for d in metadata.distributions() if d.metadata["Name"].lower() not in ("pip", "setuptools")}.items(), key=lambda kv: kv[0].lower())
    (ROOT / "requirements-das.lock").write_text("# Resolved on Python 3.12; exact versions, no local file dependencies.\n" + "\n".join(f"{name}=={version}" for name,version in dependencies) + "\n")
    # Preserve the distribution's actual MIT text, rather than replacing its attribution.
    license_file = next(p for p in metadata.distribution("accessible-space").files if str(p).endswith("licenses/LICENSE"))
    (ROOT / "analytics/ACCESSIBLE_SPACE_LICENSE.txt").write_bytes(metadata.distribution("accessible-space").locate_file(license_file).read_bytes())
    write_qualitative_document(qualitative)


def write_qualitative_document(report):
    lines = ["# Qualitative scrutiny of direct receiving space", "",
             report["reviewType"], "", "These ten independently specified toy snapshots exercise interpretation boundaries. They are not training examples, calibrated accuracy labels, complete match simulations, or counterfactual contribution estimates. All 22 players are included except the explicitly invalid missing-defender case. Input snapshots and unrounded outputs are in `analytics/reports/qualitative-cases.json`.", "",
             "AS is m²; DAS is danger-weighted m². A null product metric means not applicable, not zero value. These observations must not be promoted to expert validation.", ""]
    for i, case in enumerate(report["cases"],1):
        lines += [f"## {i}. {case['id'].replace('_',' ').capitalize()}", "", case["question"], "", "| Snapshot | Player | Status | AS (m²) | DAS (danger-weighted m²) |", "| --- | --- | --- | ---: | ---: |"]
        for j,s in enumerate(case["snapshots"],1):
            for pid,m in s["metrics"].items():
                av = "unavailable" if m["as"] is None else f"{m['as']:.3f}"
                dv = "unavailable" if m["das"] is None else f"{m['das']:.4f}"
                status = m["status"] + (f" ({s['reason']})" if s["reason"] else "")
                lines += [f"| {j} | {pid} | {status} | {av} | {dv} |"]
        if len(case["snapshots"]) == 2:
            observations = []
            for pid in case["playerIds"]:
                a,b = [s["metrics"][pid]["das"] for s in case["snapshots"]]
                if a is not None and b is not None:
                    direction = "increased" if b>a else "decreased" if b<a else "was unchanged"
                    observations.append(f"{pid}'s DAS {direction} ({b-a:+.4f}).")
            if observations: lines += ["", "Observed: " + " ".join(observations)]
        if case["id"] == "decoy_boundary":
            lines += ["", "Interpretation boundary: the two snapshots change both a receiver and a defender. Any increase for A9 is an association with the joint configuration. The system cannot assign it to A7, and a lower A7 DAS cannot establish that the wide movement was poor. No causal credit or quality label is emitted."]
        lines += [""]
    lines += ["## What remains unvalidated", "", "An independent football practitioner has not adjudicated these cases. The synthetic clips do not reproduce the paper's pass-outcome or expert-state benchmark. Sensitivity to finite angular/radial resolution, measurement noise and notification thresholds is reported separately in `analytics/reports/validation.json`. The display is a model-based account of direct receiving opportunities and is not a quality grade for every off-ball action.", ""]
    (ROOT / "docs/qualitative-cases.md").write_text("\n".join(lines))


if __name__ == "__main__":
    main()
