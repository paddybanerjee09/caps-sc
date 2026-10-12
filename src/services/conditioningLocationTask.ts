import * as Location from "expo-location";
import * as SQLite from "expo-sqlite";
import * as TaskManager from "expo-task-manager";

import {
  createGpsState,
  GPS_PROCESSING_VERSION,
  pauseGps,
  processLocationBatch,
  resumeGps,
  type GeoSample,
  type GpsState,
} from "../conditioning/gps";
import type { FreeActivity } from "../conditioning/types";

export const CONDITIONING_LOCATION_TASK = "conditioning-location-updates";

type ActiveFreeSession = {
  activity_type: FreeActivity;
  id: string;
  owner_id: string;
  performed_at: number;
};

export async function ingestConditioningLocations(
  db: SQLite.SQLiteDatabase,
  locations: Location.LocationObject[],
) {
  if (locations.length === 0) {
    return;
  }

    const session = await db.getFirstAsync<ActiveFreeSession>(
      `SELECT id, owner_id, activity_type, performed_at
       FROM conditioning_sessions
       WHERE status = 'in_progress' AND format = 'free'
       ORDER BY performed_at DESC
       LIMIT 1`,
    );
    if (!session) {
      return;
    }

    const stored = await db.getFirstAsync<{ state_json: string }>(
      "SELECT state_json FROM conditioning_runner_state WHERE session_id = ?",
      [session.id],
    );
    const document = stored
      ? (JSON.parse(stored.state_json) as {
          gps?: GpsState;
          seen?: string[];
          timer?: { status?: string };
        })
      : {};
    let gps = document.gps ?? createGpsState(session.activity_type, session.performed_at);
    if (document.timer?.status === "paused" && !gps.paused) {
      gps = pauseGps(gps);
    }
    if (document.timer?.status === "running" && gps.paused) {
      gps = resumeGps(gps);
    }
    const seen = new Set(document.seen ?? []);
    const samples: GeoSample[] = locations.map((location) => ({
      altitude: location.coords.altitude,
      altitudeAccuracy: location.coords.altitudeAccuracy,
      horizontalAccuracy: location.coords.accuracy,
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      recordedAt: location.timestamp,
    }));
    const processed = processLocationBatch(gps, samples, seen);
    const sequenceRow = await db.getFirstAsync<{ next: number }>(
      `SELECT COALESCE(MAX(sequence), -1) + 1 AS next
       FROM conditioning_location_points WHERE session_id = ?`,
      [session.id],
    );
    let sequence = Number(sequenceRow?.next ?? 0);
    await db.withTransactionAsync(async () => {
      for (const point of processed.points) {
        await db.runAsync(
          `INSERT INTO conditioning_location_points (
            session_id, sequence, segment_id, recorded_at, latitude, longitude,
            horizontal_accuracy, altitude, altitude_accuracy, acceptance,
            rejection_reason, distance_delta_meters
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            session.id,
            sequence,
            `segment-${point.segmentSequence}`,
            point.recordedAt,
            point.latitude,
            point.longitude,
            point.horizontalAccuracy,
            point.altitude,
            point.altitudeAccuracy,
            point.acceptance,
            point.rejectionReason,
            point.distanceDeltaMeters,
          ],
        );
        sequence += 1;
      }
      await db.runAsync(
        `UPDATE conditioning_sessions
         SET distance_meters = ?, gps_processing_version = ?, updated_at = ?
         WHERE id = ?`,
        [
          processed.state.cumulativeMeters,
          GPS_PROCESSING_VERSION,
          Date.now(),
          session.id,
        ],
      );
      const latest = await db.getFirstAsync<{ state_json: string }>(
        "SELECT state_json FROM conditioning_runner_state WHERE session_id = ?",
        [session.id],
      );
      const current = latest ? (JSON.parse(latest.state_json) as Record<string, unknown>) : {};
      await db.runAsync(
        `INSERT INTO conditioning_runner_state (session_id, state_json, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(session_id) DO UPDATE SET
           state_json = excluded.state_json,
           updated_at = excluded.updated_at`,
        [
          session.id,
          JSON.stringify({
            ...current,
            gps: processed.state,
            seen: [...processed.seen],
          }),
          Date.now(),
        ],
      );
    });
}

TaskManager.defineTask(CONDITIONING_LOCATION_TASK, async ({ data, error }) => {
  if (error || !data) {
    return;
  }

  const locations = (data as { locations?: Location.LocationObject[] }).locations ?? [];
  const db = await SQLite.openDatabaseAsync("caps.db");
  try {
    await db.execAsync("PRAGMA foreign_keys = ON;");
    await ingestConditioningLocations(db, locations);
  } finally {
    await db.closeAsync();
  }
});
