import type { Pick, PlannerRecord, PlannerState } from "./types";

export interface SaveReconciliation {
  record: PlannerRecord;
  dirty: boolean;
  conflict: PlannerRecord | null;
  status: string;
}

function sameState(a: PlannerState, b: PlannerState): boolean {
  return a === b || JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Apply a finished save without dropping edits made while the request was in flight.
 * A successful write advances the version. Newer local edits keep their state and
 * save again at that version. A 409 rebases onto the server version and retries.
 */
export function reconcilePlannerSave(input: {
  sent: PlannerRecord;
  local: PlannerRecord;
  httpStatus: number;
  body: PlannerRecord | null;
  retries: number;
}): SaveReconciliation {
  const { sent, local, httpStatus, body, retries } = input;
  if (httpStatus === 200 && body) {
    if (sameState(local.state, sent.state)) {
      return { record: body, dirty: false, conflict: null, status: "Saved for the household" };
    }
    return {
      record: { version: body.version, state: local.state },
      dirty: true,
      conflict: null,
      status: "Saving...",
    };
  }
  if (httpStatus === 409 && body) {
    if (sameState(local.state, body.state)) {
      return { record: body, dirty: false, conflict: null, status: "Saved for the household" };
    }
    if (retries >= 3) {
      return {
        record: local,
        dirty: false,
        conflict: body,
        status: "Someone else saved first",
      };
    }
    return {
      record: { version: body.version, state: local.state },
      dirty: true,
      conflict: null,
      status: "Saving...",
    };
  }
  return { record: local, dirty: true, conflict: null, status: "Could not save" };
}

/** Deal results land on the latest menu, so votes and settings made during the spin stay. */
export function mergeDealtWeek(latest: PlannerState, picks: Pick[], why: Record<string, string[]>): PlannerState {
  return {
    ...latest,
    picks,
    why: { ...latest.why, ...why },
  };
}
