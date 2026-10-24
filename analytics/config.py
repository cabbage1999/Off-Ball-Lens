"""Pinned author parameters and explicit product choices; no fitted custom score."""
from __future__ import annotations

import hashlib
import inspect
import json
import os
from pathlib import Path

# The author imports matplotlib even for numerical work. Keep its disposable cache
# inside the project rather than trying to write to the user's home directory.
os.environ.setdefault("MPLCONFIGDIR", str(Path(__file__).parent / ".cache" / "matplotlib"))

PACKAGE_VERSION = "2.1.0"
SOURCE = "https://github.com/jonas-bischofberger/accessible-space"
PAPER = "https://doi.org/10.1186/s40537-026-01387-8"
PITCH = {"length": 105, "width": 68, "originX": -52.5, "originY": -34}
ROSTER = tuple(f"{team}{number}" for team in ("A", "B") for number in range(1, 12))
ANALYSIS_RATE = 5
HEATMAP = {
    "width": 35, "height": 23, "xMin": -52.5, "xMax": 52.5,
    "yMin": -34, "yMax": 34, "encoding": "base64-uint8",
    "quantity": "danger_weighted_accessibility", "unit": "dimensionless",
    "scaleMax": 0.1, "layout": "row-major-y-ascending-x-ascending",
    "sampleLocation": "cell-centre", "scaleScope": "global-fixed",
    "source": "accessible_space dangerous_result.player_poss_density multiplied by the author's radial cell widths (dr); an approximation of C_i(x) V(x), not a pass probability.",
    "interpolation": "Periodic bilinear interpolation in the author's polar grid onto rectangular cell centres. Out-of-pitch source nodes are zero. Quantized to uint8 using a global fixed [0, 0.1] scale; larger values saturate. Display only; AS/DAS are the author's separate integrals.",
}
FILTERS = {
    "requiredRoster": list(ROSTER), "requiredGameMode": "open_play",
    "requiredBallState": "possessed", "maxGroundBallZ": 0.15,
    "maxCarrierBallDistance": 2.0, "coordinateSystem": "centre-origin metres",
    "directionNormalization": "x and vx multiplied by explicit attacking direction; y and vy unchanged; author API receives +1; display x is restored",
}
MOMENT_CONFIG = {
    "name": "causal-hysteresis-v1", "openDas": 0.5, "closeDas": 0.3,
    "minOpenSeconds": 0.6, "minCloseSeconds": 0.4,
    "units": "danger-weighted m²", "samplingRate": ANALYSIS_RATE,
    "meaning": "Product notification rule, not a validated football quality threshold. Uses only observed numerical prefixes and occurred events. Windows split on invalid state, carrier or possession change.",
}


def author_kwargs(overrides: dict | None = None) -> dict:
    options = {
        "period_col": "period_id", "player_in_possession_col": "player_in_possession",
        "attacking_direction_col": "attack_direction", "infer_attacking_direction": False,
        "exclude_passer": True, "respect_offside": True, "use_progress_bar": False,
        "chunk_size": 10, "return_cropped_result": True,
        "x_pitch_min": -52.5, "x_pitch_max": 52.5, "y_pitch_min": -34, "y_pitch_max": 34,
    }
    options.update(overrides or {})
    return options


def model_metadata() -> dict:
    import accessible_space as asp
    from importlib.metadata import version
    installed = version("accessible-space")
    if installed != PACKAGE_VERSION:
        raise RuntimeError(f"Expected accessible-space=={PACKAGE_VERSION}, found {installed}")
    signature = inspect.signature(asp.get_individual_dangerous_accessible_space)
    defaults = {
        key: value.default for key, value in signature.parameters.items()
        if value.default is not inspect.Parameter.empty
        and isinstance(value.default, (type(None), str, int, float, bool))
    }
    defaults.update(author_kwargs())
    config = {"authorApi": defaults, "filters": FILTERS, "heatmap": HEATMAP,
              "momentDetector": MOMENT_CONFIG, "analysisRate": ANALYSIS_RATE}
    digest = hashlib.sha256(json.dumps(config, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    return {
        "name": "individual Dangerous Accessible Space", "package": "accessible-space",
        "version": installed, "adapterVersion": "2.0.0", "config": config,
        "configHash": digest, "source": SOURCE, "paper": PAPER, "license": "MIT",
        "units": {"as": "m²", "das": "danger-weighted m²", "heatmap": "dimensionless"},
        "parameterProvenance": "Author API defaults from pinned 2.1.0, except explicit receiving-only carrier exclusion, direction, pitch, chunking and returned fields. Filter, display and window choices are product settings, not fitted model parameters.",
    }
