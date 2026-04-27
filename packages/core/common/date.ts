import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { getHours, addDays } from 'date-fns';

/**
 * Get today's date as YYYY-MM-DD in the given IANA timezone.
 *
 * Pass `now` to override the reference instant — used by tests that fire the
 * schedule scanner with a deterministic `asOf` instead of wall-clock time.
 * Production callers omit it and pick up the live clock.
 */
export function todayInTimezone(timezone: string, now: Date = new Date()): string {
  return formatInTimeZone(now, timezone, 'yyyy-MM-dd');
}

/**
 * Get the current time formatted in the given timezone.
 * @param timezone IANA timezone string (e.g., 'Asia/Dubai')
 * @param format date-fns format string (e.g., 'yyyy-MM-dd HH:mm:ss')
 * @param now Optional override of the reference instant (see todayInTimezone).
 */
export function nowInTimezone(
  timezone: string,
  format: string = 'yyyy-MM-dd HH:mm:ss',
  now: Date = new Date(),
): string {
  return formatInTimeZone(now, timezone, format);
}

/**
 * Convert a local hour in a timezone to the equivalent UTC hour.
 * Useful for converting "2 AM Dubai time" to a UTC cron hour.
 *
 * Note: This uses today's offset, which may shift during DST transitions.
 * For most business timezones without DST (e.g., Asia/Dubai) this is stable.
 */
export function localHourToUtcHour(localHour: number, timezone: string): number {
  const today = formatInTimeZone(new Date(), timezone, 'yyyy-MM-dd');
  const localTime = fromZonedTime(`${today}T${String(localHour).padStart(2, '0')}:00:00`, timezone);
  return getHours(localTime);
}

/**
 * Build a daily cron pattern (minute hour * * *) for a given local hour in a timezone.
 * Returns the equivalent UTC cron string.
 */
export function cronForLocalHour(localHour: number, timezone: string): string {
  const utcHour = localHourToUtcHour(localHour, timezone);
  return `0 ${utcHour} * * *`;
}

/**
 * Get the UTC start of day for a calendar date string in a given timezone.
 * Use this when filtering timestamptz columns by a user-selected date.
 *
 * @example
 * // User in Dubai selects March 17
 * startOfDayInTimezone('2026-03-17', 'Asia/Dubai')
 * // → 2026-03-16T20:00:00.000Z (midnight Dubai = 8 PM UTC previous day)
 */
export function startOfDayInTimezone(dateStr: string, timezone: string): Date {
  return fromZonedTime(`${dateStr}T00:00:00`, timezone);
}

/**
 * Get the UTC start of the next day for a calendar date string in a given timezone.
 * Use as the exclusive upper bound: WHERE created_at >= start AND created_at < end.
 *
 * @example
 * endOfDayInTimezone('2026-03-17', 'Asia/Dubai')
 * // → 2026-03-17T20:00:00.000Z (midnight March 18 Dubai = 8 PM UTC March 17)
 */
export function endOfDayInTimezone(dateStr: string, timezone: string): Date {
  const startOfDay = fromZonedTime(`${dateStr}T00:00:00`, timezone);
  return addDays(startOfDay, 1);
}
