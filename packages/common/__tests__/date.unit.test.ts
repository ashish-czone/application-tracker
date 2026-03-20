import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  todayInTimezone,
  nowInTimezone,
  localHourToUtcHour,
  cronForLocalHour,
  startOfDayInTimezone,
  endOfDayInTimezone,
} from '../date';

// ---------------------------------------------------------------------------
// Helper: freeze `new Date()` to a known instant so time-dependent functions
// return deterministic results. Restored after each test.
// ---------------------------------------------------------------------------
function freezeTime(isoUtc: string) {
  const frozen = new Date(isoUtc);
  vi.useFakeTimers({ now: frozen });
  return frozen;
}

afterEach(() => {
  vi.useRealTimers();
});

// ===========================================================================
// todayInTimezone
// ===========================================================================
describe('todayInTimezone', () => {
  describe('basic timezone conversions', () => {
    it('returns the correct date for a UTC+ timezone (Asia/Dubai, UTC+4)', () => {
      // 2026-03-17 23:30 UTC => 2026-03-18 03:30 in Dubai
      freezeTime('2026-03-17T23:30:00.000Z');
      expect(todayInTimezone('Asia/Dubai')).toBe('2026-03-18');
    });

    it('returns the correct date for a UTC- timezone (America/New_York, EDT)', () => {
      // 2026-03-18 02:00 UTC => 2026-03-17 22:00 in New York (EDT, UTC-4)
      freezeTime('2026-03-18T02:00:00.000Z');
      expect(todayInTimezone('America/New_York')).toBe('2026-03-17');
    });

    it('returns UTC date when timezone is UTC', () => {
      freezeTime('2026-06-15T12:00:00.000Z');
      expect(todayInTimezone('UTC')).toBe('2026-06-15');
    });

    it('returns UTC date at exact midnight UTC', () => {
      freezeTime('2026-06-15T00:00:00.000Z');
      expect(todayInTimezone('UTC')).toBe('2026-06-15');
    });
  });

  describe('midnight boundaries', () => {
    it('just before midnight local time stays on current day', () => {
      // 2026-07-01 03:59 UTC => 2026-07-01 07:59 Dubai (still July 1)
      freezeTime('2026-07-01T03:59:00.000Z');
      expect(todayInTimezone('Asia/Dubai')).toBe('2026-07-01');
    });

    it('exactly at midnight local time rolls to next day', () => {
      // 2026-07-01 20:00 UTC => 2026-07-02 00:00 Dubai
      freezeTime('2026-07-01T20:00:00.000Z');
      expect(todayInTimezone('Asia/Dubai')).toBe('2026-07-02');
    });

    it('one second after midnight local time is on new day', () => {
      // 2026-07-01 20:00:01 UTC => 2026-07-02 00:00:01 Dubai
      freezeTime('2026-07-01T20:00:01.000Z');
      expect(todayInTimezone('Asia/Dubai')).toBe('2026-07-02');
    });
  });

  describe('date rollovers across years and months', () => {
    it('handles year rollover in positive-offset timezone (Dec 31 UTC -> Jan 1 local)', () => {
      // 2026-12-31 20:00 UTC => 2027-01-01 00:00 Dubai
      freezeTime('2026-12-31T20:00:00.000Z');
      expect(todayInTimezone('Asia/Dubai')).toBe('2027-01-01');
    });

    it('handles year rollover in negative-offset timezone (Jan 1 UTC -> Dec 31 local)', () => {
      // 2026-01-01 04:00 UTC => 2025-12-31 20:00 Los Angeles (PST, UTC-8)
      freezeTime('2026-01-01T04:00:00.000Z');
      expect(todayInTimezone('America/Los_Angeles')).toBe('2025-12-31');
    });

    it('handles month boundary (Jan 31 -> Feb 1 in positive-offset tz)', () => {
      // 2026-01-31 20:00 UTC => 2026-02-01 00:00 Dubai
      freezeTime('2026-01-31T20:00:00.000Z');
      expect(todayInTimezone('Asia/Dubai')).toBe('2026-02-01');
    });

    it('handles Feb 28 -> Mar 1 in non-leap year', () => {
      // 2027 is not a leap year
      // 2027-02-28 20:00 UTC => 2027-03-01 00:00 Dubai
      freezeTime('2027-02-28T20:00:00.000Z');
      expect(todayInTimezone('Asia/Dubai')).toBe('2027-03-01');
    });

    it('handles Feb 28 -> Feb 29 in leap year', () => {
      // 2028 is a leap year
      // 2028-02-28 20:00 UTC => 2028-02-29 00:00 Dubai
      freezeTime('2028-02-28T20:00:00.000Z');
      expect(todayInTimezone('Asia/Dubai')).toBe('2028-02-29');
    });

    it('handles Feb 29 in leap year correctly', () => {
      // 2028 is a leap year
      // 2028-02-29 12:00 UTC => 2028-02-29 16:00 Dubai
      freezeTime('2028-02-29T12:00:00.000Z');
      expect(todayInTimezone('Asia/Dubai')).toBe('2028-02-29');
    });
  });

  describe('extreme and unusual timezones', () => {
    it('works for UTC+13 (Pacific/Tongatapu)', () => {
      // 2026-08-10 10:00 UTC => 2026-08-10 23:00 Tongatapu
      freezeTime('2026-08-10T10:00:00.000Z');
      expect(todayInTimezone('Pacific/Tongatapu')).toBe('2026-08-10');
    });

    it('works for UTC+13 rolling to next day', () => {
      // 2026-08-10 12:00 UTC => 2026-08-11 01:00 Tongatapu
      freezeTime('2026-08-10T12:00:00.000Z');
      expect(todayInTimezone('Pacific/Tongatapu')).toBe('2026-08-11');
    });

    it('works for UTC+14 (Pacific/Kiritimati, Line Islands)', () => {
      // 2026-06-15 09:00 UTC => 2026-06-15 23:00 Kiritimati
      freezeTime('2026-06-15T09:00:00.000Z');
      expect(todayInTimezone('Pacific/Kiritimati')).toBe('2026-06-15');
    });

    it('works for UTC+14 rolling to next day', () => {
      // 2026-06-15 11:00 UTC => 2026-06-16 01:00 Kiritimati
      freezeTime('2026-06-15T11:00:00.000Z');
      expect(todayInTimezone('Pacific/Kiritimati')).toBe('2026-06-16');
    });

    it('works for half-hour offset (Asia/Kolkata, UTC+5:30)', () => {
      // 2026-03-17 18:29 UTC => 2026-03-17 23:59 Kolkata
      freezeTime('2026-03-17T18:29:00.000Z');
      expect(todayInTimezone('Asia/Kolkata')).toBe('2026-03-17');
    });

    it('works for half-hour offset rolling to next day', () => {
      // 2026-03-17 18:30 UTC => 2026-03-18 00:00 Kolkata
      freezeTime('2026-03-17T18:30:00.000Z');
      expect(todayInTimezone('Asia/Kolkata')).toBe('2026-03-18');
    });

    it('works for 45-minute offset (Asia/Kathmandu, UTC+5:45)', () => {
      // 2026-03-17 18:14 UTC => 2026-03-17 23:59 Kathmandu
      freezeTime('2026-03-17T18:14:00.000Z');
      expect(todayInTimezone('Asia/Kathmandu')).toBe('2026-03-17');
    });

    it('works for 45-minute offset rolling to next day', () => {
      // 2026-03-17 18:15 UTC => 2026-03-18 00:00 Kathmandu
      freezeTime('2026-03-17T18:15:00.000Z');
      expect(todayInTimezone('Asia/Kathmandu')).toBe('2026-03-18');
    });
  });

  describe('format consistency', () => {
    it('always returns YYYY-MM-DD format with zero-padded months and days', () => {
      freezeTime('2026-01-05T12:00:00.000Z');
      const result = todayInTimezone('UTC');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result).toBe('2026-01-05');
    });
  });
});

