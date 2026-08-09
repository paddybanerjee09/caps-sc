import { fireEvent, render } from "@testing-library/react-native";
import { useState } from "react";

import { AppThemeProvider } from "../../theme/ThemeContext";
import type { ConditioningScoreResult } from "../../types/conditioning";
import { createDefaultConditioningSessionFormDraft } from "../../utils/conditioningSessionDraft";
import {
  ConditioningAdaptationBadge,
  ConditioningSessionForm,
  ConditioningTitleInput,
  type ConditioningSessionFormDraft,
} from "../ConditioningSessionForm";

jest.mock("@expo/vector-icons/Ionicons", () => "Ionicons");

const insufficientScore: ConditioningScoreResult = {
  evidence: "insufficient",
  modelVersion: "conditioning-v1.0.0",
  primaryAdaptation: null,
  reasons: ["Complete the conditioning protocol."],
  scores: null,
  status: "insufficient",
};

function Harness({ initialDraft }: { initialDraft?: ConditioningSessionFormDraft }) {
  const [draft, setDraft] = useState(
    initialDraft ?? createDefaultConditioningSessionFormDraft("metric"),
  );

  return (
    <AppThemeProvider>
      <ConditioningSessionForm
        baselines={{
          maximumAerobicSpeedKph: null,
          maximumHeartRateBpm: 200,
          thresholdPaceSecondsPerKm: null,
        }}
        distanceUnit="metric"
        draft={draft}
        onChange={setDraft}
        scoreResult={insufficientScore}
      />
    </AppThemeProvider>
  );
}

describe("ConditioningSessionForm", () => {
  test("shows elapsed continuous measurements and a read-only preferred-unit pace", async () => {
    const result = await render(<Harness />);

    expect(result.getByLabelText("Duration, not set")).toBeTruthy();
    expect(result.getByLabelText("Distance")).toBeTruthy();
    expect(result.getByText("km")).toBeTruthy();
    expect(result.getByLabelText("Pace, — min/km")).toBeTruthy();
  });

  test("offers one Intervals type and toggles Time or Distance work", async () => {
    const result = await render(<Harness />);

    await fireEvent.press(result.getByLabelText("Type, Continuous"));
    expect(result.queryByLabelText("Circuit")).toBeNull();
    await fireEvent.press(result.getByLabelText("Intervals"));

    expect(result.getByLabelText("Work, Time")).toBeTruthy();
    expect(result.getByLabelText("Work duration, not set")).toBeTruthy();
    await fireEvent.press(result.getByLabelText("Work, Time"));
    await fireEvent.press(result.getByLabelText("Distance"));

    expect(result.getByLabelText("Distance per interval")).toBeTruthy();
    expect(
      result.getByLabelText("Duration per interval, not set"),
    ).toBeTruthy();
  });

  test("exposes Heart Rate and RPE only, with a neutral optional state", async () => {
    const result = await render(<Harness />);

    await fireEvent.press(result.getByLabelText("Intensity, not selected"));
    expect(result.getByLabelText("Heart Rate — Recommended")).toBeTruthy();
    expect(result.getByLabelText("RPE")).toBeTruthy();
    expect(result.queryByLabelText("Pace")).toBeNull();
    expect(result.queryByLabelText("No intensity")).toBeNull();

    await fireEvent.press(result.getByLabelText("Heart Rate — Recommended"));
    expect(result.getByLabelText("Average Heart Rate")).toBeTruthy();
    await fireEvent.press(result.getByLabelText("Clear intensity"));
    expect(result.getByLabelText("Intensity, not selected")).toBeTruthy();
  });

  test("activates the cached Circuit branch from the activity selector", async () => {
    const result = await render(<Harness />);

    await fireEvent.press(result.getByLabelText("Activity, Running"));
    await fireEvent.press(result.getByLabelText("Circuit"));

    expect(result.getByLabelText("Type, Circuit")).toBeTruthy();
    expect(result.getByText("Stations")).toBeTruthy();
    expect(result.getByLabelText("Add station")).toBeTruthy();
    expect(result.queryByLabelText("Type, Continuous")).toBeNull();
  });

  test("supports compact external title and adaptation placement", async () => {
    const onChangeText = jest.fn();
    const result = await render(
      <AppThemeProvider>
        <ConditioningTitleInput
          compact
          onChangeText={onChangeText}
          value="Tempo"
        />
        <ConditioningAdaptationBadge
          compact
          onPress={jest.fn()}
          scoreResult={insufficientScore}
        />
      </AppThemeProvider>,
    );

    expect(result.getByLabelText("Session title").props.value).toBe("Tempo");
    const badgeText = result.getByText("Adaptation pending");
    expect(badgeText.props.numberOfLines).toBe(2);
    expect(badgeText.props.ellipsizeMode).toBe("tail");
  });
});
