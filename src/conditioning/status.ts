import type { SessionStatus } from "./types";

const homeTimelineStatus = {
  planned: "planned",
  in_progress: "planned",
  finished_draft: "planned",
  completed: "completed",
  ended_early: "completed",
  cancelled: "planned",
} as const;

export function timelineStatusForSession(status: SessionStatus) {
  return homeTimelineStatus[status];
}

export function isOpenRecording(status: SessionStatus) {
  return status === "in_progress" || status === "finished_draft";
}
