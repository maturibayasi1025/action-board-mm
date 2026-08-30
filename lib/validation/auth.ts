import { calculateAge } from "@/lib/utils/utils";
import { z } from "zod";

// パスワードの許可文字の正規表現
const ALLOWED_PASSWORD_CHARS_REGEX = /^[a-zA-Z0-9@+*/#$%&!\-]*$/;
// パスワードが英字と数字の両方を含むかチェックする正規表現
const ALPHANUMERIC_REQUIRED_REGEX = /(?=.*[a-zA-Z])(?=.*[0-9])/;

// メールアドレスのバリデーションスキーマ（再利用可能）
export const emailSchema = z
  .string()
  .nonempty({ message: "メールアドレスを入力してください" })
  .email({ message: "有効なメールアドレスを入力してください" })
  .transform((value) => value.trim().toLowerCase());

// パスワードのサーバーバリデーションスキーマ（再利用可能）
export const passwordAlertSchema = z
  .string()
  .nonempty({ message: "パスワードを入力してください" })
  .min(8, { message: "パスワードは8文字以上で入力してください" })
  .regex(ALPHANUMERIC_REQUIRED_REGEX, {
    message: "パスワードには英字と数字の両方を含めてください",
  });

// パスワードのクライアントバリデーションスキーマ（再利用可能）
export const passwordAlertlessSchema = z
  .string()
  .max(32, { message: "パスワードは32文字以下で入力してください" })
  .regex(ALLOWED_PASSWORD_CHARS_REGEX, {
    message: "パスワードに無効な文字が含まれています",
  });

// パスワードのバリデーションスキーマ（再利用可能）
export const passwordSchema = passwordAlertlessSchema.and(passwordAlertSchema);

export const signUpAndLoginFormSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const signInAndLoginFormSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const forgotPasswordFormSchema = z.object({
  email: emailSchema,
});

export const setPasswordFormSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z
      .string()
      .nonempty({ message: "パスワード確認を入力してください" }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "パスワードが一致しません",
    path: ["confirmPassword"],
  });

export const changePasswordFormSchema = z
  .object({
    currentPassword: z
      .string()
      .nonempty({ message: "現在のパスワードを入力してください" }),
    newPassword: passwordSchema,
    confirmPassword: z
      .string()
      .nonempty({ message: "パスワード確認を入力してください" }),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "パスワードが一致しません",
    path: ["confirmPassword"],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "新しいパスワードは現在のパスワードと異なるものを設定してください",
    path: ["newPassword"],
  });

export const inviteUserFormSchema = z.object({
  email: emailSchema,
  business_unit_id: z
    .union([
      z.string().uuid({ message: "事業部の指定が不正です" }),
      z.literal(""),
      z.null(),
    ])
    .optional(),
});

// LINE認証用のバリデーションスキーマ
export const lineAuthSchema = z.object({
  code: z.string().nonempty({ message: "Authorization code is required" }),
  dateOfBirth: z
    .string()
    .optional()
    .refine(
      (value) => {
        if (!value) return true; // 新規ユーザーでない場合はオプショナル
        const age = calculateAge(value);
        return age >= 18;
      },
      {
        message: "18歳未満の方は登録できません",
      },
    ),
  referralCode: z.string().optional().nullable(),
  returnUrl: z.string().optional().nullable(),
});
