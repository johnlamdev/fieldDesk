import test from "node:test";
import assert from "node:assert/strict";
import { hongKongDayBounds, formatDateOnly, parseHongKongLocalDateTime, formatHongKongInput, tentativeDateFromInput } from "../src/lib/time";
test("Hong Kong day bounds distinguish timestamps from PostgreSQL DATE", () => {
  const b = hongKongDayBounds(new Date("2026-10-04T03:00:00Z"));
  assert.equal(b.start.toISOString(), "2026-10-03T16:00:00.000Z");
  assert.equal(b.dateStart.toISOString(), "2026-10-04T00:00:00.000Z");
  assert.equal(b.dateEnd.toISOString(), "2026-10-05T00:00:00.000Z");
  assert.match(formatDateOnly(new Date("2026-10-04T00:00:00Z")), /4/);
});
test("planned visit time is stored in Hong Kong local time with its calendar date", () => {
  const input = "2026-10-04T14:30";
  const timestamp = parseHongKongLocalDateTime(input);
  assert.equal(timestamp?.toISOString(), "2026-10-04T06:30:00.000Z");
  assert.equal(formatHongKongInput(timestamp), input);
  assert.equal(tentativeDateFromInput(input)?.toISOString(), "2026-10-04T00:00:00.000Z");
  assert.throws(() => parseHongKongLocalDateTime("2026-02-30T14:30"), /日期時間無效/);
});
