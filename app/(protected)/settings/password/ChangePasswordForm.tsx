"use client";

import { changePasswordAction } from "@/app/actions";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { passwordAlertlessSchema } from "@/lib/validation/auth";
import Link from "next/link";
import { useActionState, useCallback, useEffect, useState } from "react";

export default function ChangePasswordForm() {
  const [state, formAction] = useActionState(changePasswordAction, null);
  const [newPassword, setNewPassword] = useState("");
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
    verifyPassword(newPassword);
  }, [newPassword, verifyPassword]);

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>パスワード変更</CardTitle>
        <CardDescription>
          現在のパスワードを確認してから、新しいパスワードを設定します。
        </CardDescription>
      </CardHeader>
      <form action={formAction}>
        <CardContent className="space-y-4">
          {state?.error && <FormMessage message={{ error: state.error }} />}
          {state?.success && (
            <FormMessage message={{ success: state.success }} />
          )}
          <div className="space-y-2">
            <Label htmlFor="currentPassword">現在のパスワード</Label>
            <Input
              id="currentPassword"
              type="password"
              name="currentPassword"
              required
              autoComplete="current-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="newPassword">新しいパスワード</Label>
            <p className="text-xs text-muted-foreground">
              ※8文字以上で半角英数を含めてください。英数と一部記号が使えます。
            </p>
            <Input
              id="newPassword"
              type="password"
              name="newPassword"
              required
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            {passwordError && (
              <p className="text-primary text-sm font-medium">
                {passwordError}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">新しいパスワード（確認）</Label>
            <Input
              id="confirmPassword"
              type="password"
              name="confirmPassword"
              required
              autoComplete="new-password"
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <SubmitButton className="w-full" pendingText="変更中...">
            パスワードを変更
          </SubmitButton>
          <Button asChild variant="link">
            <Link href="/settings/profile">プロフィール設定へ戻る</Link>
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
