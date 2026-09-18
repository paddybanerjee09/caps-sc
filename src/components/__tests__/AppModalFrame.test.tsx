import { Text } from "react-native";
import { render } from "@testing-library/react-native";

import { AppThemeProvider } from "../../theme/ThemeContext";
import { AppModalFrame } from "../AppModalFrame";

describe("AppModalFrame", () => {
  test("renders modal content when visible", async () => {
    const result = await render(
      <AppThemeProvider>
        <AppModalFrame visible onClose={jest.fn()}>
          <Text>Modal body</Text>
        </AppModalFrame>
      </AppThemeProvider>,
    );

    expect(result.getByText("Modal body")).toBeTruthy();
  });

  test("returns null when not visible", async () => {
    const result = await render(
      <AppThemeProvider>
        <AppModalFrame visible={false} onClose={jest.fn()}>
          <Text>Modal body</Text>
        </AppModalFrame>
      </AppThemeProvider>,
    );

    expect(result.queryByText("Modal body")).toBeNull();
  });
});