// ===========================================================================
// nowInTimezone
// ===========================================================================
describe('nowInTimezone', () => {
  describe('default format', () => {
    it('returns yyyy-MM-dd HH:mm:ss by default', () => {
      freezeTime('2026-03-17T14:30:45.000Z');
      // Dubai UTC+4 => 18:30:45
      expect(nowInTimezone('Asia/Dubai')).toBe('2026-03-17 18:30:45');
    });

    it('returns correct default format for UTC', () => {
      freezeTime('2026-05-20T08:15:30.000Z');
      expect(nowInTimezone('UTC')).toBe('2026-05-20 08:15:30');
    });

    it('zero-pads hours, minutes, seconds in default format', () => {
      freezeTime('2026-01-05T01:02:03.000Z');
      expect(nowInTimezone('UTC')).toBe('2026-01-05 01:02:03');
    });
  });

  describe('custom format strings', () => {
    it('accepts HH:mm format', () => {
      freezeTime('2026-03-17T14:30:45.000Z');
      expect(nowInTimezone('Asia/Dubai', 'HH:mm')).toBe('18:30');
    });

    it('accepts date-only format', () => {
      freezeTime('2026-06-15T22:00:00.000Z');
      // London BST (UTC+1) => 23:00
      expect(nowInTimezone('Europe/London', 'yyyy-MM-dd')).toBe('2026-06-15');
    });

    it('accepts ISO-like format with T separator', () => {
      freezeTime('2026-03-17T14:30:45.000Z');
      const result = nowInTimezone('UTC', "yyyy-MM-dd'T'HH:mm:ss");
      expect(result).toBe('2026-03-17T14:30:45');
    });

    it('accepts format with day name', () => {
      freezeTime('2026-03-17T14:30:45.000Z');
      // March 17, 2026 is a Tuesday
      const result = nowInTimezone('UTC', 'EEEE');
      expect(result).toBe('Tuesday');
    });

    it('accepts hour-only format', () => {
      freezeTime('2026-03-17T14:00:00.000Z');
      expect(nowInTimezone('Asia/Dubai', 'HH')).toBe('18');
    });
  });

  describe('timezone offset handling', () => {
    it('handles date rollover in formatted output', () => {
      // 2026-12-31 23:30 UTC => 2027-01-01 03:30 Dubai
      freezeTime('2026-12-31T23:30:00.000Z');
      expect(nowInTimezone('Asia/Dubai')).toBe('2027-01-01 03:30:00');
    });

    it('handles half-hour offset (India, UTC+5:30)', () => {
      freezeTime('2026-03-17T18:00:00.000Z');
      expect(nowInTimezone('Asia/Kolkata', 'HH:mm')).toBe('23:30');
    });

    it('handles 45-minute offset (Nepal, UTC+5:45)', () => {
      freezeTime('2026-03-17T18:00:00.000Z');
      expect(nowInTimezone('Asia/Kathmandu', 'HH:mm')).toBe('23:45');
    });

    it('handles negative offset timezone (America/Chicago, CDT)', () => {
      // July: CDT = UTC-5
      freezeTime('2026-07-15T17:00:00.000Z');
      expect(nowInTimezone('America/Chicago', 'HH:mm')).toBe('12:00');
    });

    it('handles UTC+14 (Pacific/Kiritimati)', () => {
      freezeTime('2026-06-15T05:30:00.000Z');
      // UTC+14 => 19:30
      expect(nowInTimezone('Pacific/Kiritimati', 'HH:mm')).toBe('19:30');
    });
  });

  describe('DST transitions', () => {
    it('handles US spring-forward — March 8 EDT (UTC-4)', () => {
      // After spring-forward, NY is EDT (UTC-4)
      freezeTime('2026-03-08T18:00:00.000Z');
      expect(nowInTimezone('America/New_York', 'HH:mm')).toBe('14:00');
    });

    it('handles US fall-back — November in EST (UTC-5)', () => {
      freezeTime('2026-11-15T18:00:00.000Z');
      expect(nowInTimezone('America/New_York', 'HH:mm')).toBe('13:00');
    });

    it('handles European summer time (London BST, UTC+1)', () => {
      freezeTime('2026-07-15T12:00:00.000Z');
      expect(nowInTimezone('Europe/London', 'HH:mm')).toBe('13:00');
    });

    it('handles European winter time (London GMT, UTC+0)', () => {
      freezeTime('2026-01-15T12:00:00.000Z');
      expect(nowInTimezone('Europe/London', 'HH:mm')).toBe('12:00');
    });
  });

  describe('midnight and boundary times', () => {
    it('formats exactly midnight correctly', () => {
      freezeTime('2026-03-17T20:00:00.000Z');
      // Dubai: 2026-03-18 00:00:00
      expect(nowInTimezone('Asia/Dubai')).toBe('2026-03-18 00:00:00');
    });

    it('formats just before midnight correctly', () => {
      freezeTime('2026-03-17T19:59:59.000Z');
      // Dubai: 2026-03-17 23:59:59
      expect(nowInTimezone('Asia/Dubai')).toBe('2026-03-17 23:59:59');
    });
  });
});

