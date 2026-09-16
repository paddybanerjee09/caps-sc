import { fireEvent, render } from "@testing-library/react-native";

import { getStrengthSessionByTimelineEntryId } from "../../data/strengthRepository";
import { AppThemeProvider } from "../../theme/ThemeContext";
import type { StoredStrengthSession } from "../../types/strength";
import { StrengthSessionDetailModal } from "../StrengthSessionDetailModal";

jest.mock("expo-sqlite", () => ({ useSQLiteContext: () => ({}) }));
jest.mock("../../data/strengthRepository", () => ({ getStrengthSessionByTimelineEntryId: jest.fn() }));
jest.mock("../../state/AppStateContext", () => ({
  useAppState: () => ({ unitSettings: { distance: "metric", height: "metric", weight: "metric" } }),
}));

const getSession = jest.mocked(getStrengthSessionByTimelineEntryId);
const session: StoredStrengthSession = {
  timelineEntryId: 42,
  sourceTemplateId: null,
  title: "Upper body",
  startAt: 1_700_000_000_000,
  primaryAdaptation: "hypertrophy",
  evidence: "full",
  exercises: [{
    exerciseId: "bench", name: "Bench press", 
    movementProfile: "non_explosive", movementProfileSource: "name-rule",
    externalLoadKg: 80, sets: 3, reps: 8, rpe: 8, percent1RM: 75, notes: "Controlled reps",
  }],
  score: {
    status: "scored", scores: { hypertrophy: 80, power: 20, endurance: 30 },
    primaryAdaptation: "hypertrophy", evidence: "full", missingInputs: [], modelVersion: "strength-v1.0.0",
    exercises: [{ scores: { hypertrophy: 80, power: 20, endurance: 30 }, hardSets: 3, totalRepetitions: 24,
      volumeLoadKg: 1920, percent1RMUsed: 75, estimated1RM: null, intensitySource: "entered", evidence: "full", modelVersion: "strength-v1.0.0" }],
  },
};

describe("StrengthSessionDetailModal", () => {
  beforeEach(() => jest.clearAllMocks());

  test("shows immutable exercise and score details after retrying a failed read", async () => {
    getSession.mockResolvedValue(session).mockRejectedValueOnce(new Error("read failed"));
    const result = await render(
      <AppThemeProvider>
        <StrengthSessionDetailModal onClose={jest.fn()} timelineEntryId={42} />
      </AppThemeProvider>,
    );

    expect(await result.findByText("Couldn't load strength session.")).toBeTruthy();
    await fireEvent.press(result.getByText("Retry strength session"));
    expect(await result.findByText("Upper body")).toBeTruthy();
    expect(result.getByText("Bench press")).toBeTruthy();
    expect(result.getByText("80.0kg · 3×8 · RPE 8")).toBeTruthy();
    expect(result.getByText("Scoring model: strength-v1.0.0")).toBeTruthy();
    expect(getSession.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
