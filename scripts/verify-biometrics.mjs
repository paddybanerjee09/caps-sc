import assert from "node:assert/strict";

import { birthDateParts, calculateAge, formatBirthDate, isValidBirthDate } from "../src/utils/biometrics.ts";
import { deserializeAthleteProfile, serializeAthleteProfile } from "../src/utils/athleteProfile.ts";
import { centimetersToImperial, inchesToHeightCm } from "../src/utils/height.ts";
import { convertKilogramsToWeight, weightInputToKilograms } from "../src/utils/weight.ts";

const today = new Date(2026, 10, 23, 15);
assert.equal(calculateAge("2000-11-23", today), 26);
assert.equal(calculateAge("2000-11-24", today), 25);
assert.equal(calculateAge("2000-11-22", today), 26);
assert.equal(calculateAge(null, today), null);
assert.equal(calculateAge("2027-01-01", today), null);
assert.equal(calculateAge("2000-02-29", new Date(2025, 1, 28)), 24);
assert.equal(calculateAge("2000-02-29", new Date(2025, 2, 1)), 25);
assert.deepEqual(birthDateParts("2000-02-29"), { year: 2000, month: 2, day: 29 });
for (const invalid of ["2001-02-29", "2000-04-31", "2000-13-01", "2000-00-01", "2000-01-00", "2000-1-01", "", "no date"]) {
  assert.equal(birthDateParts(invalid), null, invalid);
  assert.equal(isValidBirthDate(invalid, today), false, invalid);
}
assert.equal(formatBirthDate(2000, 2, 9), "2000-02-09");
assert.equal(isValidBirthDate("2026-11-23", today), true);
assert.equal(isValidBirthDate("2026-11-24", today), false);
assert.equal(isValidBirthDate("1906-01-01", today), true);
assert.equal(isValidBirthDate("1905-12-31", today), false);

const profile = { firstName: "Test", lastName: "Athlete", age: null, dateOfBirth: "2000-11-23", sex: "Female", heightCm: 180.34, weightKg: 72.574779, sports: ["Boxing", "MMA"] };
const stored = serializeAthleteProfile(profile);
assert.equal("weightKg" in JSON.parse(stored), false);
const loaded = deserializeAthleteProfile(stored, today);
assert.equal(loaded.heightCm, 180.34);
assert.equal(loaded.dateOfBirth, "2000-11-23");
assert.equal(loaded.sex, "Female");
assert.deepEqual(loaded.sports, ["Boxing", "MMA"]);
assert.equal("weightKg" in deserializeAthleteProfile('{"weightKg":999,"sports":["MMA","unknown",7]}', today), false);
assert.deepEqual(deserializeAthleteProfile('{"age":17}', today), { age: 17 });
assert.deepEqual(deserializeAthleteProfile('{"dateOfBirth":"2026-11-24","heightCm":-2,"sex":"invalid","age":200,"sports":["MMA","unknown",7]}', today), { sports: ["MMA"] });
for (const invalid of ["null", "[]", "17", "invalid json"]) assert.throws(() => deserializeAthleteProfile(invalid, today));

assert.deepEqual(centimetersToImperial(180.34), { feet: 5, inches: 11 });
assert.deepEqual(centimetersToImperial(60), { feet: 2, inches: 0 }, "Round total inches before splitting at the minimum-height foot boundary");
assert.equal(inchesToHeightCm(5 * 12 + 11), 180.3);
assert.deepEqual(centimetersToImperial(inchesToHeightCm(6 * 12)), { feet: 6, inches: 0 });
for (const unit of ["metric", "imperial"]) {
  const original = 72.574779;
  const prefill = (Math.round(convertKilogramsToWeight(original, unit) * 10) / 10).toString();
  assert.equal(weightInputToKilograms(prefill, unit, original), original);
  assert.equal(weightInputToKilograms(prefill.replace(".", ","), unit, original), original);
  assert.notEqual(weightInputToKilograms(String(Number(prefill) + 0.1), unit, original), original);
}
assert.equal(weightInputToKilograms("75.25", "metric", null), 75.25);
for (const invalid of ["", "0", "-1", "NaN", "1e4", "12 kg"]) assert.equal(weightInputToKilograms(invalid, "metric", null), null);

console.log("Biometrics verified: DOB boundaries/leap years, profile serialization/validation and weight/height precision.");