// ===========================================================================
// localHourToUtcHour
// ===========================================================================
describe('localHourToUtcHour', () => {
  describe('basic conversions', () => {
    it('converts Dubai 2 AM to UTC 22 (previous day)', () => {
      freezeTime('2026-03-17T12:00:00.000Z');
      expect(localHourToUtcHour(2, 'Asia/Dubai')).toBe(22);
    });

    it('converts Dubai midnight (hour 0) to UTC 20', () => {
      freezeTime('2026-03-17T12:00:00.000Z');
      expect(localHourToUtcHour(0, 'Asia/Dubai')).toBe(20);
    });

    it('converts Dubai noon (hour 12) to UTC 8', () => {
      freezeTime('2026-03-17T12:00:00.000Z');
      expect(localHourToUtcHour(12, 'Asia/Dubai')).toBe(8);
    });

    it('converts Dubai hour 23 to UTC 19', () => {
      freezeTime('2026-03-17T12:00:00.000Z');
      expect(localHourToUtcHour(23, 'Asia/Dubai')).toBe(19);
    });

    it('returns same hour for UTC timezone', () => {
      freezeTime('2026-03-17T12:00:00.000Z');
      expect(localHourToUtcHour(14, 'UTC')).toBe(14);
    });

    it('returns hour 0 for UTC when input is 0', () => {
      freezeTime('2026-03-17T12:00:00.000Z');
      expect(localHourToUtcHour(0, 'UTC')).toBe(0);
    });

    it('returns hour 23 for UTC when input is 23', () => {
      freezeTime('2026-03-17T12:00:00.000Z');
      expect(localHourToUtcHour(23, 'UTC')).toBe(23);
    });
  });

  describe('negative-offset timezones', () => {
    it('converts New York EDT 10 AM to UTC 14', () => {
      // March 2026 is EDT (UTC-4)
      freezeTime('2026-03-17T12:00:00.000Z');
      expect(localHourToUtcHour(10, 'America/New_York')).toBe(14);
    });

    it('converts Los Angeles PDT 6 AM to UTC 13', () => {
      // July: PDT (UTC-7)
      freezeTime('2026-07-15T12:00:00.000Z');
      expect(localHourToUtcHour(6, 'America/Los_Angeles')).toBe(13);
    });

    it('converts Los Angeles PST 6 AM to UTC 14', () => {
      // January: PST (UTC-8)
      freezeTime('2026-01-15T12:00:00.000Z');
      expect(localHourToUtcHour(6, 'America/Los_Angeles')).toBe(14);
    });

    it('converts Chicago CDT midnight to UTC 5', () => {
      // July: CDT (UTC-5)
      freezeTime('2026-07-15T12:00:00.000Z');
      expect(localHourToUtcHour(0, 'America/Chicago')).toBe(5);
    });
  });

  describe('large positive-offset timezones', () => {
    it('converts Tokyo (UTC+9) 3 AM to UTC 18 (previous day)', () => {
      freezeTime('2026-03-17T12:00:00.000Z');
      expect(localHourToUtcHour(3, 'Asia/Tokyo')).toBe(18);
    });

    it('converts Tokyo noon to UTC 3', () => {
      freezeTime('2026-03-17T12:00:00.000Z');
      expect(localHourToUtcHour(12, 'Asia/Tokyo')).toBe(3);
    });

    it('converts Tongatapu (UTC+13) midnight to UTC 11 (previous day)', () => {
      freezeTime('2026-06-15T12:00:00.000Z');
      expect(localHourToUtcHour(0, 'Pacific/Tongatapu')).toBe(11);
    });
  });

  describe('DST transitions', () => {
    it('US Eastern Standard Time (winter): 8 AM local => UTC 13', () => {
      freezeTime('2026-01-15T12:00:00.000Z');
      expect(localHourToUtcHour(8, 'America/New_York')).toBe(13);
    });

    it('US Eastern Daylight Time (summer): 8 AM local => UTC 12', () => {
      freezeTime('2026-07-15T12:00:00.000Z');
      expect(localHourToUtcHour(8, 'America/New_York')).toBe(12);
    });

    it('London BST (summer): 6 AM local => UTC 5', () => {
      freezeTime('2026-07-15T12:00:00.000Z');
      expect(localHourToUtcHour(6, 'Europe/London')).toBe(5);
    });

    it('London GMT (winter): 6 AM local => UTC 6', () => {
      freezeTime('2026-01-15T12:00:00.000Z');
      expect(localHourToUtcHour(6, 'Europe/London')).toBe(6);
    });

    it('Australia/Sydney AEDT (summer): 8 AM => UTC 21 (previous day)', () => {
      // January: AEDT (UTC+11)
      freezeTime('2026-01-15T12:00:00.000Z');
      expect(localHourToUtcHour(8, 'Australia/Sydney')).toBe(21);
    });

    it('Australia/Sydney AEST (winter): 8 AM => UTC 22 (previous day)', () => {
      // July: AEST (UTC+10)
      freezeTime('2026-07-15T12:00:00.000Z');
      expect(localHourToUtcHour(8, 'Australia/Sydney')).toBe(22);
    });

    it('Europe/Berlin CEST (summer): 14:00 local => UTC 12', () => {
      // July: CEST (UTC+2)
      freezeTime('2026-07-15T12:00:00.000Z');
      expect(localHourToUtcHour(14, 'Europe/Berlin')).toBe(12);
    });

    it('Europe/Berlin CET (winter): 14:00 local => UTC 13', () => {
      // January: CET (UTC+1)
      freezeTime('2026-01-15T12:00:00.000Z');
      expect(localHourToUtcHour(14, 'Europe/Berlin')).toBe(13);
    });
  });

  describe('non-DST timezones remain stable year-round', () => {
    it('Dubai returns same UTC hour in January and July', () => {
      freezeTime('2026-01-15T12:00:00.000Z');
      const winter = localHourToUtcHour(10, 'Asia/Dubai');

      vi.useRealTimers();
      freezeTime('2026-07-15T12:00:00.000Z');
      const summer = localHourToUtcHour(10, 'Asia/Dubai');

      expect(winter).toBe(summer);
    });

    it('Tokyo returns same UTC hour in January and July', () => {
      freezeTime('2026-01-15T12:00:00.000Z');
      const winter = localHourToUtcHour(10, 'Asia/Tokyo');

      vi.useRealTimers();
      freezeTime('2026-07-15T12:00:00.000Z');
      const summer = localHourToUtcHour(10, 'Asia/Tokyo');

      expect(winter).toBe(summer);
    });
  });

  describe('all 24 hours for a fixed timezone', () => {
    it('maps every local hour to valid UTC range [0..23] for Dubai', () => {
      freezeTime('2026-06-15T12:00:00.000Z');
      for (let h = 0; h < 24; h++) {
        const utc = localHourToUtcHour(h, 'Asia/Dubai');
        expect(utc).toBeGreaterThanOrEqual(0);
        expect(utc).toBeLessThan(24);
      }
    });

    it('maps every local hour to valid UTC range [0..23] for New York (EDT)', () => {
      freezeTime('2026-07-15T12:00:00.000Z');
      for (let h = 0; h < 24; h++) {
        const utc = localHourToUtcHour(h, 'America/New_York');
        expect(utc).toBeGreaterThanOrEqual(0);
        expect(utc).toBeLessThan(24);
      }
    });
  });
});

