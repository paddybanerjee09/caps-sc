import { render } from "@testing-library/react-native";

import { AppThemeProvider } from "../../theme/ThemeContext";
import { LogTimeChanger } from "../LogTimeChanger";

jest.mock("@expo/vector-icons/Ionicons", () => "Ionicons");
jest.mock("@react-native-community/datetimepicker", () => ({
  __esModule: true,
  DateTimePickerAndroid: { open: jest.fn() },
  default: "DateTimePicker",
}));

describe("LogTimeChanger", () => {
  test("keeps the complete date and time in its inline accessibility label", async () => {
    const value = new Date(2025, 3, 5, 14, 30, 0, 0);
    const result = await render(
      <AppThemeProvider>
        <LogTimeChanger
          inline
          onChange={jest.fn()}
          value={value}
        />
      </AppThemeProvider>,
    );

    const timeButton = result.getByLabelText(
      /Change log time\. Currently/,
    );
    expect(timeButton.props.accessibilityLabel).toContain("2025");
    expect(timeButton.props.accessibilityLabel).toContain("2:30");
  });
});
