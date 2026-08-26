import { format } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

export const JST_TIME_ZONE = "Asia/Tokyo";
export const LEFT_AT_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

export function formatJstHm(date: Date): string {
  return format(toZonedTime(date, JST_TIME_ZONE), "HH:mm");
}

export function formatJstDateTime(date: Date): string {
  return format(toZonedTime(date, JST_TIME_ZONE), "yyyy/MM/dd HH:mm");
}

/**
 * JST の当日日付と HH:mm を組み合わせて UTC の Date にする。
 */
export function leftAtFromJstTime(timeHm: string, now = new Date()): Date {
  if (!LEFT_AT_TIME_PATTERN.test(timeHm)) {
    throw new Error("退室時間の形式が正しくありません");
  }
  const hm = timeHm.slice(0, 5);
  const datePart = format(toZonedTime(now, JST_TIME_ZONE), "yyyy-MM-dd");
  return fromZonedTime(`${datePart}T${hm}:00`, JST_TIME_ZONE);
}
