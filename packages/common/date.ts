import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { getHours } from 'date-fns';

/**
 * Get today's date as YYYY-MM-DD in the given IANA timezone.
 */
export function todayInTimezone(timezone: string): string {
  return formatInTimeZone(new Date(), timezone, 'yyyy-MM-dd');
}

/**
 * Get the current time formatted in the given timezone.
 * @param timezone IANA timezone string (e.g., 'Asia/Dubai')
 * @param format date-fns format string (e.g., 'yyyy-MM-dd HH:mm:ss')
 */
export function nowInTimezone(timezone: string, format: string = 'yyyy-MM-dd HH:mm:ss'): string {
  return formatInTimeZone(new Date(), timezone, format);
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
