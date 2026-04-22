import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { getDay, getHours, setHours, setMinutes, setSeconds, setMilliseconds, addDays } from "date-fns";

const BUSINESS_START_HOUR = 9;
const BUSINESS_END_HOUR = 17;

function setToStartOfBusinessDay(date: Date): Date {
  return setMilliseconds(setSeconds(setMinutes(setHours(date, BUSINESS_START_HOUR), 0), 0), 0);
}

/**
 * Returns the next valid business hour send time (9am-5pm Mon-Fri) in the given timezone.
 * 
 * - If already within business hours on a weekday, returns the input unchanged.
 * - If before 9am on a weekday, pushes to 9am same day.
 * - If after 5pm on a weekday, pushes to 9am next business day.
 * - If on Saturday or Sunday, pushes to Monday 9am.
 */
export function nextBusinessHour(dateUtc: Date, timezone: string): Date {
  const zonedTime = toZonedTime(dateUtc, timezone);
  
  const dayOfWeek = getDay(zonedTime);
  const hour = getHours(zonedTime);
  
  const isSaturday = dayOfWeek === 6;
  const isSunday = dayOfWeek === 0;
  const isFriday = dayOfWeek === 5;
  
  const isBeforeBusinessHours = hour < BUSINESS_START_HOUR;
  const isAfterBusinessHours = hour >= BUSINESS_END_HOUR;
  const isWeekend = isSaturday || isSunday;
  
  if (!isWeekend && !isBeforeBusinessHours && !isAfterBusinessHours) {
    return dateUtc;
  }
  
  let nextBusinessTime: Date;
  
  if (isWeekend) {
    const daysUntilMonday = isSaturday ? 2 : 1;
    nextBusinessTime = setToStartOfBusinessDay(addDays(zonedTime, daysUntilMonday));
  } else if (isBeforeBusinessHours) {
    nextBusinessTime = setToStartOfBusinessDay(zonedTime);
  } else {
    const daysToAdd = isFriday ? 3 : 1;
    nextBusinessTime = setToStartOfBusinessDay(addDays(zonedTime, daysToAdd));
  }
  
  return fromZonedTime(nextBusinessTime, timezone);
}
