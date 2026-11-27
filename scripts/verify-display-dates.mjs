import assert from 'node:assert/strict';
import { formatDisplayDate, formatDisplayMonth, formatDisplayYear } from '../src/utils/displayDate.ts';
import { formatLogDay, nextLogMinute } from '../src/utils/logTime.ts';

const initialZone=process.env.TZ;
try {
  for (const zone of ['America/Toronto','Asia/Tokyo','Pacific/Honolulu']) {
    process.env.TZ=zone;
    assert.equal(formatDisplayDate('2026-11-22'),'22 Nov, 2026');
    assert.equal(formatDisplayDate('2024-02-29'),'29 Feb, 2024');
    assert.equal(formatDisplayDate('2026-03-08'),'8 Mar, 2026');
    assert.equal(formatDisplayDate(new Date(2026,10,22,12)),'22 Nov, 2026');
    assert.equal(formatDisplayMonth('2026-11'),'Nov, 2026');
    assert.equal(formatDisplayMonth('2026-11-22'),'Nov, 2026');
    assert.equal(formatDisplayYear('2026'),'2026');
    assert.equal(formatDisplayYear('2026-11-22'),'2026');
    assert.equal(formatLogDay(new Date(2026,10,22,12),new Date(2026,10,22,8)),'Today, 22 Nov, 2026');
    assert.equal(formatLogDay(new Date(2026,10,21,12),new Date(2026,10,22,8)),'21 Nov, 2026');
    assert.deepEqual(nextLogMinute(new Date(2026, 10, 22, 12, 0).getTime()), new Date(2026, 10, 22, 12, 1));
    assert.deepEqual(nextLogMinute(new Date(2026, 10, 22, 23, 59, 30).getTime()), new Date(2026, 10, 23, 0, 0));
    assert.deepEqual(nextLogMinute(new Date(2026, 10, 22, 12, 1).getTime(), 15), new Date(2026, 10, 22, 12, 15));
  }
  process.env.TZ='America/Toronto';
  assert.equal(formatDisplayDate('2026-11-22T02:00:00Z'),'21 Nov, 2026');
  process.env.TZ='Asia/Tokyo';
  assert.equal(formatDisplayDate('2026-11-22T02:00:00Z'),'22 Nov, 2026');
  for (const bad of ['2026-02-29','2026-02-30','2026-13-01','2026-00-12','2026-11-00','not a date','','2026/11/22','2026-02-30T10:00:00Z']) assert.equal(formatDisplayDate(bad),'--',bad);
  assert.equal(formatDisplayDate(new Date(NaN)),'--');
  assert.equal(formatDisplayMonth('2026-13'),'--');
  assert.equal(formatDisplayMonth('2026-00'),'--');
  assert.equal(formatDisplayYear('0000'),'--');
} finally { if(initialZone===undefined) delete process.env.TZ;else process.env.TZ=initialZone; }
console.log('Display dates preserve calendar keys, localize instants and handle month/year/DST/invalid values');
