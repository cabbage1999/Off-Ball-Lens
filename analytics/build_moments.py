"""Causal receiving windows with immutable, as-of-time revisions.

The detector never reads scene titles, targetId, hypotheses, or future extrema.
The final summary is convenient for end-of-clip review; replay must project its
revision history. Feed the same prefixes online and the snapshots are identical.
"""
from __future__ import annotations

from copy import deepcopy
from .config import MOMENT_CONFIG


def project_moments(moments: list[dict], as_of_time: float) -> list[dict]:
    projected = []
    for moment in moments:
        revisions = [r for r in moment["revisions"] if r["knownAtTime"] <= as_of_time + 1e-9]
        if revisions:
            projected.append(deepcopy(revisions[-1]))
    return projected


class MomentDetector:
    def __init__(self, config: dict | None = None):
        self.config = {**MOMENT_CONFIG, **(config or {})}
        self.moments: list[dict] = []
        self.candidates: dict[str, dict] = {}
        self.active: dict[str, dict] = {}
        self.low_since: dict[str, float] = {}
        self.pending_passes: dict[str, list[dict]] = {}
        self.last_frame = None

    @staticmethod
    def _record(moment, t, frame_id):
        revision = deepcopy({k: v for k, v in moment.items() if k != "revisions"})
        revision.update(knownAtTime=t, knownAtFrameId=frame_id)
        moment["revisions"].append(revision)

    def _outcome(self, moment, status, t, frame_id, **extra):
        moment["outcome"] = {"status": status, "outcomeKnownAtTime": t, **extra}
        moment["outcomeKnownAtTime"] = t
        self._record(moment, t, frame_id)

    def _close(self, pid, t, frame_id, reason, selected=False):
        moment = self.active.pop(pid, None)
        self.candidates.pop(pid, None)
        self.low_since.pop(pid, None)
        if moment is None:
            return None
        moment.update(endTime=t, endFrameId=frame_id, closeReason=reason)
        if not selected and moment["outcome"]["status"] == "pending":
            # Allow only observed event/valid-window endings to establish non-use.
            # Unknown or newly added invalid-input reasons must remain indeterminate.
            observed_endings = {"pass_release", "shot", "turnover", "dead_ball",
                                "offside", "below_close_threshold"}
            status = "not_selected" if reason in observed_endings else "closed"
            moment["outcome"] = {"status": status, "outcomeKnownAtTime": t}
            moment["outcomeKnownAtTime"] = t
        self._record(moment, t, frame_id)
        return moment

    def observe_event(self, event: dict):
        """Called when an event occurs, before any same-time analysis frame."""
        event_type, t = event.get("type"), event["t"]
        frame_id = event["frameId"]
        if event_type == "pass":
            target, passer = event.get("targetId"), event.get("playerId")
            selected = []
            for pid, moment in list(self.active.items()):
                if moment["carrierId"] != passer:
                    continue
                if pid == target:
                    self._outcome(moment, "passed_to", t, frame_id, eventId=event["id"], passId=event.get("passId"))
                    selected.append(moment)
                self._close(pid, t, frame_id, "pass_release", selected=pid == target)
            if selected and event.get("passId"):
                self.pending_passes[event["passId"]] = selected
            self.candidates.clear()
        elif event_type == "reception":
            for moment in self.pending_passes.pop(event.get("passId"), []):
                if moment["playerId"] == event.get("playerId"):
                    self._outcome(moment, "received", t, frame_id, eventId=event["id"], passId=event.get("passId"))
        elif event_type in ("interception", "save"):
            for moment in self.pending_passes.pop(event.get("passId"), []):
                self._outcome(moment, "closed", t, frame_id, eventId=event["id"], passId=event.get("passId"), reason="pass_not_received")
        elif event_type in ("shot", "turnover", "dead_ball"):
            for pid in list(self.active):
                self._close(pid, t, frame_id, event_type)
            self.candidates.clear()

    def observe_frame(self, frame: dict):
        t, frame_id = frame["t"], frame["frameId"]
        previous = self.last_frame
        self.last_frame = frame
        context = (frame.get("attackingTeam"), frame.get("carrierId"))
        timeline_gap = previous and t - previous["t"] > 1.5 / self.config["samplingRate"]
        if timeline_gap:
            for pid in list(self.active):
                self._close(pid, t, frame_id, "timeline_gap")
            self.candidates.clear()
        for pid, value in frame["players"].items():
            eligible = frame["status"] == "valid" and value["status"] == "eligible" and value["das"] is not None
            old = self.active.get(pid) or self.candidates.get(pid)
            changed = old and (old["attackingTeam"], old["carrierId"]) != context
            if not eligible or changed:
                reason = "possession_change" if changed else value.get("status")
                if frame["status"] != "valid":
                    # Events are processed first and can close a known outcome.
                    # An invalid frame itself never proves a pass was not selected.
                    reason = "invalid_tracking"
                self._close(pid, t, frame_id, reason)
                if not eligible:
                    continue
            das = float(value["das"])
            if pid in self.active:
                moment = self.active[pid]
                if das > moment["peakDas"]:
                    moment.update(peakDas=das, peakTime=t, peakFrameId=frame_id)
                    self._record(moment, t, frame_id)
                if das <= self.config["closeDas"]:
                    self.low_since.setdefault(pid, t)
                    if t - self.low_since[pid] >= self.config["minCloseSeconds"] - 1e-9:
                        self._close(pid, t, frame_id, "below_close_threshold")
                else:
                    self.low_since.pop(pid, None)
            elif das >= self.config["openDas"]:
                if pid not in self.candidates:
                    self.candidates[pid] = {
                        "startTime": t, "startFrameId": frame_id,
                        "peakDas": das, "peakTime": t, "peakFrameId": frame_id,
                        "attackingTeam": context[0], "carrierId": context[1],
                    }
                candidate = self.candidates[pid]
                if das > candidate["peakDas"]:
                    candidate.update(peakDas=das, peakTime=t, peakFrameId=frame_id)
                if t - candidate["startTime"] >= self.config["minOpenSeconds"] - 1e-9:
                    moment = {
                        **candidate, "id": f"{candidate['startFrameId']}:{pid}:window",
                        "playerId": pid, "kind": "receiving_window",
                        "detectedAtTime": t, "detectedAtFrameId": frame_id,
                        "endTime": None, "endFrameId": None,
                        "outcome": {"status": "pending", "outcomeKnownAtTime": t},
                        "outcomeKnownAtTime": t, "revisions": [],
                    }
                    self.moments.append(moment)
                    self.active[pid] = moment
                    self.candidates.pop(pid)
                    self._record(moment, t, frame_id)
            else:
                self.candidates.pop(pid, None)


def build_moments(frames: list[dict], events: list[dict], as_of_time: float | None = None, config: dict | None = None) -> list[dict]:
    if not frames:
        return []
    cutoff = frames[-1]["t"] if as_of_time is None else as_of_time
    detector = MomentDetector(config)
    # Only numerical frames and occurred events are inputs. Events at 10 Hz may
    # close a 5 Hz window between analysis samples, without delaying their truth.
    timeline = [(f["t"], 1, f) for f in frames if f["t"] <= cutoff + 1e-9]
    timeline += [(e["t"], 0, e) for e in events if e["t"] <= cutoff + 1e-9]
    timeline.sort(key=lambda item: (item[0], item[1]))
    for _, kind, item in timeline:
        if kind == 0:
            detector.observe_event(item)
        else:
            detector.observe_frame(item)
    # Do not close open windows just because the available file stops. A prefix
    # must give the same result whether more data will arrive or not.
    return detector.moments