// ===========================================================================
// cronForLocalHour
// ===========================================================================
describe('cronForLocalHour', () => {
  describe('basic patterns', () => {
    it('returns correct cron for Dubai 2 AM', () => {
      freezeTime('2026-03-17T12:00:00.000Z');
      expect(cronForLocalHour(2, 'Asia/Dubai')).toBe('0 22 * * *');
    });

    it('returns correct cron for midnight UTC', () => {
      freezeTime('2026-03-17T12:00:00.000Z');
      expect(cronForLocalHour(0, 'UTC')).toBe('0 0 * * *');
    });

    it('returns correct cron for hour 23 UTC', () => {
      freezeTime('2026-03-17T12:00:00.000Z');
      expect(cronForLocalHour(23, 'UTC')).toBe('0 23 * * *');
    });

    it('returns correct cron for Tokyo 23:00', () => {
      freezeTime('2026-03-17T12:00:00.000Z');
      expect(cronForLocalHour(23, 'Asia/Tokyo')).toBe('0 14 * * *');
    });
  });

  describe('DST-affected patterns', () => {
    it('New York 9 AM in summer (EDT, UTC-4) => 0 13 * * *', () => {
      freezeTime('2026-07-15T12:00:00.000Z');
      expect(cronForLocalHour(9, 'America/New_York')).toBe('0 13 * * *');
    });

    it('New York 9 AM in winter (EST, UTC-5) => 0 14 * * *', () => {
      freezeTime('2026-01-15T12:00:00.000Z');
      expect(cronForLocalHour(9, 'America/New_York')).toBe('0 14 * * *');
    });

    it('London 8 AM in summer (BST, UTC+1) => 0 7 * * *', () => {
      freezeTime('2026-07-15T12:00:00.000Z');
      expect(cronForLocalHour(8, 'Europe/London')).toBe('0 7 * * *');
    });

    it('London 8 AM in winter (GMT, UTC+0) => 0 8 * * *', () => {
      freezeTime('2026-01-15T12:00:00.000Z');
      expect(cronForLocalHour(8, 'Europe/London')).toBe('0 8 * * *');
    });
  });

  describe('output format validation', () => {
    it('always starts with minute 0', () => {
      freezeTime('2026-03-17T12:00:00.000Z');
      const result = cronForLocalHour(15, 'Asia/Dubai');
      expect(result.startsWith('0 ')).toBe(true);
    });

    it('matches daily cron pattern: 0 H * * *', () => {
      freezeTime('2026-03-17T12:00:00.000Z');
      const result = cronForLocalHour(15, 'Asia/Dubai');
      expect(result).toMatch(/^0 \d{1,2} \* \* \*$/);
    });

    it('UTC hour is a valid integer between 0 and 23', () => {
      freezeTime('2026-03-17T12:00:00.000Z');
      for (let h = 0; h < 24; h++) {
        const result = cronForLocalHour(h, 'Asia/Dubai');
        const parts = result.split(' ');
        const utcHour = parseInt(parts[1], 10);
        expect(utcHour).toBeGreaterThanOrEqual(0);
        expect(utcHour).toBeLessThan(24);
      }
    });
  });

  describe('consistency with localHourToUtcHour', () => {
    it('cron hour matches localHourToUtcHour for all hours in Dubai', () => {
      freezeTime('2026-03-17T12:00:00.000Z');
      for (let h = 0; h < 24; h++) {
        const utcHour = localHourToUtcHour(h, 'Asia/Dubai');
        const cron = cronForLocalHour(h, 'Asia/Dubai');
        expect(cron).toBe(`0 ${utcHour} * * *`);
      }
    });
  });
});

