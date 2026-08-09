import {
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react-native";
import { Pressable, Text, View } from "react-native";

import { AppStateProvider, useAppState } from "../AppStateContext";

let storedDistanceUnit: "metric" | "imperial" = "metric";
let pendingRead: Promise<void> | null = null;
let finishPendingRead: (() => void) | null = null;
let pendingWrite: Promise<void> | null = null;
let finishPendingWrite: (() => void) | null = null;

const mockDb = {
  getFirstAsync: jest.fn(async (sql: string) => {
    if (sql.includes("athlete_preferences")) {
      await pendingRead;
      return { distance_unit: storedDistanceUnit };
    }

    throw new Error(`Unexpected query: ${sql}`);
  }),
  runAsync: jest.fn(async (_sql: string, distanceUnit: "metric" | "imperial") => {
    await pendingWrite;
    storedDistanceUnit = distanceUnit;
  }),
};

jest.mock("expo-sqlite", () => ({
  useSQLiteContext: () => mockDb,
}));

jest.mock("../../data/timelineRepository", () => ({
  addWeightLog: jest.fn(),
  deleteWeightLog: jest.fn(),
  getLatestWeightKg: jest.fn(async () => null),
  updateWeightLog: jest.fn(),
}));

function DistancePreferenceHarness() {
  const { setDistanceUnit, unitSettings } = useAppState();

  return (
    <View>
      <Text accessibilityLabel={`Distance unit, ${unitSettings.distance}`}>
        {unitSettings.distance}
      </Text>
      <Pressable
        accessibilityLabel="Use imperial distance"
        onPress={() => void setDistanceUnit("imperial")}
      >
        <Text>Use imperial</Text>
      </Pressable>
      <Pressable
        accessibilityLabel="Use metric distance"
        onPress={() => void setDistanceUnit("metric")}
      >
        <Text>Use metric</Text>
      </Pressable>
    </View>
  );
}

async function renderProvider() {
  return render(
    <AppStateProvider>
      <DistancePreferenceHarness />
    </AppStateProvider>,
  );
}

describe("AppStateProvider distance preference", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    storedDistanceUnit = "metric";
    pendingRead = null;
    finishPendingRead = null;
    pendingWrite = null;
    finishPendingWrite = null;
  });

  test("updates only after persistence and hydrates the value after remount", async () => {
    const firstMount = await renderProvider();
    expect(await firstMount.findByLabelText("Distance unit, metric")).toBeTruthy();

    pendingWrite = new Promise<void>((resolve) => {
      finishPendingWrite = resolve;
    });
    await fireEvent.press(firstMount.getByLabelText("Use imperial distance"));
    expect(firstMount.getByLabelText("Distance unit, metric")).toBeTruthy();
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO athlete_preferences"),
      "imperial",
    );

    finishPendingWrite?.();
    await waitFor(() =>
      expect(firstMount.getByLabelText("Distance unit, imperial")).toBeTruthy(),
    );
    await firstMount.unmount();

    pendingWrite = null;
    const secondMount = await renderProvider();
    expect(
      await secondMount.findByLabelText("Distance unit, imperial"),
    ).toBeTruthy();
    expect(mockDb.getFirstAsync).toHaveBeenCalledTimes(2);
  });

  test("does not expose a temporary metric value before imperial hydration", async () => {
    storedDistanceUnit = "imperial";
    pendingRead = new Promise<void>((resolve) => {
      finishPendingRead = resolve;
    });

    const result = await renderProvider();
    expect(result.queryByText("metric")).toBeNull();
    expect(result.queryByText("imperial")).toBeNull();

    finishPendingRead?.();
    expect(
      await result.findByLabelText("Distance unit, imperial"),
    ).toBeTruthy();
  });

  test("serializes rapid unit changes and exposes only the latest saved choice", async () => {
    const result = await renderProvider();
    expect(await result.findByLabelText("Distance unit, metric")).toBeTruthy();
    pendingWrite = new Promise<void>((resolve) => {
      finishPendingWrite = resolve;
    });

    await fireEvent.press(result.getByLabelText("Use imperial distance"));
    await fireEvent.press(result.getByLabelText("Use metric distance"));
    expect(result.getByLabelText("Distance unit, metric")).toBeTruthy();

    finishPendingWrite?.();
    await waitFor(() => expect(mockDb.runAsync).toHaveBeenCalledTimes(2));
    expect(storedDistanceUnit).toBe("metric");
    expect(result.getByLabelText("Distance unit, metric")).toBeTruthy();
  });
});
