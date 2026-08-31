"use client";

import Link from "next/link";
import { useActionState, useCallback, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { FormMessage, type Message } from "../../../components/form-message";
import { SubmitButton } from "../../../components/submit-button";
import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";
import { Checkbox } from "../../../components/ui/checkbox";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { passwordAlertlessSchema } from "../../../lib/validation/auth";
import { emailSignUpActionWithState } from "../../actions";

interface SignUpFormProps {
  searchParams: Message;
}

function SignUpFormFields({
  email,
  password,
  setEmail,
  setPassword,
  isTermsAgreed,
  setIsTermsAgreed,
  passwordError,
  isPasswordValid,
}: {
  email: string;
  password: string;
  setEmail: (value: string) => void;
  setPassword: (value: string) => void;
  isTermsAgreed: boolean;
  setIsTermsAgreed: (value: boolean) => void;
  passwordError: string | null;
  isPasswordValid: boolean;
}) {
  const { pending } = useFormStatus();
  const canSubmit =
    Boolean(email) && Boolean(password) && isPasswordValid && isTermsAgreed;

  return (
    <div className="flex flex-col gap-2 [&>input]:mb-3 mt-8">
      <Label htmlFor="email">メールアドレス</Label>
      <p className="text-xs text-muted-foreground mb-2">
        ※一部のメールアドレスに認証メールが届かない事象が確認されています。Gmail
        などのメールアドレスをご利用いただくと、より確実にご登録いただけます。
      </p>
      <Input
        id="email"
        name="email"
        type="email"
        placeholder="you@example.com"
        required
        disabled={pending}
        autoComplete="username"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Label htmlFor="password">パスワード</Label>
      <p className="text-xs text-muted-foreground mb-2">
        ※8文字以上で半角英数を含めてください。英数と一部記号が使えます。
      </p>
      <Input
        id="password"
        type="password"
        name="password"
        placeholder="パスワード"
        minLength={8}
        required
        disabled={pending}
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {passwordError && (
        <p className="text-primary text-sm font-medium mb-2">{passwordError}</p>
      )}

      <div className="flex items-center space-x-2 mt-2 mb-2">
        <Checkbox
          id="terms"
          checked={isTermsAgreed}
          onCheckedChange={(checked) => setIsTermsAgreed(checked === true)}
          disabled={pending}
        />
        <Label htmlFor="terms" className="text-sm font-normal cursor-pointer">
          <Link
            href="/terms"
            className="text-primary underline hover:no-underline"
            target="_blank"
          >
            利用規約
          </Link>
          および
          <Link
            href="/privacy"
            className="text-primary underline hover:no-underline"
            target="_blank"
          >
            プライバシーポリシー
          </Link>
          に同意する
        </Label>
      </div>

      <SubmitButton
        pendingText="アカウント作成中..."
        disabled={!canSubmit || pending}
        className="mt-2"
      >
        アカウントを作成
      </SubmitButton>
    </div>
  );
}

export default function SignUpForm({ searchParams }: SignUpFormProps) {
  const [state, formAction] = useActionState(emailSignUpActionWithState, null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isPasswordValid, setIsPasswordValid] = useState(true);
  const [isTermsAgreed, setIsTermsAgreed] = useState(false);

  const verifyPassword = useCallback((value: string): boolean => {
    if (!value) {
      setPasswordError(null);
      setIsPasswordValid(false);
      return false;
    }
    const result = passwordAlertlessSchema.safeParse(value);
    if (!result.success) {
      setPasswordError(result.error.errors[0].message);
      setIsPasswordValid(false);
      return false;
    }
    setPasswordError(null);
    setIsPasswordValid(true);
    return true;
  }, []);

  useEffect(() => {
    verifyPassword(password);
  }, [password, verifyPassword]);

  useEffect(() => {
    if (state?.formData) {
      setEmail(state.formData.email);
    }
  }, [state]);

  return (
    <form
      action={formAction}
      className="flex flex-col min-w-72 max-w-72 mx-auto"
    >
      <h1 className="text-2xl font-medium text-center mb-2">
        アクションボードに登録
      </h1>
      <p className="text-sm text-foreground text-center mb-4">
        すでに登録済みの方は{" "}
        <Link className="text-primary font-medium underline" href="/sign-in">
          こちら
        </Link>
      </p>

      {state && <FormMessage className="mt-4" message={state} />}
      <FormMessage className="mt-4" message={searchParams} />

      <SignUpFormFields
        email={email}
        password={password}
        setEmail={setEmail}
        setPassword={setPassword}
        isTermsAgreed={isTermsAgreed}
        setIsTermsAgreed={setIsTermsAgreed}
        passwordError={passwordError}
        isPasswordValid={isPasswordValid}
      />

      <Card className="bg-gray-50 border-gray-200 mt-4">
        <CardContent className="p-4">
          <p className="text-sm text-gray-600">
            登録後、確認メールのリンクからアカウントを有効化してください。経営者から招待を受けた方は、招待メールの案内に従って登録できます。
          </p>
        </CardContent>
      </Card>

      <Button asChild variant="link" className="mt-2">
        <Link href="/sign-in">ログイン画面に戻る</Link>
      </Button>
    </form>
  );
}