// ===========================================================================
// startOfDayInTimezone
// ===========================================================================
describe('startOfDayInTimezone', () => {
  describe('basic conversions', () => {
    it('returns UTC equivalent of midnight in Dubai (UTC+4)', () => {
      const result = startOfDayInTimezone('2026-03-17', 'Asia/Dubai');
      expect(result.toISOString()).toBe('2026-03-16T20:00:00.000Z');
    });

    it('returns UTC equivalent of midnight in New York (EDT, UTC-4)', () => {
      const result = startOfDayInTimezone('2026-07-15', 'America/New_York');
      expect(result.toISOString()).toBe('2026-07-15T04:00:00.000Z');
    });

    it('returns UTC equivalent of midnight in New York (EST, UTC-5)', () => {
      const result = startOfDayInTimezone('2026-01-15', 'America/New_York');
      expect(result.toISOString()).toBe('2026-01-15T05:00:00.000Z');
    });

    it('returns same instant for UTC timezone', () => {
      const result = startOfDayInTimezone('2026-03-17', 'UTC');
      expect(result.toISOString()).toBe('2026-03-17T00:00:00.000Z');
    });

    it('returns a Date object', () => {
      const result = startOfDayInTimezone('2026-03-17', 'Asia/Dubai');
      expect(result).toBeInstanceOf(Date);
    });
  });

  describe('various timezone offsets', () => {
    it('handles Tokyo (UTC+9)', () => {
      const result = startOfDayInTimezone('2026-06-15', 'Asia/Tokyo');
      expect(result.toISOString()).toBe('2026-06-14T15:00:00.000Z');
    });

    it('handles Kolkata (UTC+5:30)', () => {
      const result = startOfDayInTimezone('2026-03-17', 'Asia/Kolkata');
      expect(result.toISOString()).toBe('2026-03-16T18:30:00.000Z');
    });

    it('handles Kathmandu (UTC+5:45)', () => {
      const result = startOfDayInTimezone('2026-03-17', 'Asia/Kathmandu');
      expect(result.toISOString()).toBe('2026-03-16T18:15:00.000Z');
    });

    it('handles Los Angeles PST (UTC-8)', () => {
      const result = startOfDayInTimezone('2026-01-15', 'America/Los_Angeles');
      expect(result.toISOString()).toBe('2026-01-15T08:00:00.000Z');
    });

    it('handles Los Angeles PDT (UTC-7)', () => {
      const result = startOfDayInTimezone('2026-07-15', 'America/Los_Angeles');
      expect(result.toISOString()).toBe('2026-07-15T07:00:00.000Z');
    });

    it('handles Tongatapu (UTC+13)', () => {
      const result = startOfDayInTimezone('2026-06-15', 'Pacific/Tongatapu');
      expect(result.toISOString()).toBe('2026-06-14T11:00:00.000Z');
    });

    it('handles Kiritimati (UTC+14)', () => {
      const result = startOfDayInTimezone('2026-06-15', 'Pacific/Kiritimati');
      expect(result.toISOString()).toBe('2026-06-14T10:00:00.000Z');
    });
  });

  describe('date boundary crossings', () => {
    it('handles year boundary — Jan 1 in positive-offset timezone', () => {
      const result = startOfDayInTimezone('2027-01-01', 'Asia/Dubai');
      expect(result.toISOString()).toBe('2026-12-31T20:00:00.000Z');
    });

    it('handles year boundary — Jan 1 in negative-offset timezone', () => {
      const result = startOfDayInTimezone('2026-01-01', 'America/Los_Angeles');
      // PST: midnight Jan 1 LA = 08:00 UTC Jan 1
      expect(result.toISOString()).toBe('2026-01-01T08:00:00.000Z');
    });

    it('handles month boundary — Feb 1', () => {
      const result = startOfDayInTimezone('2026-02-01', 'Asia/Dubai');
      expect(result.toISOString()).toBe('2026-01-31T20:00:00.000Z');
    });

    it('handles leap year — Feb 29', () => {
      const result = startOfDayInTimezone('2028-02-29', 'Asia/Dubai');
      expect(result.toISOString()).toBe('2028-02-28T20:00:00.000Z');
    });

    it('handles March 1 in non-leap year', () => {
      const result = startOfDayInTimezone('2027-03-01', 'Asia/Dubai');
      expect(result.toISOString()).toBe('2027-02-28T20:00:00.000Z');
    });

    it('handles March 1 in leap year', () => {
      const result = startOfDayInTimezone('2028-03-01', 'Asia/Dubai');
      expect(result.toISOString()).toBe('2028-02-29T20:00:00.000Z');
    });
  });

  describe('DST transitions', () => {
    it('handles US spring-forward date (March 8, 2026)', () => {
      // At midnight March 8, EST is still in effect
      const result = startOfDayInTimezone('2026-03-08', 'America/New_York');
      expect(result.toISOString()).toBe('2026-03-08T05:00:00.000Z');
    });

    it('handles US fall-back date (Nov 1, 2026)', () => {
      // At midnight Nov 1, EDT is still in effect
      const result = startOfDayInTimezone('2026-11-01', 'America/New_York');
      expect(result.toISOString()).toBe('2026-11-01T04:00:00.000Z');
    });

    it('handles day after US spring-forward (March 9, 2026)', () => {
      // After spring-forward, EDT is in effect (UTC-4)
      const result = startOfDayInTimezone('2026-03-09', 'America/New_York');
      expect(result.toISOString()).toBe('2026-03-09T04:00:00.000Z');
    });

    it('handles day after US fall-back (Nov 2, 2026)', () => {
      // After fall-back, EST is in effect (UTC-5)
      const result = startOfDayInTimezone('2026-11-02', 'America/New_York');
      expect(result.toISOString()).toBe('2026-11-02T05:00:00.000Z');
    });

    it('handles European spring-forward (March 29, 2026 in Berlin)', () => {
      // Before spring-forward: CET (UTC+1)
      const result = startOfDayInTimezone('2026-03-29', 'Europe/Berlin');
      expect(result.toISOString()).toBe('2026-03-28T23:00:00.000Z');
    });

    it('handles day after European spring-forward (March 30, 2026 in Berlin)', () => {
      // After spring-forward: CEST (UTC+2)
      const result = startOfDayInTimezone('2026-03-30', 'Europe/Berlin');
      expect(result.toISOString()).toBe('2026-03-29T22:00:00.000Z');
    });
  });

  describe('consecutive days', () => {
    it('consecutive days in non-DST timezone are 24h apart', () => {
      const day1 = startOfDayInTimezone('2026-03-17', 'Asia/Dubai');
      const day2 = startOfDayInTimezone('2026-03-18', 'Asia/Dubai');
      expect(day2.getTime() - day1.getTime()).toBe(24 * 60 * 60 * 1000);
    });

    it('consecutive days in UTC are 24h apart', () => {
      const day1 = startOfDayInTimezone('2026-06-15', 'UTC');
      const day2 = startOfDayInTimezone('2026-06-16', 'UTC');
      expect(day2.getTime() - day1.getTime()).toBe(24 * 60 * 60 * 1000);
    });
  });
});

