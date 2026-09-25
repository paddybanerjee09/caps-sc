import { fireEvent, render, waitFor } from "@testing-library/react-native";

import { AppThemeProvider } from "../../theme/ThemeContext";
import type {
  LoggedConditioningSessionResult,
  StoredConditioningSession,
  StoredConditioningTemplate,
} from "../../types/conditioning";
import { ConditioningLogModal } from "../ConditioningLogModal";

jest.setTimeout(30_000);

const mockDb = {};
const mockGetBaselines = jest.fn();
const mockLogSession = jest.fn();
const mockUpdateSession = jest.fn();

jest.mock("expo-sqlite", () => ({
  useSQLiteContext: () => mockDb,
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
}));

jest.mock("../../state/AppStateContext", () => ({
  useAppState: () => ({
    unitSettings: { distance: "metric", height: "metric", weight: "metric" },
  }),
}));

jest.mock("../../data/conditioningRepository", () => {
  const actual = jest.requireActual("../../data/conditioningRepository");

  return {
    ...actual,
    getAthleteConditioningBaselines: (...args: unknown[]) =>
      mockGetBaselines(...args),
    logCompletedConditioningSession: (...args: unknown[]) =>
      mockLogSession(...args),
    updateCompletedConditioningSession: (...args: unknown[]) =>
      mockUpdateSession(...args),
  };
});

jest.mock("../ConditioningSessions", () => ({
  ConditioningSessions: () => null,
}));

jest.mock("@expo/vector-icons/Ionicons", () => "Ionicons");

const score: StoredConditioningSession["score"] = {
  evidence: "full",
  missingInputs: [],
  modelVersion: "conditioning-v1.0.0",
  primaryAdaptation: "aerobic_base",
  scores: {
    aerobic_base: 80,
    aerobic_power: 20,
    alactic_capacity: 10,
    alactic_power: 10,
    lactic_capacity: 10,
    lactic_power: 10,
    recovery: 10,
  },
  status: "scored",
};

const savedResult: LoggedConditioningSessionResult = {
  endAt: 1_600_000,
  score,
  startAt: 1_000_000,
  timelineEntryId: 41,
};

const entryToEdit: StoredConditioningSession = {
  activity: "running",
  createdAt: 900_000,
  endAt: 1_600_000,
  intensity: {
    maxHeartRateBpm: 190,
    method: "heart_rate",
    valueBpm: 150,
  },
  metrics: {
    averageWorkBoutSeconds: 600,
    estimatedWorkDuration: false,
    protocolType: "continuous",
    totalBouts: 1,
    totalDistanceMeters: 2_000,
    totalRestSeconds: 0,
    totalSessionSeconds: 600,
    totalWorkSeconds: 600,
    workBoutSeconds: [600],
    workToRestRatio: null,
  },
  notes: "Original notes",
  protocol: {
    distanceMeters: 2_000,
    durationSeconds: 600,
    type: "continuous",
  },
  score,
  sourceTemplateId: 7,
  startAt: 1_000_000,
  status: "completed",
  timelineEntryId: 41,
  title: "Stored run",
  updatedAt: 950_000,
};

const template: StoredConditioningTemplate = {
  activity: "rowing",
  createdAt: 100,
  id: 12,
  intensity: null,
  notes: null,
  protocol: {
    distanceMeters: 5_000,
    durationSeconds: 1_200,
    type: "continuous",
  },
  title: "Saved row",
  updatedAt: 200,
};

function renderModal(
  props: Partial<React.ComponentProps<typeof ConditioningLogModal>> = {},
) {
  const defaults: React.ComponentProps<typeof ConditioningLogModal> = {
    onClose: jest.fn(),
    selectedDate: new Date(2020, 0, 2, 12),
    visible: true,
  };

  return render(
    <AppThemeProvider>
      <ConditioningLogModal {...defaults} {...props} />
    </AppThemeProvider>,
  );
}

