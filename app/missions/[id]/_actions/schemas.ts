import { ARTIFACT_TYPES } from "@/lib/artifactTypes";
import { MAX_POSTING_COUNT } from "@/lib/constants";
import { z } from "zod";

const baseMissionFormSchema = z.object({
  missionId: z.string().nonempty({ message: "グッジョブIDが必要です" }),
  requiredArtifactType: z
    .string()
    .nonempty({ message: "提出タイプが必要です" }),
  artifactDescription: z.string().optional(),
});

// LINKタイプ用スキーマ
const linkArtifactSchema = baseMissionFormSchema.extend({
  requiredArtifactType: z.literal(ARTIFACT_TYPES.LINK.key),
  artifactLink: z
    .string()
    .nonempty({ message: "リンクURLが必要です" })
    .url({ message: "有効なURLを入力してください" }),
});

// TEXTタイプ用スキーマ
const textArtifactSchema = baseMissionFormSchema.extend({
  requiredArtifactType: z.literal(ARTIFACT_TYPES.TEXT.key),
  artifactText: z.string().nonempty({ message: "テキストが必要です" }),
});

// EMAILタイプ用スキーマ
const emailArtifactSchema = baseMissionFormSchema.extend({
  requiredArtifactType: z.literal(ARTIFACT_TYPES.EMAIL.key),
  artifactEmail: z
    .string()
    .nonempty({ message: "メールアドレスが必要です" })
    .email({ message: "有効なメールアドレスを入力してください" }),
});

// IMAGEタイプ用スキーマ
const imageArtifactSchema = baseMissionFormSchema.extend({
  requiredArtifactType: z.literal(ARTIFACT_TYPES.IMAGE.key),
  artifactImagePath: z.string().nonempty({ message: "画像が必要です" }),
});

// IMAGE_WITH_GEOLOCATIONタイプ用スキーマ
const imageWithGeolocationArtifactSchema = baseMissionFormSchema.extend({
  requiredArtifactType: z.literal(ARTIFACT_TYPES.IMAGE_WITH_GEOLOCATION.key),
  artifactImagePath: z.string().nonempty({ message: "画像が必要です" }),
  latitude: z
    .string()
    .nonempty({ message: "緯度が必要です" })
    .refine((val) => !Number.isNaN(Number.parseFloat(val)), {
      message: "有効な緯度を入力してください",
    }),
  longitude: z
    .string()
    .nonempty({ message: "経度が必要です" })
    .refine((val) => !Number.isNaN(Number.parseFloat(val)), {
      message: "有効な経度を入力してください",
    }),
  accuracy: z
    .string()
    .optional()
    .refine((val) => !val || !Number.isNaN(Number.parseFloat(val)), {
      message: "有効な精度を入力してください",
    }),
  altitude: z
    .string()
    .optional()
    .refine((val) => !val || !Number.isNaN(Number.parseFloat(val)), {
      message: "有効な高度を入力してください",
    }),
});

// NONEタイプ用スキーマ
const noneArtifactSchema = baseMissionFormSchema.extend({
  requiredArtifactType: z.literal(ARTIFACT_TYPES.NONE.key),
});

// POSTINGタイプ用スキーマ
const postingArtifactSchema = baseMissionFormSchema.extend({
  requiredArtifactType: z.literal(ARTIFACT_TYPES.POSTING.key),
  postingCount: z.coerce
    .number()
    .min(1, { message: "ポスティング枚数は1枚以上で入力してください" })
    .max(MAX_POSTING_COUNT, {
      message: `ポスティング枚数は${MAX_POSTING_COUNT}枚以下で入力してください`,
    }),
  locationText: z
    .string()
    .min(1, { message: "ポスティング場所を入力してください" })
    .max(100, { message: "ポスティング場所は100文字以下で入力してください" }),
});

// QUIZタイプ用スキーマ（sessionIdは不要）
const quizArtifactSchema = baseMissionFormSchema.extend({
  requiredArtifactType: z.literal(ARTIFACT_TYPES.QUIZ.key),
});

// LINK_ACCESSタイプ用スキーマ
const linkAccessArtifactSchema = baseMissionFormSchema.extend({
  requiredArtifactType: z.literal(ARTIFACT_TYPES.LINK_ACCESS.key),
});

// 統合スキーマ
const achieveMissionFormSchema = z.discriminatedUnion("requiredArtifactType", [
  linkArtifactSchema,
  textArtifactSchema,
  emailArtifactSchema,
  imageArtifactSchema,
  imageWithGeolocationArtifactSchema,
  noneArtifactSchema,
  postingArtifactSchema,
  quizArtifactSchema,
  linkAccessArtifactSchema, // 追加
]);

// 提出キャンセルアクションのバリデーションスキーマ
const cancelSubmissionFormSchema = z.object({
  achievementId: z.string().nonempty({ message: "達成IDが必要です" }),
  missionId: z.string().nonempty({ message: "グッジョブIDが必要です" }),
});

export { achieveMissionFormSchema, cancelSubmissionFormSchema };
