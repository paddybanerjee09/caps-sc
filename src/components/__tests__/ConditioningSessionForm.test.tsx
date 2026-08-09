import { fireEvent, render } from "@testing-library/react-native";
import { useState } from "react";

import { AppThemeProvider } from "../../theme/ThemeContext";
import type { ConditioningScoreResult } from "../../types/conditioning";
import {
  analyzeConditioningSessionFormDraft,
  createConditioningSessionFormDraftFromDefinition,
  createDefaultConditioningSessionFormDraft,
} from "../../utils/conditioningSessionDraft";
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

  test("uses an inline Duration or Distance selector with two work/rest fields", async () => {
    const result = await render(<Harness />);

    await fireEvent.press(result.getByLabelText("Type, Continuous"));
    expect(result.queryByLabelText("Circuit")).toBeNull();
    await fireEvent.press(result.getByLabelText("Intervals"));

    expect(result.getByLabelText("Work, Duration")).toBeTruthy();
    expect(result.getByLabelText("Work duration, not set")).toBeTruthy();
    await fireEvent.press(result.getByLabelText("Work duration, not set"));
    expect(result.queryByLabelText("Work duration hours")).toBeNull();
    expect(result.getByLabelText("Work duration minutes")).toBeTruthy();
    await fireEvent.press(result.getByText("Cancel"));
    await fireEvent.press(result.getByLabelText("Work, Duration"));
    await fireEvent.press(result.getByLabelText("Distance"));

    expect(result.getByLabelText("Distance per interval")).toBeTruthy();
    expect(result.queryByText("Duration per interval")).toBeNull();
    expect(result.queryByLabelText(/Duration per interval/)).toBeNull();
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

  test("shows retained legacy pace values without offering Pace as a choice", async () => {
    const thresholdDraft = createConditioningSessionFormDraftFromDefinition({
      activity: "running",
      intensity: {
        method: "pace",
        paceSecondsPerKm: 245,
        reference: "threshold_pace",
      },
      notes: null,
      protocol: {
        distanceMeters: 5_000,
        durationSeconds: 1_200,
        type: "continuous",
      },
      title: "Threshold run",
    });
    const threshold = await render(<Harness initialDraft={thresholdDraft} />);
    expect(threshold.getByText("Pace — 4:05 min/km")).toBeTruthy();
    expect(
      threshold.getByLabelText(
        "Intensity, Pace, 4:05 min/km, legacy value",
      ),
    ).toBeTruthy();
    expect(threshold.queryByLabelText("Pace")).toBeNull();
    await threshold.unmount();

    const speedDraft = createConditioningSessionFormDraftFromDefinition({
      activity: "running",
      intensity: {
        method: "pace",
        reference: "maximum_aerobic_speed",
        speedKph: 17.5,
      },
      notes: null,
      protocol: {
        distanceMeters: 3_000,
        durationSeconds: 600,
        type: "continuous",
      },
      title: "MAS run",
    });
    const speed = await render(<Harness initialDraft={speedDraft} />);
    expect(speed.getByText("Pace — 17.5 km/h")).toBeTruthy();
    expect(
      speed.getByLabelText(
        "Intensity, Pace, 17.5 km/h, legacy value",
      ),
    ).toBeTruthy();
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

  test("shows dedicated hill sprint fields and locks assault bike to intervals", async () => {
    const result = await render(<Harness />);

    await fireEvent.press(result.getByLabelText("Activity, Running"));
    await fireEvent.press(result.getByLabelText("Hill Sprints"));

    expect(result.queryByLabelText(/Type,/)).toBeNull();
    expect(result.getByLabelText("Distance")).toBeTruthy();
    expect(result.getByLabelText("Elevation gain")).toBeTruthy();
    expect(result.getByLabelText("Intensity (RPE)")).toBeTruthy();
    expect(result.getByLabelText("Repetitions")).toBeTruthy();
    expect(result.getByLabelText("Rest between reps, 00:00")).toBeTruthy();
    expect(result.getAllByText("m")).toHaveLength(2);

    await fireEvent.press(result.getByLabelText("Activity, Hill Sprints"));
    await fireEvent.press(result.getByLabelText("Assault Bike"));
    expect(result.getByLabelText("Type, Intervals")).toBeTruthy();
    expect(result.queryByLabelText("Type, Continuous")).toBeNull();
  });

  test("reorders Circuit stations and serializes their new positions", async () => {
    const initialDraft = createDefaultConditioningSessionFormDraft("metric");
    initialDraft.activity = "circuit";
    initialDraft.activeProtocolType = "circuit";
    initialDraft.circuit.stations = [
      { nameInput: "Bike", workSeconds: 30 },
      { nameInput: "Carry", workSeconds: 45 },
    ];
    let latestDraft = initialDraft;

    function ReorderHarness() {
      const [draft, setDraft] = useState(initialDraft);
      return (
        <AppThemeProvider>
          <ConditioningSessionForm
            baselines={{
              maximumAerobicSpeedKph: null,
              maximumHeartRateBpm: null,
              thresholdPaceSecondsPerKm: null,
            }}
            distanceUnit="metric"
            draft={draft}
            onChange={(nextDraft) => {
              latestDraft = nextDraft;
              setDraft(nextDraft);
            }}
            scoreResult={insufficientScore}
          />
        </AppThemeProvider>
      );
    }

    const result = await render(<ReorderHarness />);
    await fireEvent.press(result.getByLabelText("Move station 2 up"));
    expect(
      result.getAllByLabelText("Name").map((input) => input.props.value),
    ).toEqual(["Carry", "Bike"]);

    const analysis = analyzeConditioningSessionFormDraft(latestDraft, {
      maximumAerobicSpeedKph: null,
      maximumHeartRateBpm: null,
      thresholdPaceSecondsPerKm: null,
    });
    expect(analysis.ok).toBe(true);
    if (!analysis.ok || analysis.protocol.type !== "circuit") return;
    expect(analysis.protocol.stations).toEqual([
      { name: "Carry", position: 0, workSeconds: 45 },
      { name: "Bike", position: 1, workSeconds: 30 },
    ]);
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
