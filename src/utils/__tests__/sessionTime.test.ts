import {
  deriveSessionBoundsFromEnd,
  SessionTimeValidationError,
} from "../sessionTime";

const NOW = Date.UTC(2024, 2, 10, 15, 0, 0);

describe("deriveSessionBoundsFromEnd", () => {
  test("derives startAt by subtracting duration once", () => {
    expect(
      deriveSessionBoundsFromEnd(NOW, 600, NOW + 60_000),
    ).toEqual({
      endAt: NOW,
      startAt: NOW - 600_000,
    });
  });

  test("supports sessions that cross midnight", () => {
    const endAt = Date.UTC(2024, 2, 10, 0, 15, 0);
    const { startAt } = deriveSessionBoundsFromEnd(
      endAt,
      45 * 60,
      endAt + 60_000,
    );

    expect(new Date(startAt).getUTCDate()).toBe(9);
    expect(new Date(startAt).getUTCHours()).toBe(23);
    expect(new Date(startAt).getUTCMinutes()).toBe(30);
  });

  test("uses local date arithmetic across a DST spring-forward gap", () => {
    const endAt = new Date(2024, 2, 10, 3, 30, 0, 0).getTime();
    const { startAt } = deriveSessionBoundsFromEnd(endAt, 90 * 60, endAt + 60_000);

    expect(new Date(startAt).getHours()).toBe(2);
    expect(new Date(startAt).getMinutes()).toBe(0);
  });

  test("rejects future end times", () => {
    expect(() =>
      deriveSessionBoundsFromEnd(NOW + 60_000, 600, NOW),
    ).toThrow(SessionTimeValidationError);
    expect(() =>
      deriveSessionBoundsFromEnd(NOW + 60_000, 600, NOW),
    ).toThrow("Completed sessions cannot end in the future.");
  });
});
