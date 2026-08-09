import { render } from "@testing-library/react-native";

import { getConditioningSessionByTimelineEntryId } from "../../data/conditioningRepository";
import { useAppState } from "../../state/AppStateContext";
import { AppThemeProvider } from "../../theme/ThemeContext";
import type { StoredConditioningSession } from "../../types/conditioning";
import { ConditioningSessionDetailModal } from "../ConditioningSessionDetailModal";

jest.mock("@expo/vector-icons/Ionicons", () => "Ionicons");
jest.mock("expo-sqlite", () => ({
  useSQLiteContext: () => null,
}));
jest.mock("../../data/conditioningRepository", () => ({
  getConditioningSessionByTimelineEntryId: jest.fn(),
}));
jest.mock("../../state/AppStateContext", () => ({
  useAppState: jest.fn(),
}));

const getStoredSession = jest.mocked(
  getConditioningSessionByTimelineEntryId,
);
const getAppState = jest.mocked(useAppState);

function buildSession(
  overrides: Partial<StoredConditioningSession> = {},
): StoredConditioningSession {
  return {
    activity: "running",
    createdAt: 1_700_000_000_000,
    endAt: 1_700_000_450_000,
    intensity: null,
    metrics: {
      averageWorkBoutSeconds: 60,
      estimatedWorkDuration: true,
      protocolType: "intervals",
      totalBouts: 6,
      totalDistanceMeters: 6 * 1609.344,
      totalRestSeconds: 90,
      totalSessionSeconds: 450,
      totalWorkSeconds: 360,
      workBoutSeconds: [60, 60, 60, 60, 60, 60],
      workToRestRatio: 4,
    },
    notes: null,
    protocol: {
      intervalCount: 2,
      restBetweenIntervalsSeconds: 15,
      restBetweenRoundsSeconds: 30,
      roundCount: 3,
      type: "intervals",
      work: {
        distanceMeters: 1609.344,
        durationSeconds: 60,
        legacyTotalDurationSeconds: 450,
        mode: "distance",
        provenance: "legacy-derived",
      },
    },
    score: {
      evidence: "full",
      missingInputs: [],
      modelVersion: "conditioning-v1.0.0",
      primaryAdaptation: "aerobic_power",
      scores: {
        aerobic_base: 0.3,
        aerobic_power: 0.9,
        alactic_capacity: 0.1,
        alactic_power: 0.1,
        lactic_capacity: 0.4,
        lactic_power: 0.4,
        recovery: 0.2,
      },
      status: "scored",
    },
    sourceTemplateId: null,
    startAt: 1_700_000_000_000,
    status: "completed",
    timelineEntryId: 42,
    title: "Track repeats",
    updatedAt: 1_700_000_450_000,
    ...overrides,
  };
}

async function renderDetails(session: StoredConditioningSession) {
  getStoredSession.mockResolvedValue(session);
  getAppState.mockReturnValue({
    unitSettings: {
      distance: "imperial",
      height: "metric",
      weight: "metric",
    },
  } as unknown as ReturnType<typeof useAppState>);

  return render(
    <AppThemeProvider>
      <ConditioningSessionDetailModal
        onClose={jest.fn()}
        timelineEntryId={session.timelineEntryId}
        visible
      />
    </AppThemeProvider>,
  );
}

describe("ConditioningSessionDetailModal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("shows preferred units and distance intervals without work duration", async () => {
    const result = await renderDetails(buildSession());

    expect(await result.findByLabelText("Distance per interval, 1 mi")).toBeTruthy();
    expect(result.queryByLabelText(/duration per interval/i)).toBeNull();
    expect(result.getByLabelText("Intervals, 2")).toBeTruthy();
    expect(result.getByLabelText("Rounds, 3")).toBeTruthy();
    expect(result.getByLabelText("Rest between intervals, 15s")).toBeTruthy();
    expect(result.getByLabelText("Rest between rounds, 30s")).toBeTruthy();
    expect(result.getByLabelText("Distance, 6 mi")).toBeTruthy();
  });

  test("shows circuit structure and every ordered station", async () => {
    const session = buildSession({
      activity: "circuit",
      metrics: {
        averageWorkBoutSeconds: 37.5,
        estimatedWorkDuration: false,
        protocolType: "circuit",
        totalBouts: 8,
        totalDistanceMeters: null,
        totalRestSeconds: 180,
        totalSessionSeconds: 480,
        totalWorkSeconds: 300,
        workBoutSeconds: [30, 45, 30, 45, 30, 45, 30, 45],
        workToRestRatio: 5 / 3,
      },
      protocol: {
        restBetweenRoundsSeconds: 60,
        restBetweenStationsSeconds: 20,
        roundCount: 4,
        stations: [
          { name: "Burpees", position: 0, workSeconds: 30 },
          { name: "Heavy bag", position: 1, workSeconds: 45 },
        ],
        type: "circuit",
      },
      title: "Fight circuit",
    });
    const result = await renderDetails(session);

    expect(await result.findByLabelText("Stations per round, 2")).toBeTruthy();
    expect(result.getByLabelText("Rounds, 4")).toBeTruthy();
    expect(result.getByLabelText("Rest between stations, 20s")).toBeTruthy();
    expect(result.getByLabelText("Rest between rounds, 1m")).toBeTruthy();
    expect(result.getByLabelText("Station 1, Burpees, 30s")).toBeTruthy();
    expect(result.getByLabelText("Station 2, Heavy bag, 45s")).toBeTruthy();
  });
});
