import { fireEvent, render } from "@testing-library/react-native";

import { AppThemeProvider } from "../../theme/ThemeContext";
import type { ExerciseDbExercise } from "../../types/strength";
import { StrengthExerciseEditorModal } from "../StrengthExerciseEditorModal";

let mockWeightUnit = "imperial";

jest.mock("../../state/AppStateContext", () => ({
  useAppState: () => ({ unitSettings: { distance: "metric", height: "metric", weight: mockWeightUnit } }),
}));
jest.mock("../../services/exerciseDbApi", () => ({ getExerciseDbDetail: jest.fn() }));

const exercise: ExerciseDbExercise = {
  exerciseId: "bench",
  name: "Bench press",
  gifUrl: null,
  bodyParts: ["chest"],
  targetMuscles: ["pectorals"],
  secondaryMuscles: ["triceps"],
  equipments: ["barbell"],
  instructions: ["Press the bar."],
};

describe("StrengthExerciseEditorModal", () => {
  test.each([
    ["imperial", "lbs", "220.462"],
    ["metric", "kg", "100"],
  ])("logs %s weight without label confirmation", async (unit, symbol, weight) => {
    mockWeightUnit = unit;
    const onLog = jest.fn();
    const result = await render(
      <AppThemeProvider>
        <StrengthExerciseEditorModal exercise={exercise} onCancel={jest.fn()} onLog={onLog} />
      </AppThemeProvider>,
    );

    await fireEvent.changeText(result.getByLabelText(`Weight (${symbol})`), weight);
    await fireEvent.changeText(result.getByLabelText("Sets"), "3");
    await fireEvent.changeText(result.getByLabelText("Reps"), "5");
    await fireEvent.changeText(result.getByLabelText("RPE (1–10)"), "8");
    expect(result.queryByText("Confirm workout label")).toBeNull();
    expect(result.queryByText("Press the bar.")).toBeNull();
    expect(result.queryByLabelText("%1RM override (optional)")).toBeNull();
    await fireEvent.press(result.getByText("Log Exercise"));
    expect(onLog).toHaveBeenCalledWith(expect.objectContaining({
      exerciseId: "bench",
      externalLoadKg: expect.closeTo(100, 4),
      name: "Bench press",
      percent1RM: null,
      reps: 5,
      rpe: 8,
      sets: 3,
    }));
  });

  test("accepts zero external load and cancel leaves the caller unchanged", async () => {
    const onCancel = jest.fn();
    const onLog = jest.fn();
    const result = await render(
      <AppThemeProvider>
        <StrengthExerciseEditorModal exercise={exercise} onCancel={onCancel} onLog={onLog} />
      </AppThemeProvider>,
    );
    await fireEvent.changeText(result.getByLabelText("Sets"), "3");
    await fireEvent.changeText(result.getByLabelText("Reps"), "12");
    await fireEvent.changeText(result.getByLabelText("RPE (1–10)"), "8");
    await fireEvent.press(result.getByText("Log Exercise"));
    expect(onLog).toHaveBeenCalledWith(expect.objectContaining({ externalLoadKg: 0 }));

    await fireEvent.press(result.getByText("Cancel"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
