import {
  calculateResponsiveColumnCount,
  calculateResponsiveTileSize,
} from "../responsiveGrid";

describe("responsive grid calculations", () => {
  test("clamps column count between 2 and 4", () => {
    expect(calculateResponsiveColumnCount(40, 96, 12)).toBe(2);
    expect(calculateResponsiveColumnCount(900, 96, 12)).toBe(4);
  });

  test("uses floor((availableWidth + gap) / (minimumTileWidth + gap))", () => {
    expect(calculateResponsiveColumnCount(320, 96, 12)).toBe(3);
    expect(calculateResponsiveColumnCount(319, 96, 12)).toBe(2);
  });

  test("derives square tile size from column count and gap", () => {
    expect(calculateResponsiveTileSize(320, 3, 12)).toBe(98);
    expect(calculateResponsiveTileSize(412, 4, 12)).toBe(94);
  });
});