// ===========================================================================
// endOfDayInTimezone
// ===========================================================================
describe('endOfDayInTimezone', () => {
  describe('basic conversions', () => {
    it('returns UTC equivalent of midnight next day in Dubai (UTC+4)', () => {
      const result = endOfDayInTimezone('2026-03-17', 'Asia/Dubai');
      expect(result.toISOString()).toBe('2026-03-17T20:00:00.000Z');
    });

    it('returns UTC equivalent of midnight next day in New York (EDT)', () => {
      const result = endOfDayInTimezone('2026-07-15', 'America/New_York');
      expect(result.toISOString()).toBe('2026-07-16T04:00:00.000Z');
    });

    it('returns midnight next day for UTC timezone', () => {
      const result = endOfDayInTimezone('2026-03-17', 'UTC');
      expect(result.toISOString()).toBe('2026-03-18T00:00:00.000Z');
    });

    it('returns a Date object', () => {
      const result = endOfDayInTimezone('2026-03-17', 'Asia/Dubai');
      expect(result).toBeInstanceOf(Date);
    });
  });

  describe('24-hour difference from startOfDayInTimezone', () => {
    it('is exactly 24h after start for non-DST timezone (Dubai)', () => {
      const start = startOfDayInTimezone('2026-03-17', 'Asia/Dubai');
      const end = endOfDayInTimezone('2026-03-17', 'Asia/Dubai');
      expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
    });

    it('is exactly 24h after start for UTC', () => {
      const start = startOfDayInTimezone('2026-06-15', 'UTC');
      const end = endOfDayInTimezone('2026-06-15', 'UTC');
      expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
    });

    it('is exactly 24h after start for DST timezone on spring-forward day', () => {
      // addDays adds 24h in UTC regardless of DST
      const start = startOfDayInTimezone('2026-03-08', 'America/New_York');
      const end = endOfDayInTimezone('2026-03-08', 'America/New_York');
      expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
    });

    it('is exactly 24h after start for DST timezone on fall-back day', () => {
      const start = startOfDayInTimezone('2026-11-01', 'America/New_York');
      const end = endOfDayInTimezone('2026-11-01', 'America/New_York');
      expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
    });
  });

  describe('various timezone offsets', () => {
    it('handles Kolkata (UTC+5:30)', () => {
      const result = endOfDayInTimezone('2026-03-17', 'Asia/Kolkata');
      expect(result.toISOString()).toBe('2026-03-17T18:30:00.000Z');
    });

    it('handles Tokyo (UTC+9)', () => {
      const result = endOfDayInTimezone('2026-06-15', 'Asia/Tokyo');
      expect(result.toISOString()).toBe('2026-06-15T15:00:00.000Z');
    });

    it('handles Los Angeles PST (UTC-8)', () => {
      const result = endOfDayInTimezone('2026-01-15', 'America/Los_Angeles');
      // Midnight Jan 16 LA PST = 08:00 UTC Jan 16
      expect(result.toISOString()).toBe('2026-01-16T08:00:00.000Z');
    });

    it('handles Kathmandu (UTC+5:45)', () => {
      const result = endOfDayInTimezone('2026-03-17', 'Asia/Kathmandu');
      // Midnight March 18 Kathmandu = March 17 18:15 UTC
      expect(result.toISOString()).toBe('2026-03-17T18:15:00.000Z');
    });
  });

  describe('date boundary crossings', () => {
    it('handles year boundary — Dec 31 in UTC', () => {
      const result = endOfDayInTimezone('2026-12-31', 'UTC');
      expect(result.toISOString()).toBe('2027-01-01T00:00:00.000Z');
    });

    it('handles year boundary — Dec 31 in Dubai', () => {
      const result = endOfDayInTimezone('2026-12-31', 'Asia/Dubai');
      expect(result.toISOString()).toBe('2026-12-31T20:00:00.000Z');
    });

    it('handles leap year — Feb 29 end', () => {
      const result = endOfDayInTimezone('2028-02-29', 'UTC');
      expect(result.toISOString()).toBe('2028-03-01T00:00:00.000Z');
    });

    it('handles end of Feb in non-leap year', () => {
      const result = endOfDayInTimezone('2027-02-28', 'UTC');
      expect(result.toISOString()).toBe('2027-03-01T00:00:00.000Z');
    });
  });

  describe('non-overlapping ranges', () => {
    it('end of day N equals start of day N+1', () => {
      const endDay1 = endOfDayInTimezone('2026-03-17', 'Asia/Dubai');
      const startDay2 = startOfDayInTimezone('2026-03-18', 'Asia/Dubai');
      expect(endDay1.getTime()).toBe(startDay2.getTime());
    });

    it('end of day N equals start of day N+1 for UTC', () => {
      const endDay1 = endOfDayInTimezone('2026-03-17', 'UTC');
      const startDay2 = startOfDayInTimezone('2026-03-18', 'UTC');
      expect(endDay1.getTime()).toBe(startDay2.getTime());
    });

    it('end of day N equals start of day N+1 for negative-offset timezone', () => {
      const endDay1 = endOfDayInTimezone('2026-07-15', 'America/New_York');
      const startDay2 = startOfDayInTimezone('2026-07-16', 'America/New_York');
      expect(endDay1.getTime()).toBe(startDay2.getTime());
    });

    it('end of day equals start of next day across year boundary', () => {
      const endDec31 = endOfDayInTimezone('2026-12-31', 'Asia/Dubai');
      const startJan1 = startOfDayInTimezone('2027-01-01', 'Asia/Dubai');
      expect(endDec31.getTime()).toBe(startJan1.getTime());
    });

    it('end of day equals start of next day across month boundary', () => {
      const endJan31 = endOfDayInTimezone('2026-01-31', 'Asia/Dubai');
      const startFeb1 = startOfDayInTimezone('2026-02-01', 'Asia/Dubai');
      expect(endJan31.getTime()).toBe(startFeb1.getTime());
    });
  });
});

