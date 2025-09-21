"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { FormMessage } from "../../../components/form-message";
import { SubmitButton } from "../../../components/submit-button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { signInActionWithState } from "../../actions";

interface SignInFormProps {
  returnUrl?: string;
}

export default function SignInForm({ returnUrl }: SignInFormProps) {
  const router = useRouter();
  const [state, formAction] = useActionState(signInActionWithState, null);

  // 成功時のリダイレクト処理
  useEffect(() => {
    if (state?.success && state?.redirectUrl) {
      router.push(state.redirectUrl);
    }
  }, [state, router]);

  return (
    <div className="flex flex-col gap-4 mt-8 min-w-72 max-w-72 mx-auto">
      <form action={formAction} className="flex flex-col gap-2 [&>input]:mb-3">
        {state?.error && (
          <FormMessage message={{ error: state.error }} className="mb-4" />
        )}
        {returnUrl && (
          <input type="hidden" name="returnUrl" value={returnUrl} />
        )}

        <Label htmlFor="email">メールアドレス</Label>
        <Input
          name="email"
          placeholder="you@example.com"
          required
          autoComplete="username"
          defaultValue={state?.formData?.email || ""}
        />

        <div className="flex justify-between items-center">
          <Label htmlFor="password">パスワード</Label>
          <Link
            className="text-xs text-foreground underline"
            href="/forgot-password"
          >
            パスワードを忘れた方
          </Link>
        </div>
        <Input
          type="password"
          name="password"
          placeholder="パスワード"
          required
          autoComplete="current-password"
        />

        <SubmitButton pendingText="ログイン中...">ログイン</SubmitButton>
      </form>
    </div>
  );
}
