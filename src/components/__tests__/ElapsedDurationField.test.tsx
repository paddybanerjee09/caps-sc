import { fireEvent, render } from "@testing-library/react-native";
import type { ComponentProps } from "react";

import { AppThemeProvider } from "../../theme/ThemeContext";
import { ElapsedDurationField } from "../ElapsedDurationField";

async function renderField(
  overrides: Partial<ComponentProps<typeof ElapsedDurationField>> = {},
) {
  const onChange = jest.fn();
  const result = await render(
    <AppThemeProvider>
      <ElapsedDurationField
        label="Work duration"
        onChange={onChange}
        valueSeconds={null}
        {...overrides}
      />
    </AppThemeProvider>,
  );

  return { onChange, result };
}

async function press(element: Parameters<typeof fireEvent.press>[0]) {
  await fireEvent.press(element);
}

describe("ElapsedDurationField", () => {
  test("shows the unset placeholder and commits separate duration parts", async () => {
    const { onChange, result } = await renderField();
    const { getByLabelText, getByText } = result;

    expect(getByText("--:--:--")).toBeTruthy();
    await press(getByLabelText("Work duration, not set"));
    await fireEvent.changeText(getByLabelText("Work duration hours"), "01");
    await fireEvent.changeText(getByLabelText("Work duration minutes"), "02");
    await fireEvent.changeText(getByLabelText("Work duration seconds"), "03");
    await press(getByText("Done"));

    expect(onChange).toHaveBeenCalledWith(3723);
  });

  test("discards a cancelled draft", async () => {
    const { onChange, result } = await renderField({
      valueSeconds: 60,
    });
    const { getByLabelText, getByText } = result;

    await press(getByLabelText("Work duration, 00:01:00"));
    await fireEvent.changeText(getByLabelText("Work duration seconds"), "30");
    await press(getByText("Cancel"));
    await press(getByLabelText("Work duration, 00:01:00"));

    expect(getByLabelText("Work duration seconds").props.value).toBe("00");
    expect(onChange).not.toHaveBeenCalled();
  });

  test("retains an untouched fractional canonical value", async () => {
    const { onChange, result } = await renderField({
      valueSeconds: 60.4,
    });
    const { getByLabelText, getByText } = result;

    await press(getByLabelText("Work duration, 00:01:00"));
    await press(getByText("Done"));

    expect(onChange).not.toHaveBeenCalled();
  });

  test("allows an explicitly selected zero only when configured", async () => {
    const { onChange, result } = await renderField({
      allowZero: true,
    });
    const { getByLabelText, getByText } = result;

    await press(getByLabelText("Work duration, not set"));
    await press(getByText("Done"));

    expect(onChange).toHaveBeenCalledWith(0);
  });
});
