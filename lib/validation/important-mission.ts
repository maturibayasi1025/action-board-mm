import { z } from "zod";

export const selectImportantMissionFormSchema = z
  .object({
    missionId: z.string().min(1, "グッジョブを選択してください"),
    isImportant: z.boolean(),
    displayStartDate: z.string().optional().nullable(),
    displayEndDate: z.string().optional().nullable(),
  })
  .refine(
    (data) => {
      if (!data.isImportant) {
        return true;
      }
      if (data.displayStartDate && data.displayEndDate) {
        return new Date(data.displayStartDate) <= new Date(data.displayEndDate);
      }
      return true;
    },
    {
      message: "表示開始日時は表示終了日時より前である必要があります",
      path: ["displayEndDate"],
    },
  );

export const createImportantMissionFormSchema = z
  .object({
    title: z.string().min(1, "タイトルは必須です"),
    slug: z
      .string()
      .min(1, "スラッグは必須です")
      .regex(
        /^[a-z0-9_-]+$/,
        "スラッグは英数字、ハイフン、アンダースコアのみ使用できます",
      ),
    content: z.string().optional().nullable(),
    difficulty: z.number().min(1).max(5),
    required_artifact_type: z.string().min(1, "成果物の種類は必須です"),
    icon_url: z.string().optional().nullable(),
    event_date: z.string().optional().nullable(),
    max_achievement_count: z.number().optional().nullable(),
    artifact_label: z.string().optional().nullable(),
    ogp_image_url: z.string().optional().nullable(),
    is_hidden: z.boolean().optional(),
    is_featured: z.boolean().optional(),
    is_important: z.boolean().optional(),
    important_display_start_date: z.string().optional().nullable(),
    important_display_end_date: z.string().optional().nullable(),
  })
  .refine(
    (data) => {
      if (!data.is_important) {
        return true;
      }
      if (
        data.important_display_start_date &&
        data.important_display_end_date
      ) {
        return (
          new Date(data.important_display_start_date) <=
          new Date(data.important_display_end_date)
        );
      }
      return true;
    },
    {
      message: "表示開始日時は表示終了日時より前である必要があります",
      path: ["important_display_end_date"],
    },
  );

export type SelectImportantMissionFormData = z.infer<
  typeof selectImportantMissionFormSchema
>;
export type CreateImportantMissionFormData = z.infer<
  typeof createImportantMissionFormSchema
>;
