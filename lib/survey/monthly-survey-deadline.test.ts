import { spawnSync } from "node:child_process";

const CASES = [
  {
    year: 2026,
    monthIndex: 10,
    iso: "2026-11-30T14:59:59.000Z",
    label: "2026/11/30 23:59",
  },
  {
    year: 2026,
    monthIndex: 1,
    iso: "2026-02-28T14:59:59.000Z",
    label: "2026/02/28 23:59",
  },
  {
    year: 2024,
    monthIndex: 1,
    iso: "2024-02-29T14:59:59.000Z",
    label: "2024/02/29 23:59",
  },
  {
    year: 2026,
    monthIndex: 11,
    iso: "2026-12-31T14:59:59.000Z",
    label: "2026/12/31 23:59",
  },
  {
    year: 2027,
    monthIndex: 0,
    iso: "2027-01-31T14:59:59.000Z",
    label: "2027/01/31 23:59",
  },
] as const;

const ACTIONS_START = "2026-11-25T00:00:00.000Z";
const ACTIONS_START_LABEL = "2026/11/25 09:00";

type Observation = {
  localNovemberEnd: string;
  startLabel: string;
  ends: Array<{ iso: string; label: string }>;
};

function observe(timeZone: string): Observation {
  const result = spawnSync(
    process.execPath,
    [
      "--no-warnings",
      "--experimental-strip-types",
      "--input-type=module",
      "-e",
      `
        import { formatSurveyDateTimeJst, monthlySurveyEndAt } from "./lib/survey/monthly-survey-deadline.ts";
        const samples = ${JSON.stringify(CASES.map((sample) => [sample.year, sample.monthIndex]))};
        const ends = samples.map(([year, monthIndex]) => {
          const end = monthlySurveyEndAt(year, monthIndex);
          return { iso: end.toISOString(), label: formatSurveyDateTimeJst(end) };
        });
        console.log(JSON.stringify({
          localNovemberEnd: new Date(2026, 11, 0, 23, 59, 59).toISOString(),
          startLabel: formatSurveyDateTimeJst(new Date(${JSON.stringify(ACTIONS_START)})),
          ends,
        }));
      `,
    ],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: { ...process.env, TZ: timeZone },
    },
  );

  expect(result.status).toBe(0);
  return JSON.parse(result.stdout) as Observation;
}

describe("monthlySurveyEndAt", () => {
  it.each(["UTC", "Asia/Tokyo"])(
    "TZ=%s でも当月末 23:59:59 JST を返す",
    (timeZone) => {
      const observed = observe(timeZone);

      expect(observed.localNovemberEnd).toBe(
        timeZone === "UTC"
          ? "2026-11-30T23:59:59.000Z"
          : "2026-11-30T14:59:59.000Z",
      );

      expect(observed.startLabel).toBe(ACTIONS_START_LABEL);
      expect(observed.ends).toEqual(
        CASES.map((sample) => ({ iso: sample.iso, label: sample.label })),
      );
    },
  );
});
