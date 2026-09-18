import React from "react";
import { AccessibilityInfo, Text } from "react-native";
import { render } from "@testing-library/react-native";

import { AppThemeProvider } from "../../theme/ThemeContext";
import { RemoteMediaThumbnail } from "../RemoteMediaThumbnail";

jest.mock("expo-image", () => ({
  Image: () => null,
}));

jest.mock("@expo/vector-icons/Ionicons", () => {
  const { Text: MockText } = jest.requireActual("react-native");
  return {
    __esModule: true,
    default: ({ accessibilityLabel }: { accessibilityLabel?: string }) => (
      <MockText>{accessibilityLabel ?? "Exercise preview unavailable"}</MockText>
    ),
  };
});

describe("RemoteMediaThumbnail", () => {
  beforeEach(() => {
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
    jest.spyOn(AccessibilityInfo, "addEventListener").mockReturnValue({ remove: jest.fn() } as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("renders fallback icon when media is missing", async () => {
    const result = await render(
      <AppThemeProvider>
        <RemoteMediaThumbnail accessibilityLabel="Preview unavailable" recyclingKey="abc" uri={null} />
      </AppThemeProvider>,
    );
    expect(result.getByText("Exercise preview unavailable")).toBeTruthy();
  });

  test("renders preview container when uri is provided", async () => {
    const result = await render(
      <AppThemeProvider>
        <RemoteMediaThumbnail accessibilityLabel="Bench preview" recyclingKey="abc" uri="https://img.test/a.gif" />
      </AppThemeProvider>,
    );
    expect(result.getByLabelText("Bench preview")).toBeTruthy();
  });
});
