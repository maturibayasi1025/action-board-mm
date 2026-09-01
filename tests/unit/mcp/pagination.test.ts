import {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  SURVEY_RAW_DEFAULT_LIMIT,
  SURVEY_RAW_MAX_LIMIT,
  clampLimit,
  clampOffset,
  clampSurveyRawLimit,
  toRange,
} from "@/lib/mcp/pagination";

describe("clampLimit", () => {
  it("defaults and caps at 100", () => {
    expect(clampLimit(undefined)).toBe(DEFAULT_LIMIT);
    expect(clampLimit(Number.NaN)).toBe(DEFAULT_LIMIT);
    expect(clampLimit(0)).toBe(1);
    expect(clampLimit(-3)).toBe(1);
    expect(clampLimit(50)).toBe(50);
    expect(clampLimit(500)).toBe(MAX_LIMIT);
    expect(clampLimit(20.9)).toBe(20);
  });
});

describe("clampOffset", () => {
  it("floors and rejects negatives", () => {
    expect(clampOffset(undefined)).toBe(0);
    expect(clampOffset(-1)).toBe(0);
    expect(clampOffset(3.7)).toBe(3);
  });
});

describe("toRange", () => {
  it("builds inclusive supabase ranges", () => {
    expect(toRange(20, 0)).toEqual({ from: 0, to: 19 });
    expect(toRange(20, 20)).toEqual({ from: 20, to: 39 });
  });
});

describe("clampSurveyRawLimit", () => {
  it("defaults to 50 and caps at 200", () => {
    expect(clampSurveyRawLimit(undefined)).toBe(SURVEY_RAW_DEFAULT_LIMIT);
    expect(clampSurveyRawLimit(500)).toBe(SURVEY_RAW_MAX_LIMIT);
    expect(clampSurveyRawLimit(80)).toBe(80);
  });
});
