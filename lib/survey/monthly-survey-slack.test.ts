import { slackDeadlineForMonthlySurvey } from "./monthly-survey-deadline";
import {
  buildAwardSurveySlackMessage,
  buildEnpsSurveySlackMessage,
} from "./monthly-survey-slack";

const calculatedEnd = new Date("2026-11-30T14:59:59.000Z");
const storedEnd = new Date("2026-11-30T23:59:59.000Z");
const surveyUrl = "https://example.test/surveys/survey-1";

function deadlineLine(message: {
  blocks: Array<{ fields?: Array<{ text: string }> }>;
}): string {
  const fields = message.blocks.flatMap((block) => block.fields ?? []);
  const field = fields.find((item) => item.text.startsWith("*回答期限:*"));
  if (!field) {
    throw new Error("回答期限がありません");
  }
  return field.text;
}

describe("slackDeadlineForMonthlySurvey", () => {
  it("既存行が無いときは計算値を使い、警告しない", () => {
    expect(
      slackDeadlineForMonthlySurvey({
        calculatedEnd,
        existingEndIso: null,
      }),
    ).toEqual({ deadline: calculatedEnd, warning: null });
  });

  it("保存値と計算値が同じときは保存値を使い、警告しない", () => {
    const choice = slackDeadlineForMonthlySurvey({
      calculatedEnd,
      existingEndIso: calculatedEnd.toISOString(),
    });
    expect(choice.warning).toBeNull();
    expect(choice.deadline.toISOString()).toBe(calculatedEnd.toISOString());
  });

  it("保存値と計算値が違うときは保存値を使い、警告する", () => {
    const choice = slackDeadlineForMonthlySurvey({
      calculatedEnd,
      existingEndIso: storedEnd.toISOString(),
    });
    expect(choice.deadline.toISOString()).toBe(storedEnd.toISOString());
    expect(choice.warning).toContain(storedEnd.toISOString());
    expect(choice.warning).toContain(calculatedEnd.toISOString());
  });
});

describe("月次アンケートの Slack 本文", () => {
  it("eNPS の回答期限は渡した end_date の JST 表示", () => {
    const message = buildEnpsSurveySlackMessage({
      yearMonthDisplay: "2026年11月度",
      surveyUrl,
      endDate: storedEnd,
    });
    expect(deadlineLine(message)).toBe("*回答期限:*\n2026/12/01 08:59");
  });

  it("表彰の回答期限は渡した end_date の JST 表示", () => {
    const message = buildAwardSurveySlackMessage({
      title: "【表彰アンケート】12期／2026年11月度",
      yearMonthDisplay: "2026年11月度",
      surveyUrl: "https://example.test/surveys/award/survey-1",
      endDate: calculatedEnd,
    });
    expect(deadlineLine(message)).toBe("*回答期限:*\n2026/11/30 23:59");
  });
});
