import { act, fireEvent, render, waitFor } from "@testing-library/react-native";

import { AppThemeProvider } from "../../theme/ThemeContext";
import type { ExerciseDbExercise } from "../../types/exerciseDb";
import { ExerciseSearchModal } from "../ExerciseSearchModal";

const mockSearch = jest.fn();
const mockDetail = jest.fn();

jest.mock("../../services/exerciseDbApi", () => ({
  getExerciseDbDetail: (...args: unknown[]) => mockDetail(...args),
  isExerciseRequestCancelled: (error: unknown) => error instanceof Error && error.name === "AbortError",
  isStrengthSearchResult: () => true,
  searchExerciseDb: (...args: unknown[]) => mockSearch(...args),
}));

const lightweight: ExerciseDbExercise = {
  exerciseId: "bench",
  name: "Bench press",
  gifUrl: null,
  bodyParts: [],
  targetMuscles: [],
  secondaryMuscles: [],
  equipments: [],
  instructions: [],
};
const detail: ExerciseDbExercise = {
  ...lightweight,
  bodyParts: ["chest"],
  targetMuscles: ["pectorals"],
  equipments: ["barbell"],
  instructions: ["Press the bar."],
};

describe("ExerciseSearchModal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockSearch.mockResolvedValue({ exercises: [lightweight], nextCursor: null });
    mockDetail.mockResolvedValue(detail);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("debounces search, fetches incomplete details, and selects the exercise", async () => {
    const onSelect = jest.fn();
    const result = await render(
      <AppThemeProvider>
        <ExerciseSearchModal onCancel={jest.fn()} onSelect={onSelect} />
      </AppThemeProvider>,
    );

    await fireEvent.changeText(result.getByLabelText("Search exercises"), "bench");
    expect(mockSearch).not.toHaveBeenCalled();
    await act(async () => { await jest.advanceTimersByTimeAsync(300); });
    await waitFor(() => expect(mockSearch).toHaveBeenCalledWith("bench", expect.any(AbortSignal)));

    await fireEvent.press(result.getByLabelText("Select Bench press"));
    await waitFor(() => expect(mockDetail).toHaveBeenCalledWith("bench", expect.any(AbortSignal)));
    expect(onSelect).toHaveBeenCalledWith(detail);
  });

  test("shows errors and retries the same query", async () => {
    mockSearch.mockRejectedValueOnce(new Error("Network unavailable."));
    const result = await render(
      <AppThemeProvider>
        <ExerciseSearchModal onCancel={jest.fn()} onSelect={jest.fn()} />
      </AppThemeProvider>,
    );

    await fireEvent.changeText(result.getByLabelText("Search exercises"), "bench");
    await act(async () => { await jest.advanceTimersByTimeAsync(300); });
    expect(await result.findByText("Network unavailable.")).toBeTruthy();

    mockSearch.mockResolvedValueOnce({ exercises: [lightweight], nextCursor: null });
    await fireEvent.press(result.getByText("Retry search"));
    await act(async () => { await jest.advanceTimersByTimeAsync(300); });
    await waitFor(() => expect(mockSearch).toHaveBeenCalledTimes(2));
    expect(result.getByLabelText("Select Bench press")).toBeTruthy();
  });

  test("aborts an in-flight search when dismissed", async () => {
    let signal: AbortSignal | undefined;
    mockSearch.mockImplementation((_query: string, nextSignal: AbortSignal) => {
      signal = nextSignal;
      return new Promise(() => undefined);
    });
    const onCancel = jest.fn();
    const result = await render(
      <AppThemeProvider>
        <ExerciseSearchModal onCancel={onCancel} onSelect={jest.fn()} />
      </AppThemeProvider>,
    );

    await fireEvent.changeText(result.getByLabelText("Search exercises"), "bench");
    await act(async () => { await jest.advanceTimersByTimeAsync(300); });
    await fireEvent.press(result.getByText("Cancel"));
    expect(signal?.aborted).toBe(true);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
