import { fireEvent, render } from "@testing-library/react-native";

import { AppThemeProvider } from "../../theme/ThemeContext";
import type { ExerciseDbExercise } from "../../types/exerciseDb";
import type { StrengthExercise } from "../../types/strength";
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
  beforeEach(() => { mockWeightUnit = "imperial"; });

  test("keeps a saved weight when editing in pounds and removes the old override", async () => {
    const initial: StrengthExercise = {
      exerciseId: "bench", name: "Bench press", externalLoadKg: 100,
      sets: 3, reps: 5, rpe: 8, percent1RM: 80, notes: null,
      movementProfile: "non_explosive", movementProfileSource: "name-rule",
    };
    const onLog = jest.fn();
    const result = await render(<AppThemeProvider>
      <StrengthExerciseEditorModal exercise={exercise} initial={initial} onCancel={jest.fn()} onLog={onLog} />
    </AppThemeProvider>);
    expect(Number(result.getByLabelText("Weight (lbs)").props.value)).toBeCloseTo(220.462, 3);
    await fireEvent.press(result.getByText("Log Exercise"));
    expect(onLog).toHaveBeenCalledWith(expect.objectContaining({
      externalLoadKg: expect.closeTo(100, 3), percent1RM: null,
    }));
  });

  test("keeps the draft available after invalid input so it can be corrected", async () => {
    const onLog = jest.fn();
    const result = await render(<AppThemeProvider>
      <StrengthExerciseEditorModal exercise={exercise} onCancel={jest.fn()} onLog={onLog} />
    </AppThemeProvider>);
    await fireEvent.changeText(result.getByLabelText("Sets"), "3");
    await fireEvent.changeText(result.getByLabelText("Reps"), "5");
    await fireEvent.changeText(result.getByLabelText("RPE (1–10)"), "11");
    await fireEvent.press(result.getByText("Log Exercise"));
    expect(result.getByText("RPE must be from 1 to 10.")).toBeTruthy();
    expect(onLog).not.toHaveBeenCalled();
    await fireEvent.changeText(result.getByLabelText("RPE (1–10)"), "8");
    await fireEvent.press(result.getByText("Log Exercise"));
    expect(onLog).toHaveBeenCalledWith(expect.objectContaining({ sets: 3, reps: 5, rpe: 8 }));
  });

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
