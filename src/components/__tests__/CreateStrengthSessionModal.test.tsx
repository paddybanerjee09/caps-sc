import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { AppThemeProvider } from "../../theme/ThemeContext";
import type { StrengthExercise } from "../../types/strength";
import { CreateStrengthSessionModal } from "../CreateStrengthSessionModal";

jest.setTimeout(30_000);

const mockDb = {};
const mockCreateTemplate = jest.fn(); const mockUpdateTemplate = jest.fn(); const mockLogSession = jest.fn();
jest.mock("expo-sqlite", () => ({ useSQLiteContext: () => mockDb }));
jest.mock("../../data/strengthRepository", () => ({
  createStrengthTemplate: (...args: unknown[]) => mockCreateTemplate(...args),
  updateStrengthTemplate: (...args: unknown[]) => mockUpdateTemplate(...args),
  logCompletedStrengthSession: (...args: unknown[]) => mockLogSession(...args),
}));
jest.mock("../LogTimeChanger", () => {
  const { Text } = jest.requireActual("react-native");
  return { LogTimeChanger: () => <Text>Log time</Text> };
});
const mockPrescribed: StrengthExercise = { exerciseId: "bench", name: "Bench press", 
  movementProfile: "non_explosive", movementProfileSource: "name-rule", externalLoadKg: 80, sets: 3, reps: 8, rpe: 8, percent1RM: 70, notes: null };
jest.mock("../ExerciseSearchModal", () => {
  const { Pressable, Text } = jest.requireActual("react-native");
  return { ExerciseSearchModal: ({ onSelect }: { onSelect: (value: unknown) => void }) =>
    <Pressable accessibilityLabel="Select provider exercise" onPress={() => onSelect({ exerciseId: "bench", name: "Bench press", gifUrl: null, bodyParts: [], targetMuscles: [], secondaryMuscles: [], equipments: [], instructions: [] })}><Text>Select provider exercise</Text></Pressable> };
});
jest.mock("../StrengthExerciseEditorModal", () => {
  const { Pressable, Text } = jest.requireActual("react-native");
  return { StrengthExerciseEditorModal: ({ onLog }: { onLog: (value: StrengthExercise) => void }) =>
    <Pressable accessibilityLabel="Finish exercise editor" onPress={() => onLog(mockPrescribed)}><Text>Finish exercise editor</Text></Pressable> };
});

describe("CreateStrengthSessionModal", () => {
  beforeEach(() => { jest.clearAllMocks(); mockCreateTemplate.mockResolvedValue({ id: 9 }); mockUpdateTemplate.mockResolvedValue(undefined); mockLogSession.mockResolvedValue(44); });
  test("moves search to editor to an ordered draft and logs", async () => {
    const onClose = jest.fn(); const onLogged = jest.fn();
    const view = await render(<AppThemeProvider><CreateStrengthSessionModal visible selectedDate={new Date(2020, 1, 1)} onClose={onClose} onLogged={onLogged} /></AppThemeProvider>);
    await fireEvent.changeText(view.getByLabelText("Session title"), "Upper body");
    await fireEvent.press(view.getByText("Add exercise"));
    await fireEvent.press(view.getByLabelText("Select provider exercise"));
    await fireEvent.press(view.getByLabelText("Finish exercise editor"));
    expect(view.getByText("Bench press")).toBeTruthy();
    await fireEvent.press(view.getByText("Log"));
    await waitFor(() => expect(mockLogSession).toHaveBeenCalledWith(mockDb, expect.objectContaining({ title: "Upper body", exercises: [mockPrescribed] })));
    expect(onClose).toHaveBeenCalled(); expect(onLogged).toHaveBeenCalled();
  });
  test("saves a reusable template and closes", async () => {
    const template = { id: 7, title: "Original", exercises: [mockPrescribed], createdAt: 1, updatedAt: 1 };
    const onClose = jest.fn(); const onSaved = jest.fn();
    const view = await render(<AppThemeProvider><CreateStrengthSessionModal visible selectedDate={new Date(2020, 1, 1)} template={template} onClose={onClose} onSaved={onSaved} onLogged={jest.fn()} /></AppThemeProvider>);
    await fireEvent.changeText(view.getByLabelText("Session title"), "Updated");
    await fireEvent.press(view.getByText("Save"));
    await waitFor(() => expect(mockUpdateTemplate).toHaveBeenCalledWith(mockDb, 7, expect.objectContaining({ title: "Updated" })));
    expect(onClose).toHaveBeenCalled(); expect(onSaved).toHaveBeenCalled(); expect(mockCreateTemplate).not.toHaveBeenCalled();
  });
  test("cancel closes without writes", async () => {
    const onClose = jest.fn();
    const view = await render(<AppThemeProvider><CreateStrengthSessionModal visible selectedDate={new Date(2020, 1, 1)} onClose={onClose} onLogged={jest.fn()} /></AppThemeProvider>);
    await fireEvent.press(view.getByText("Cancel")); expect(onClose).toHaveBeenCalled();
    expect(mockCreateTemplate).not.toHaveBeenCalled(); expect(mockLogSession).not.toHaveBeenCalled();
  });
});
