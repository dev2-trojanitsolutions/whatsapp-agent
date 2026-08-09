import { env } from "../config/env";

function partsInTimezone(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";

  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return {
    day: weekdayMap[get("weekday")],
    hourMinute: `${get("hour")}:${get("minute")}`,
  };
}

export function isWithinBusinessHours(now: Date = new Date()): boolean {
  const { day, hourMinute } = partsInTimezone(now, env.businessHours.timezone);

  if (!env.businessHours.days.includes(day)) return false;

  return hourMinute >= env.businessHours.start && hourMinute < env.businessHours.end;
}
