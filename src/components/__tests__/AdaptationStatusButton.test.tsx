import { fireEvent, render } from "@testing-library/react-native";

import { AppThemeProvider } from "../../theme/ThemeContext";
import { AdaptationStatusButton } from "../AdaptationStatusButton";

describe("AdaptationStatusButton", () => {
  test("renders label and handles press", async () => {
    const onPress = jest.fn();
    const result = await render(
      <AppThemeProvider>
        <AdaptationStatusButton
          accessibilityLabel="Primary adaptation, Power"
          label="Power"
          onPress={onPress}
        />
      </AppThemeProvider>,
    );

    expect(result.getByText("Power")).toBeTruthy();
    fireEvent.press(result.getByLabelText("Primary adaptation, Power"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
