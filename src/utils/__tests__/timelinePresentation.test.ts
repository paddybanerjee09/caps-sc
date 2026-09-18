import { appColorPalette } from "../../theme/theme";
import {
  getConditioningMonthPresentation,
  getDayTimelinePresentation,
  getStrengthMonthPresentation,
} from "../timelinePresentation";

describe("timelinePresentation", () => {
  test("day timeline uses log-type colors only", () => {
    expect(getDayTimelinePresentation("strength").color).toBe(appColorPalette.red);
    expect(getDayTimelinePresentation("conditioning").color).toBe(appColorPalette.yellow);
  });

  test("month resolvers keep adaptation colors with fallbacks", () => {
    expect(getStrengthMonthPresentation("power").color).toBe(appColorPalette.orange);
    expect(getStrengthMonthPresentation("unknown").color).toBe(appColorPalette.red);
    expect(getConditioningMonthPresentation("aerobic_base").color).toBe(appColorPalette.green);
    expect(getConditioningMonthPresentation("unknown").color).toBe(appColorPalette.yellow);
  });
});
