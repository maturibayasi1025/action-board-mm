"use client";

import { acceptInvitePasswordAction } from "@/app/actions";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { passwordAlertlessSchema } from "@/lib/validation/auth";
import { useRouter } from "next/navigation";
import { useActionState, useCallback, useEffect, useState } from "react";

export default function InviteSetPasswordForm() {
  const router = useRouter();
  const [state, formAction] = useActionState(acceptInvitePasswordAction, null);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const verifyPassword = useCallback((value: string): boolean => {
    if (!value) {
      setPasswordError(null);
      return false;
    }
    const result = passwordAlertlessSchema.safeParse(value);
    if (!result.success) {
      setPasswordError(result.error.errors[0].message);
      return false;
    }
    setPasswordError(null);
    return true;
  }, []);

  useEffect(() => {
    verifyPassword(password);
  }, [password, verifyPassword]);

  useEffect(() => {
    if (state?.success && state.redirectUrl) {
      router.push(state.redirectUrl);
    }
  }, [state, router]);

  return (
    <form action={formAction} className="flex flex-col gap-3 min-w-72 max-w-72">
      <h1 className="text-2xl font-medium text-center mb-2">
        パスワードを設定
      </h1>
      <p className="text-sm text-muted-foreground text-center mb-2">
        招待を受け入れて、ログイン用のパスワードを設定してください。
      </p>
      {state?.error && <FormMessage message={{ error: state.error }} />}
      <Label htmlFor="password">パスワード</Label>
      <p className="text-xs text-muted-foreground">
        ※8文字以上で半角英数を含めてください。英数と一部記号が使えます。
      </p>
      <Input
        id="password"
        type="password"
        name="password"
        placeholder="パスワード"
        required
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {passwordError && (
        <p className="text-primary text-sm font-medium">{passwordError}</p>
      )}
      <Label htmlFor="confirmPassword">パスワード確認</Label>
      <Input
        id="confirmPassword"
        type="password"
        name="confirmPassword"
        placeholder="パスワード確認"
        required
        autoComplete="new-password"
      />
      <SubmitButton pendingText="設定中...">パスワードを設定</SubmitButton>
    </form>
  );
}
