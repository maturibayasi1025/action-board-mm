export function monthlySurveyEndAt(year: number, monthIndex: number): Date {
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const jstOffsetHours = 9;
  return new Date(
    Date.UTC(year, monthIndex, lastDay, 23 - jstOffsetHours, 59, 59),
  );
}

export function formatSurveyDeadlineJst(endAt: Date): string {
  return endAt.toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
}
