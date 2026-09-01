import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ChangePasswordForm from "./ChangePasswordForm";

export const runtime = "edge";

export default async function ChangePasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in?returnUrl=/settings/password");
  }

  const metadata = user.user_metadata as { provider?: string } | undefined;
  if (metadata?.provider === "line") {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4">
        <div className="w-full max-w-md rounded-lg border border-border p-6">
          <h1 className="text-2xl font-medium mb-2">パスワード変更</h1>
          <p className="text-sm text-muted-foreground">
            LINEで登録したアカウントは、この画面からパスワードを変更できません。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-8 px-4">
      <ChangePasswordForm />
    </div>
  );
}
