from copy import deepcopy
from analytics.build_moments import build_moments, project_moments


def frames(values):
    return [{"frameId": f"test:{i*2:04}", "frameIndex": i*2, "t": i/5,
             "status": "valid", "reason": None, "carrierId": "A6", "attackingTeam": "A",
             "players": {"A7": {"status": "eligible", "das": value, "as": 100, "heatmap": None}}}
            for i, value in enumerate(values)]


def test_every_prefix_equals_as_of_projection_and_future_mutation():
    fs = frames([.1, .6, .7, .9, .8, 1.3, .7, .2, .1, .1, .2, .7, .8, .9, 1, 1.2])
    events = [{"id": "p1", "type": "pass", "t": 2.8, "frameId": "test:0028", "playerId": "A6", "targetId": "A7", "passId": "pass1"},
              {"id": "r1", "type": "reception", "t": 3.0, "frameId": "test:0030", "playerId": "A7", "passId": "pass1"}]
    final = build_moments(fs, events)
    for index in range(len(fs)):
        t = fs[index]["t"]
        prefix = build_moments(fs[:index+1], events)
        assert project_moments(prefix, t) == project_moments(final, t)
        mutated = deepcopy(fs)
        for future in mutated[index+1:]: future["players"]["A7"]["das"] = 99999
        assert project_moments(build_moments(mutated, events), t) == project_moments(final, t)


def test_outcome_only_after_pass_and_reception():
    fs = frames([6] * 15)
    events = [{"id": "p", "type": "pass", "t": 1.3, "frameId": "test:0013", "playerId": "A6", "targetId": "A7", "passId": "p1"},
              {"id": "r", "type": "reception", "t": 2.1, "frameId": "test:0021", "playerId": "A7", "passId": "p1"}]
    # Real trajectory data marks the flight invalid and then marks A7 carrier.
    for f in fs:
        if 1.3 <= f["t"] < 2.1:
            f.update(status="invalid", reason="ball_in_flight", carrierId=None)
            f["players"]["A7"].update(status="invalid", das=None)
        elif f["t"] >= 2.1:
            f["carrierId"] = "A7"; f["players"]["A7"].update(status="carrier", das=None)
    ms = build_moments(fs, events)
    assert project_moments(ms, 1.2)[0]["outcome"]["status"] == "pending"
    assert project_moments(ms, 1.2)[0]["endTime"] is None
    assert project_moments(ms, 1.3)[0]["outcome"]["status"] == "passed_to"
    assert project_moments(ms, 2.0)[0]["outcome"]["status"] == "passed_to"
    assert project_moments(ms, 2.1)[0]["outcome"]["status"] == "received"


def test_unknown_tracking_does_not_imply_unselected_and_no_file_end_closure():
    fs = frames([6] * 8)
    ms = build_moments(fs, [])
    assert ms[0]["endTime"] is None and ms[0]["outcome"]["status"] == "pending"
    fs[-1].update(status="invalid", reason="incomplete_or_duplicate_roster")
    fs[-1]["players"]["A7"].update(status="invalid", das=None)
    ms = build_moments(fs, [])
    assert ms[0]["outcome"]["status"] == "closed"


def test_carrier_switch_splits_windows():
    fs = frames([6] * 10)
    for f in fs[5:]: f["carrierId"] = "A8"
    ms = build_moments(fs, [])
    assert len(ms) == 2
    assert ms[0]["endTime"] == 1.0
    assert ms[1]["startTime"] == 1.0
