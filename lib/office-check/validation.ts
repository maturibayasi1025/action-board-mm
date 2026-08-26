import { z } from "zod";
import { LEFT_AT_TIME_PATTERN } from "./left-at";

export const officeClosingFormSchema = z.object({
  leftAtTime: z
    .string()
    .regex(LEFT_AT_TIME_PATTERN, "退室時間を HH:mm 形式で入力してください"),
  checkedFloorIds: z
    .array(z.string().uuid())
    .min(1, "各階の最終チェックを入れてください"),
  note: z.string().max(500, "備考は500文字以内で入力してください").optional(),
});

export type OfficeClosingFormInput = z.infer<typeof officeClosingFormSchema>;

export function assertAllFloorsChecked(
  activeFloorIds: string[],
  checkedFloorIds: string[],
): void {
  const checked = new Set(checkedFloorIds);
  const missing = activeFloorIds.filter((id) => !checked.has(id));
  if (missing.length > 0) {
    throw new Error("すべての階の最終チェックを入れてください");
  }
}