// ===========================================================================
// Cross-function consistency
// ===========================================================================
describe('cross-function consistency', () => {
  it('todayInTimezone matches the date portion of nowInTimezone', () => {
    freezeTime('2026-03-17T22:00:00.000Z');
    const today = todayInTimezone('Asia/Dubai');
    const now = nowInTimezone('Asia/Dubai', 'yyyy-MM-dd');
    expect(today).toBe(now);
  });

  it('todayInTimezone matches nowInTimezone date portion for multiple timezones', () => {
    freezeTime('2026-06-15T12:00:00.000Z');
    const timezones = ['UTC', 'Asia/Dubai', 'America/New_York', 'Asia/Tokyo', 'Europe/London'];
    for (const tz of timezones) {
      const today = todayInTimezone(tz);
      const now = nowInTimezone(tz, 'yyyy-MM-dd');
      expect(today).toBe(now);
    }
  });

  it('cronForLocalHour uses localHourToUtcHour internally', () => {
    freezeTime('2026-03-17T12:00:00.000Z');
    const utcHour = localHourToUtcHour(6, 'Asia/Dubai');
    const cron = cronForLocalHour(6, 'Asia/Dubai');
    expect(cron).toBe(`0 ${utcHour} * * *`);
  });

  it('endOfDayInTimezone is exactly one day after startOfDayInTimezone for multiple combos', () => {
    const dates = ['2026-01-01', '2026-02-28', '2026-06-15', '2026-12-31'];
    const timezones = ['UTC', 'Asia/Dubai', 'America/New_York', 'Asia/Tokyo', 'Asia/Kolkata'];

    for (const dateStr of dates) {
      for (const tz of timezones) {
        const start = startOfDayInTimezone(dateStr, tz);
        const end = endOfDayInTimezone(dateStr, tz);
        const diffMs = end.getTime() - start.getTime();
        expect(diffMs).toBe(24 * 60 * 60 * 1000);
      }
    }
  });

  it('startOfDayInTimezone for consecutive days are 24h apart across multiple timezones', () => {
    const timezones = ['UTC', 'Asia/Dubai', 'Asia/Tokyo'];
    for (const tz of timezones) {
      const day1 = startOfDayInTimezone('2026-03-17', tz);
      const day2 = startOfDayInTimezone('2026-03-18', tz);
      expect(day2.getTime() - day1.getTime()).toBe(24 * 60 * 60 * 1000);
    }
  });

  it('a full week of days creates contiguous non-overlapping ranges', () => {
    const tz = 'Asia/Dubai';
    const dates = [
      '2026-03-16', '2026-03-17', '2026-03-18', '2026-03-19',
      '2026-03-20', '2026-03-21', '2026-03-22',
    ];

    for (let i = 0; i < dates.length - 1; i++) {
      const end = endOfDayInTimezone(dates[i], tz);
      const nextStart = startOfDayInTimezone(dates[i + 1], tz);
      expect(end.getTime()).toBe(nextStart.getTime());
    }
  });
});
