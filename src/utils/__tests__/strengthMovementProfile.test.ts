import { getStrengthMovementProfile } from "../strengthMovementProfile";

describe("strength movement profiles", () => {
  test("curated IDs take precedence over a conflicting name rule", () => {
    expect(getStrengthMovementProfile("verified", "box jump", { verified: "non_explosive" })).toEqual({
      movementProfile: "non_explosive", movementProfileSource: "curated-id",
    });
  });
  test.each(["power clean", "hang snatch", "push jerk", "medicine ball throw", "box jump", "kettlebell swing"])("recognizes unmistakable explosive name %s", name => {
    expect(getStrengthMovementProfile("id", name).movementProfile).toBe("explosive");
  });
  test("keeps an ambiguous exercise unknown", () => {
    expect(getStrengthMovementProfile("id", "cable crossover")).toEqual({ movementProfile: "unknown", movementProfileSource: "unknown" });
  });
});