describe("ConditioningLogModal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, "now").mockReturnValue(2_000_000_000_000);
    mockGetBaselines.mockResolvedValue({
      maximumAerobicSpeedKph: null,
      maximumHeartRateBpm: 205,
      thresholdPaceSecondsPerKm: null,
    });
    mockLogSession.mockResolvedValue(savedResult);
    mockUpdateSession.mockResolvedValue(savedResult);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("hydrates and updates the loaded record while retaining its stored day", async () => {
    const onSaved = jest.fn();
    const result = await renderModal({ entryToEdit, onSaved });

    expect(await result.findByText("Edit Conditioning")).toBeTruthy();
    const titleInput = await result.findByLabelText("Session title");
    expect(titleInput.props.value).toBe("Stored run");
    expect(result.queryByText("Log Pre-existing Session")).toBeNull();

    await fireEvent.press(result.getByLabelText("Update conditioning session"));

    await waitFor(() => expect(mockUpdateSession).toHaveBeenCalledTimes(1));
    expect(mockUpdateSession).toHaveBeenCalledWith(
      mockDb,
      41,
      expect.objectContaining({
        activity: "running",
        intensity: { method: "heart_rate", valueBpm: 150 },
        notes: "Original notes",
        protocol: {
          distanceMeters: 2_000,
          durationSeconds: 600,
          type: "continuous",
        },
        endedAt: 1_600_000,
        title: "Stored run",
      }),
    );
    expect(mockLogSession).not.toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalledWith(savedResult);
  });

  test("uses the template association for creation and resets abandoned edits", async () => {
    const onClose = jest.fn();
    const result = await renderModal({ entryToEdit, onClose });
    const titleInput = await result.findByLabelText("Session title");
    await fireEvent.changeText(titleInput, "Unsaved title");
    expect(result.getByLabelText("Session title").props.value).toBe(
      "Unsaved title",
    );
    await fireEvent.press(result.getByLabelText("Cancel conditioning log"));
    expect(onClose).toHaveBeenCalledTimes(1);

    await result.rerender(
      <AppThemeProvider>
        <ConditioningLogModal
          entryToEdit={entryToEdit}
          onClose={onClose}
          selectedDate={new Date(2020, 0, 2, 12)}
          visible={false}
        />
      </AppThemeProvider>,
    );
    await result.rerender(
      <AppThemeProvider>
        <ConditioningLogModal
          entryToEdit={entryToEdit}
          onClose={onClose}
          selectedDate={new Date(2020, 0, 2, 12)}
          visible
        />
      </AppThemeProvider>,
    );
    await waitFor(() =>
      expect(result.getByLabelText("Session title").props.value).toBe(
        "Stored run",
      ),
    );

    await result.rerender(
      <AppThemeProvider>
        <ConditioningLogModal
          onClose={onClose}
          selectedDate={new Date(2020, 0, 2, 12)}
          sourceTemplate={template}
          visible
        />
      </AppThemeProvider>,
    );
    await waitFor(() =>
      expect(result.getByLabelText("Session title").props.value).toBe(
        "Saved row",
      ),
    );
    await fireEvent.press(result.getByLabelText("Log conditioning session"));
    await waitFor(() => expect(mockLogSession).toHaveBeenCalledTimes(1));
    expect(mockLogSession).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        activity: "rowing",
        sourceTemplateId: 12,
        title: "Saved row",
      }),
    );
  });

  test("dismisses a nested duration editor when the outer modal closes", async () => {
    const onClose = jest.fn();
    const selectedDate = new Date(2020, 0, 2, 12);
    const result = await renderModal({ entryToEdit, onClose, selectedDate });
    await result.findByLabelText("Duration, 00:10:00");
    await fireEvent.press(result.getByLabelText("Duration, 00:10:00"));
    expect(await result.findByLabelText("Duration hours")).toBeTruthy();

    await result.rerender(
      <AppThemeProvider>
        <ConditioningLogModal
          entryToEdit={entryToEdit}
          onClose={onClose}
          selectedDate={selectedDate}
          visible={false}
        />
      </AppThemeProvider>,
    );
    expect(result.queryByLabelText("Duration hours")).toBeNull();

    await result.rerender(
      <AppThemeProvider>
        <ConditioningLogModal
          entryToEdit={entryToEdit}
          onClose={onClose}
          selectedDate={selectedDate}
          visible
        />
      </AppThemeProvider>,
    );
    expect(await result.findByLabelText("Duration, 00:10:00")).toBeTruthy();
    expect(result.queryByLabelText("Duration hours")).toBeNull();
  });

  test("preserves an untouched legacy distance interval and pace snapshot", async () => {
    const legacyEntry: StoredConditioningSession = {
      ...entryToEdit,
      intensity: {
        method: "pace",
        paceSecondsPerKm: 245,
        reference: "threshold_pace",
        thresholdPaceSecondsPerKm: 255,
      },
      metrics: {
        averageWorkBoutSeconds: 100.5,
        estimatedWorkDuration: true,
        protocolType: "intervals",
        totalBouts: 4,
        totalDistanceMeters: 1_600,
        totalRestSeconds: 60,
        totalSessionSeconds: 462,
        totalWorkSeconds: 402,
        workBoutSeconds: [100.5, 100.5, 100.5, 100.5],
        workToRestRatio: 6.7,
      },
      protocol: {
        intervalCount: 2,
        restBetweenIntervalsSeconds: 15,
        restBetweenRoundsSeconds: 30,
        roundCount: 2,
        type: "intervals",
        work: {
          distanceMeters: 400,
          durationSeconds: 100.5,
          legacyTotalDurationSeconds: 462,
          mode: "distance",
          provenance: "legacy-derived",
        },
      },
      title: "Legacy repeats",
    };
    const result = await renderModal({ entryToEdit: legacyEntry });

    expect(
      (await result.findByLabelText("Distance per interval")).props.value,
    ).toBe("400");
    expect(result.queryByLabelText(/Duration per interval/)).toBeNull();
    expect(result.getByText("Pace — 4:05 min/km")).toBeTruthy();
    await fireEvent.press(result.getByLabelText("Update conditioning session"));

    await waitFor(() => expect(mockUpdateSession).toHaveBeenCalledTimes(1));
    expect(mockUpdateSession).toHaveBeenCalledWith(
      mockDb,
      41,
      expect.objectContaining({
        intensity: {
          method: "pace",
          paceSecondsPerKm: 245,
          reference: "threshold_pace",
        },
        protocol: legacyEntry.protocol,
      }),
    );
  });

  test("submits a reordered Circuit with only its active station branch", async () => {
    const circuitEntry: StoredConditioningSession = {
      ...entryToEdit,
      activity: "circuit",
      intensity: null,
      metrics: {
        averageWorkBoutSeconds: 37.5,
        estimatedWorkDuration: false,
        protocolType: "circuit",
        totalBouts: 4,
        totalDistanceMeters: null,
        totalRestSeconds: 100,
        totalSessionSeconds: 250,
        totalWorkSeconds: 150,
        workBoutSeconds: [30, 45, 30, 45],
        workToRestRatio: 1.5,
      },
      protocol: {
        restBetweenRoundsSeconds: 60,
        restBetweenStationsSeconds: 20,
        roundCount: 2,
        stations: [
          { name: "Bike", position: 0, workSeconds: 30 },
          { name: "Carry", position: 1, workSeconds: 45 },
        ],
        type: "circuit",
      },
      title: "Fight circuit",
    };
    const result = await renderModal({ entryToEdit: circuitEntry });
    await result.findByLabelText("Move station 2 up");
    await fireEvent.press(result.getByLabelText("Move station 2 up"));
    await fireEvent.press(result.getByLabelText("Update conditioning session"));

    await waitFor(() => expect(mockUpdateSession).toHaveBeenCalledTimes(1));
    const submitted = mockUpdateSession.mock.calls[0][2];
    expect(submitted.protocol).toEqual({
      restBetweenRoundsSeconds: 60,
      restBetweenStationsSeconds: 20,
      roundCount: 2,
      stations: [
        { name: "Carry", position: 0, workSeconds: 45 },
        { name: "Bike", position: 1, workSeconds: 30 },
      ],
      type: "circuit",
    });
    expect(submitted.protocol).not.toHaveProperty("distanceMeters");
    expect(submitted.protocol).not.toHaveProperty("work");
  });
});
