export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export function clampLimit(limit?: number): number {
  if (limit === undefined || Number.isNaN(limit)) {
    return DEFAULT_LIMIT;
  }
  return Math.min(MAX_LIMIT, Math.max(1, Math.floor(limit)));
}

export function clampOffset(offset?: number): number {
  if (offset === undefined || Number.isNaN(offset) || offset < 0) {
    return 0;
  }
  return Math.floor(offset);
}

export function toRange(
  limit: number,
  offset: number,
): { from: number; to: number } {
  return { from: offset, to: offset + limit - 1 };
}

export const SURVEY_RAW_DEFAULT_LIMIT = 50;
export const SURVEY_RAW_MAX_LIMIT = 200;

export function clampSurveyRawLimit(limit?: number): number {
  if (limit === undefined || Number.isNaN(limit)) {
    return SURVEY_RAW_DEFAULT_LIMIT;
  }
  return Math.min(SURVEY_RAW_MAX_LIMIT, Math.max(1, Math.floor(limit)));
}
