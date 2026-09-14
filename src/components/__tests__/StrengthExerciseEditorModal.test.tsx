import { fireEvent, render } from "@testing-library/react-native";

import { AppThemeProvider } from "../../theme/ThemeContext";
import type { ExerciseDbExercise } from "../../types/strength";
import { StrengthExerciseEditorModal } from "../StrengthExerciseEditorModal";

jest.mock("../../state/AppStateContext", () => ({
  useAppState: () => ({ unitSettings: { distance: "metric", height: "metric", weight: "imperial" } }),
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
  test("requires label confirmation and stores preferred-unit weight as kilograms", async () => {
    const onLog = jest.fn();
    const result = await render(
      <AppThemeProvider>
        <StrengthExerciseEditorModal exercise={exercise} onCancel={jest.fn()} onLog={onLog} />
      </AppThemeProvider>,
    );

    await fireEvent.changeText(result.getByLabelText("External weight (lbs)"), "220.462");
    await fireEvent.changeText(result.getByLabelText("Sets"), "3");
    await fireEvent.changeText(result.getByLabelText("Reps"), "5");
    await fireEvent.changeText(result.getByLabelText("RPE (1–10)"), "8");
    await fireEvent.changeText(result.getByLabelText("%1RM override (optional)"), "80");
    await fireEvent.press(result.getByText("Log Exercise"));
    expect(result.getByText("Confirm a workout label of 1–120 characters for each exercise.")).toBeTruthy();
    expect(onLog).not.toHaveBeenCalled();

    await fireEvent.press(result.getByText("Confirm workout label"));
    await fireEvent.press(result.getByText("Log Exercise"));
    expect(onLog).toHaveBeenCalledWith(expect.objectContaining({
      exerciseId: "bench",
      externalLoadKg: expect.closeTo(100, 4),
      name: "Bench press",
      percent1RM: 80,
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
    await fireEvent.press(result.getByText("Confirm workout label"));
    await fireEvent.press(result.getByText("Log Exercise"));
    expect(onLog).toHaveBeenCalledWith(expect.objectContaining({ externalLoadKg: 0 }));

    await fireEvent.press(result.getByText("Cancel"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
