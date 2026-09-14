import { render } from "@testing-library/react-native";

import { AppThemeProvider } from "../../theme/ThemeContext";
import { MonthTimeline } from "../MonthTimeline";

jest.mock("@expo/vector-icons/Ionicons", () => "Ionicons");
jest.mock("@expo/vector-icons/MaterialCommunityIcons", () => "MaterialCommunityIcons");

const common = {
  displayedMonth: new Date(2026, 0, 1, 12),
  selectedDate: new Date(2026, 0, 15, 12),
  events: [],
  loading: false,
  error: null,
  onDisplayedMonthChange: jest.fn(),
  onEventPress: jest.fn(),
  onRetry: jest.fn(),
  onSelectedDateChange: jest.fn(),
};

describe("MonthTimeline", () => {
  test("keeps conditioning defaults while allowing strength-specific copy", async () => {
    const result = await render(
      <AppThemeProvider><MonthTimeline {...common} /></AppThemeProvider>,
    );
    expect(result.getByText("No conditioning sessions on this date")).toBeTruthy();
    expect(result.getAllByLabelText(/0 conditioning sessions/).length).toBeGreaterThan(0);

    await result.rerender(
      <AppThemeProvider>
        <MonthTimeline {...common} emptyText="No strength sessions on this date" sessionKindLabel="strength" />
      </AppThemeProvider>,
    );
    expect(result.getByText("No strength sessions on this date")).toBeTruthy();
    expect(result.getAllByLabelText(/0 strength sessions/).length).toBeGreaterThan(0);
  });
});
