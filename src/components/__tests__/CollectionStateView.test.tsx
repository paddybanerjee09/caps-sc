import { fireEvent, render } from "@testing-library/react-native";

import { AppThemeProvider } from "../../theme/ThemeContext";
import { CollectionStateView } from "../CollectionStateView";

describe("CollectionStateView", () => {
  test("renders loading and error retry states", async () => {
    const onAction = jest.fn();
    const loading = await render(
      <AppThemeProvider>
        <CollectionStateView label="Searching exercises" variant="loading" />
      </AppThemeProvider>,
    );
    expect(loading.getByLabelText("Searching exercises")).toBeTruthy();

    const error = await render(
      <AppThemeProvider>
        <CollectionStateView actionLabel="Retry" label="Network unavailable." variant="error" onAction={onAction} />
      </AppThemeProvider>,
    );
    fireEvent.press(error.getByLabelText("Retry"));
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
