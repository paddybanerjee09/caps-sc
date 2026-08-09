import { fireEvent, render, waitFor } from "@testing-library/react-native";

import { AppThemeProvider } from "../../theme/ThemeContext";
import type { StoredConditioningTemplate } from "../../types/conditioning";
import { CreateConditioningSessionModal } from "../CreateConditioningSessionModal";

const mockDb = {};
const mockCreateTemplate = jest.fn();
const mockGetBaselines = jest.fn();

jest.mock("expo-sqlite", () => ({
  useSQLiteContext: () => mockDb,
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
    createConditioningTemplate: (...args: unknown[]) =>
      mockCreateTemplate(...args),
    getAthleteConditioningBaselines: (...args: unknown[]) =>
      mockGetBaselines(...args),
  };
});

jest.mock("@expo/vector-icons/Ionicons", () => "Ionicons");

const createdTemplate: StoredConditioningTemplate = {
  activity: "running",
  createdAt: 100,
  id: 9,
  intensity: null,
  notes: null,
  protocol: {
    intervalCount: 1,
    restBetweenIntervalsSeconds: 0,
    restBetweenRoundsSeconds: 0,
    roundCount: 1,
    type: "intervals",
    work: { durationSeconds: 30, mode: "time" },
  },
  title: "Short intervals",
  updatedAt: 100,
};

describe("CreateConditioningSessionModal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetBaselines.mockResolvedValue({
      maximumAerobicSpeedKph: null,
      maximumHeartRateBpm: null,
      thresholdPaceSecondsPerKm: null,
    });
    mockCreateTemplate.mockResolvedValue(createdTemplate);
  });

  test("creates a template from only the active shared-form branch", async () => {
    const onClose = jest.fn();
    const onCreated = jest.fn();
    const result = await render(
      <AppThemeProvider>
        <CreateConditioningSessionModal
          onClose={onClose}
          onCreated={onCreated}
          visible
        />
      </AppThemeProvider>,
    );

    await fireEvent.changeText(
      await result.findByLabelText("Session title"),
      "Short intervals",
    );
    await fireEvent.press(result.getByLabelText("Type, Continuous"));
    await fireEvent.press(result.getByLabelText("Intervals"));
    await fireEvent.press(result.getByLabelText("Work duration, not set"));
    await fireEvent.changeText(
      result.getByLabelText("Work duration seconds"),
      "30",
    );
    await fireEvent.press(result.getByText("Done"));
    expect(result.getByLabelText("Work duration, 00:30")).toBeTruthy();

    await fireEvent.press(result.getByText("Create"));
    await waitFor(() => expect(mockCreateTemplate).toHaveBeenCalledTimes(1));
    expect(mockCreateTemplate).toHaveBeenCalledWith(mockDb, {
      activity: "running",
      intensity: null,
      notes: null,
      protocol: {
        intervalCount: 1,
        restBetweenIntervalsSeconds: 0,
        restBetweenRoundsSeconds: 0,
        roundCount: 1,
        type: "intervals",
        work: { durationSeconds: 30, mode: "time" },
      },
      title: "Short intervals",
    });
    expect(onCreated).toHaveBeenCalledWith(createdTemplate);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
