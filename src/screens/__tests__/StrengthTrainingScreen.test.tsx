import { fireEvent, render, waitFor } from "@testing-library/react-native";

import { AppThemeProvider } from "../../theme/ThemeContext";
import { StrengthTrainingScreen } from "../StrengthTrainingScreen";

const mockDb = {};
const mockGetSessions = jest.fn();
const mockListTemplates = jest.fn();

jest.mock("expo-sqlite", () => ({ useSQLiteContext: () => mockDb }));
jest.mock("../../data/strengthRepository", () => ({
  getStrengthSessionsForRange: (...args: unknown[]) => mockGetSessions(...args),
  listStrengthTemplates: (...args: unknown[]) => mockListTemplates(...args),
}));
jest.mock("../../components/MonthTimeline", () => {
  const { Pressable, Text, View } = jest.requireActual("react-native");
  return {
    getMonthTimelineDateKey: (date: Date) => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-"),
    MonthTimeline: ({ events, onSelectedDateChange }: { events: { title: string; activityIcon: string }[]; onSelectedDateChange: (date: Date) => void }) => <View>
      <Text>Month: {events.map(event => `${event.title}:${event.activityIcon}`).join("|")}</Text>
      <Pressable accessibilityLabel="Select future strength date" onPress={() => onSelectedDateChange(new Date(2999, 0, 1, 12))}><Text>Select future</Text></Pressable>
    </View>,
  };
});
jest.mock("../../components/CreateStrengthSessionModal", () => {
  const { Pressable, Text } = jest.requireActual("react-native");
  return { CreateStrengthSessionModal: ({ visible, onClose, onLogged }: { visible: boolean; onClose: () => void; onLogged: () => void }) => visible
    ? <Pressable accessibilityLabel="Complete strength quick log" onPress={() => { onClose(); onLogged(); }}><Text>Complete log</Text></Pressable>
    : null };
});
jest.mock("../../components/LogStrengthSessionConfirmationModal", () => ({ LogStrengthSessionConfirmationModal: () => null }));
jest.mock("../../components/SavedStrengthWorkoutsModal", () => ({ SavedStrengthWorkoutsModal: () => null }));
jest.mock("../../components/StrengthSessionDetailModal", () => ({ StrengthSessionDetailModal: () => null }));

describe("StrengthTrainingScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSessions.mockResolvedValue([{ timelineEntryId: 11, title: "Squat day", startAt: 1_700_000_000_000, primaryAdaptation: "hypertrophy", evidence: "full" }]);
    mockListTemplates.mockResolvedValue([]);
  });

  test("uses strength-only month events and refreshes after logging", async () => {
    const result = await render(<AppThemeProvider><StrengthTrainingScreen /></AppThemeProvider>);
    await waitFor(() => expect(mockGetSessions.mock.calls.length).toBeGreaterThan(0));
    expect(result.getByText("Month: Squat day:weight-lifter")).toBeTruthy();
    expect(result.getByText("Log Workout")).toBeTruthy();

    const initialReads = mockGetSessions.mock.calls.length;
    await fireEvent.press(result.getByText("Log Workout"));
    await fireEvent.press(result.getByLabelText("Complete strength quick log"));
    await waitFor(() => expect(mockGetSessions.mock.calls.length).toBeGreaterThan(initialReads));
  });

  test("disables logging after a future day is selected", async () => {
    const result = await render(<AppThemeProvider><StrengthTrainingScreen /></AppThemeProvider>);
    await waitFor(() => expect(mockGetSessions.mock.calls.length).toBeGreaterThan(0));
    await fireEvent.press(result.getByLabelText("Select future strength date"));
    expect(await result.findByText("Completed sessions can only be logged for today or an earlier date.")).toBeTruthy();
    await fireEvent.press(result.getByText("Log Workout"));
    expect(result.queryByLabelText("Complete strength quick log")).toBeNull();
  });
});
