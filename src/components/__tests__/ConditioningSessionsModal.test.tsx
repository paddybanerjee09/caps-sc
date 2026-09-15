import { render } from "@testing-library/react-native";

import { AppThemeProvider } from "../../theme/ThemeContext";
import type { StoredConditioningTemplate } from "../../types/conditioning";
import { ConditioningSessions } from "../ConditioningSessions";

jest.setTimeout(30_000);

const mockDb = {};
const mockListTemplates = jest.fn();
const mockGetBaselines = jest.fn();

jest.mock("expo-sqlite", () => ({ useSQLiteContext: () => mockDb }));
jest.mock("../../state/AppStateContext", () => ({
  useAppState: () => ({ unitSettings: { distance: "metric", height: "metric", weight: "metric" } }),
}));
jest.mock("../../data/conditioningRepository", () => ({
  getAthleteConditioningBaselines: (...args: unknown[]) => mockGetBaselines(...args),
  listConditioningTemplates: (...args: unknown[]) => mockListTemplates(...args),
}));
jest.mock("@expo/vector-icons/Ionicons", () => "Ionicons");
jest.mock("@expo/vector-icons/MaterialCommunityIcons", () => "MaterialCommunityIcons");

const template: StoredConditioningTemplate = {
  activity: "running",
  createdAt: 1,
  id: 7,
  intensity: null,
  notes: null,
  protocol: { distanceMeters: 5_000, durationSeconds: 1_800, type: "continuous" },
  title: "Easy run",
  updatedAt: 2,
};

describe("ConditioningSessions modal lifecycle", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetBaselines.mockResolvedValue({
      maximumAerobicSpeedKph: null,
      maximumHeartRateBpm: null,
      thresholdPaceSecondsPerKm: null,
    });
  });

  test("loads only while visible", async () => {
    mockListTemplates.mockResolvedValue([template]);
    const result = await render(
      <AppThemeProvider>
        <ConditioningSessions onClose={jest.fn()} onTemplateSelected={jest.fn()} visible={false} />
      </AppThemeProvider>,
    );
    expect(mockListTemplates).not.toHaveBeenCalled();

    await result.rerender(
      <AppThemeProvider>
        <ConditioningSessions onClose={jest.fn()} onTemplateSelected={jest.fn()} visible />
      </AppThemeProvider>,
    );
    expect(await result.findByText("Easy run")).toBeTruthy();
  });
});
