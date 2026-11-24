export function monthlySurveyEndAt(year: number, monthIndex: number): Date {
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const jstOffsetHours = 9;
  return new Date(
    Date.UTC(year, monthIndex, lastDay, 23 - jstOffsetHours, 59, 59),
  );
}

export function formatSurveyDateTimeJst(instant: Date): string {
  return instant.toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
}

export function slackDeadlineForMonthlySurvey(input: {
  calculatedEnd: Date;
  existingEndIso: string | null;
}): { deadline: Date; warning: string | null } {
  if (input.existingEndIso == null) {
    return { deadline: input.calculatedEnd, warning: null };
  }
  const storedEnd = new Date(input.existingEndIso);
  if (storedEnd.getTime() === input.calculatedEnd.getTime()) {
    return { deadline: storedEnd, warning: null };
  }
  return {
    deadline: storedEnd,
    warning: `保存済みの end_date ${storedEnd.toISOString()} は計算値 ${input.calculatedEnd.toISOString()} と異なるため、Slack の回答期限は保存値を使います`,
  };
}
