import { fireEvent, render } from "@testing-library/react-native";
import { AppThemeProvider } from "../../theme/ThemeContext";
import type { StoredStrengthTemplate } from "../../types/strength";
import { LogStrengthSessionConfirmationModal } from "../LogStrengthSessionConfirmationModal";
jest.setTimeout(30_000);
const mockDb = {}; const mockLogSession = jest.fn();
jest.mock("expo-sqlite", () => ({ useSQLiteContext: () => mockDb }));
jest.mock("../../data/strengthRepository", () => ({ logCompletedStrengthSession: (...args: unknown[]) => mockLogSession(...args) }));
const template: StoredStrengthTemplate = { id: 8, title: "Legs", createdAt: 1, updatedAt: 1, exercises: [{
  exerciseId: "squat", name: "Squat", labelConfirmed: true, movementProfile: "unknown", movementProfileSource: "unknown",
  externalLoadKg: 0, sets: 3, reps: 5, rpe: 8, percent1RM: null, notes: null,
}] };
describe("LogStrengthSessionConfirmationModal", () => {
  beforeEach(() => { jest.clearAllMocks(); mockLogSession.mockResolvedValue(20); });
  test("shows exact title, cancels, and logs at selected date with refresh callback", async () => {
    const onClose = jest.fn(); const onLogged = jest.fn();
    const view = await render(<AppThemeProvider><LogStrengthSessionConfirmationModal template={template} selectedDate={new Date(2020, 1, 2)} onClose={onClose} onLogged={onLogged} /></AppThemeProvider>);
    expect(view.getByText("Log Strength Session?")).toBeTruthy();
    await fireEvent.press(view.getByText("Log Session"));
    expect(mockLogSession).toHaveBeenCalledWith(mockDb, expect.objectContaining({ title: "Legs", sourceTemplateId: 8 }));
    expect(onClose).toHaveBeenCalled(); expect(onLogged).toHaveBeenCalled();
  });
});
