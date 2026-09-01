import type { EmailOtpType } from "@supabase/supabase-js";

const EMAIL_OTP_TYPES = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
] as const satisfies readonly EmailOtpType[];

export function parseEmailOtpType(value: string | null): EmailOtpType | null {
  if (!value) {
    return null;
  }
  for (const type of EMAIL_OTP_TYPES) {
    if (type === value) {
      return type;
    }
  }
  return null;
}
