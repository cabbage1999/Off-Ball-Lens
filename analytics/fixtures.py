"""Independent toy snapshots for qualitative scrutiny, never model ground truth."""
from copy import deepcopy
from .config import PITCH


def toy_frame():
    positions = {
        "A1": (-48, 0), "A2": (-10, -27), "A3": (-20, -10), "A4": (-20, 10),
        "A5": (-10, 27), "A6": (8, 0), "A7": (26, -15), "A8": (5, 16),
        "A9": (30, 2), "A10": (18, 11), "A11": (23, 27),
        "B1": (49, 0), "B2": (34, -27), "B3": (37, -6), "B4": (37, 10),
        "B5": (33, 27), "B6": (18, 4), "B7": (3, -26), "B8": (17, 16),
        "B9": (-5, 0), "B10": (0, 10), "B11": (10, 29),
    }
    return {
        "index": 0, "frameId": "toy:0000", "t": 0, "periodId": 1,
        "pitch": dict(PITCH), "attackDirection": 1, "attackingTeam": "A",
        "carrierId": "A6", "gameMode": "open_play",
        "players": [{"id": pid, "team": pid[0], "number": int(pid[1:]),
                     "role": "goalkeeper" if pid[1:] == "1" else "outfield",
                     "x": xy[0], "y": xy[1], "vx": 0, "vy": 0} for pid, xy in positions.items()],
        "ball": {"x": 8.35, "y": 0.12, "vx": 0, "vy": 0, "z": 0, "state": "possessed"},
    }


def change_player(frame, player_id, **changes):
    updated = deepcopy(frame)
    next(p for p in updated["players"] if p["id"] == player_id).update(changes)
    return updated


def mirror_frame(frame):
    updated = deepcopy(frame)
    updated["attackDirection"] *= -1
    for item in updated["players"] + [updated["ball"]]:
        item["x"] *= -1
        item["vx"] *= -1
    return updated


def qualitative_cases():
    base = toy_frame()
    screened = change_player(base, "B6", x=17, y=-7.2)
    marked = change_player(base, "B2", x=25, y=-14)
    offside = change_player(base, "A7", x=43, y=-15, vx=6)
    wrong_momentum = change_player(base, "A7", vx=-6, vy=0)
    inward = change_player(base, "A7", vx=4, vy=2)
    decoy_before = change_player(base, "B3", x=31, y=1)
    decoy_after = change_player(decoy_before, "A7", x=34, y=-28, vx=2, vy=-4)
    decoy_after = change_player(decoy_after, "B3", x=35, y=-20, vx=1, vy=-3)
    missing = deepcopy(base)
    missing["players"] = [p for p in missing["players"] if p["id"] != "B3"]
    high = deepcopy(base); high["ball"]["z"] = 1.2
    flight = deepcopy(base); flight["ball"]["state"] = "in_flight"; flight["carrierId"] = None
    return [
        {"id": "stationary_open", "description": "A stationary A7 in an open channel can retain direct receiving space; running speed is not itself the score.", "playerIds": ["A7"], "frames": [base]},
        {"id": "lane_screen", "description": "Moving one defender into the direct lane can alter the receiver's accessible field; inspect the full field, not only the straight line.", "playerIds": ["A7"], "frames": [base, screened]},
        {"id": "tight_marker", "description": "A nearby marker may suppress direct space even with the receiver in an attacking location.", "playerIds": ["A7"], "frames": [base, marked]},
        {"id": "momentum", "description": "Opposite and inward velocities test sensitivity to current momentum. No universal monotonic speed rule is imposed.", "playerIds": ["A7"], "frames": [wrong_momentum, inward]},
        {"id": "offside_fast_run", "description": "A fast, advanced A7 is removed by the author's geometric offside filter; this is not an official offside decision.", "playerIds": ["A7"], "frames": [offside]},
        {"id": "carrier_exclusion", "description": "The carrier is excluded by configuration. The raw zero is displayed as unavailable for receiving rather than as poor play.", "playerIds": ["A6"], "frames": [base]},
        {"id": "missing_defender", "description": "Missing B3 invalidates the complete snapshot instead of silently creating more space.", "playerIds": ["A7"], "frames": [missing]},
        {"id": "unsupported_ball", "description": "A controlled high ball and a ball in flight are both outside this snapshot receiving analysis.", "playerIds": ["A7"], "frames": [high, flight]},
        {"id": "decoy_boundary", "description": "A7 and B3 move wide while A9 stays central. Opposing changes in their direct opportunities would be compatible with a decoy interpretation, but cannot establish A7's causal contribution.", "playerIds": ["A7", "A9"], "frames": [decoy_before, decoy_after]},
        {"id": "left_right_mirror", "description": "Reflecting x and vx and reversing the explicit attack direction preserves the same tactical geometry.", "playerIds": ["A7", "A9"], "frames": [base, mirror_frame(base)]},
    ]
