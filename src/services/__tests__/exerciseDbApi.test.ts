import { buildExerciseSearchUrl, ExerciseDbError, getExerciseDbDetail, normalizeExerciseDbExercise, searchExerciseDb } from "../exerciseDbApi";

const originalFetch = globalThis.fetch;
const record = { exerciseId: "abc", name: "bench press", gifUrl: "https://img.test/a.gif", bodyParts: ["chest"], targetMuscles: ["pectorals"], secondaryMuscles: ["triceps"], equipments: ["barbell"], instructions: ["Press the bar upward."] };
afterEach(() => { globalThis.fetch = originalFetch; jest.restoreAllMocks(); });
describe("ExerciseDB adapter", () => {
  test("builds free and proxy request URLs", () => {
    expect(buildExerciseSearchUrl(" bench ")).toBe("https://oss.exercisedb.dev/api/v1/exercises?limit=25&name=bench");
    expect(buildExerciseSearchUrl("bench", "cursor", { tier: "proxy", baseUrl: "https://caps.test/api/" })).toBe("https://caps.test/api/exercises?limit=25&name=bench&exerciseTypes=strength&after=cursor");
    expect(buildExerciseSearchUrl("bench", "cursor")).toBe("https://oss.exercisedb.dev/api/v1/exercises?limit=25&name=bench&after=cursor");
  });
  test("normalizes free records with formatted titles and preserved instructions", () => {
    const result = normalizeExerciseDbExercise(record);
    expect(result.exerciseId).toBe("abc");
    expect(result.name).toBe("Bench Press");
    expect(result.bodyParts).toEqual(["Chest"]);
    expect(result.instructions).toEqual(["Press the bar upward."]);
    expect("exerciseTypes" in result).toBe(false);
    expect(() => normalizeExerciseDbExercise({ name: "Missing id" })).toThrow(ExerciseDbError);
  });
  test("filters explicit cardio and obvious free-tier cardio", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true, data: [record,
      { ...record, exerciseId: "cardio", exerciseTypes: ["cardio"] }, { ...record, exerciseId: "run", name: "treadmill running" }] }) }) as jest.Mock;
    await expect(searchExerciseDb("be")).resolves.toMatchObject({ exercises: [{ exerciseId: "abc", name: "Bench Press" }] });
  });
  test.each([[429, "rate-limit"], [500, "http"]] as const)("maps HTTP %s errors", async (status, kind) => {
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: false, status }) as jest.Mock;
    await expect(searchExerciseDb("bench")).rejects.toMatchObject({ kind, status });
  });
  test("rejects malformed details and honors cancellation", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true, data: { name: "bad" } }) }) as jest.Mock;
    await expect(getExerciseDbDetail("abc")).rejects.toMatchObject({ kind: "malformed" });
    const controller = new AbortController(); controller.abort();
    await expect(searchExerciseDb("bench", controller.signal)).rejects.toMatchObject({ name: "AbortError" });
  });
  test("normalizes image fallback and rejects malformed array fields", () => {
    expect(normalizeExerciseDbExercise({ ...record, gifUrl: null, imageUrls: { "360p": "https://img.test/image.png" } }).gifUrl).toBe("https://img.test/image.png");
    expect(() => normalizeExerciseDbExercise({ ...record, bodyParts: "chest" })).toThrow(ExerciseDbError);
  });
  test("does not request fewer than two non-space characters", async () => {
    const mockFetch = jest.fn(); globalThis.fetch = mockFetch;
    await expect(searchExerciseDb(" a ")).resolves.toEqual({ exercises: [], nextCursor: null });
    expect(mockFetch).not.toHaveBeenCalled();
  });
  test("free and proxy cursors are normalized from meta", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true, data: Array.from({ length: 25 }, () => record), meta: { hasNextPage: true, nextCursor: "next" } }) });
    expect((await searchExerciseDb("bench")).nextCursor).toBe("next");
    expect((await searchExerciseDb("bench", undefined, null, { tier: "proxy", baseUrl: "https://caps.test" })).nextCursor).toBe("next");
  });
  test.each([
    ["invalid JSON", () => Promise.reject(new SyntaxError("bad JSON")), "malformed"],
    ["API failure", async () => ({ success: false, error: { message: "bad" } }), "http"],
    ["missing data", async () => ({ success: true }), "malformed"],
  ])("handles %s", async (_, json, kind) => {
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json });
    await expect(searchExerciseDb("bench")).rejects.toMatchObject({ kind });
  });
  test("reports network failure and ID mismatch", async () => {
    globalThis.fetch = jest.fn().mockRejectedValue(new TypeError("Network failed"));
    await expect(searchExerciseDb("bench")).rejects.toMatchObject({ kind: "network" });
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true, data: record }) });
    await expect(getExerciseDbDetail("different-id")).rejects.toMatchObject({ kind: "malformed" });
  });
  test("cancels an in-flight request even when a fetch implementation resolves after abort", async () => {
    const controller = new AbortController();
    globalThis.fetch = jest.fn().mockImplementation(async () => {
      controller.abort(); return { ok: true, status: 200, json: async () => ({ success: true, data: [record] }) };
    });
    await expect(searchExerciseDb("bench", controller.signal)).rejects.toMatchObject({ name: "AbortError" });
  });
});
