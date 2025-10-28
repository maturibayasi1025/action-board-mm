import type { Message } from "@/components/form-message";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ProfileForm from "./ProfileForm";

export const runtime = "edge";

type ProfileSettingsPageSearchParams = {
  new: string;
} & Message;

export default async function ProfileSettingsPage({
  searchParams,
}: {
  searchParams: Promise<ProfileSettingsPageSearchParams | undefined>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/sign-in");
  }

  // ユーザー情報を取得
  console.log("[Profile Page] Fetching user data:", { userId: user.id });

  const { data: privateUser, error: privateUserError } = await supabase
    .from("private_users")
    .select("*")
    .eq("id", user.id)
    .single();

  const { data: publicUser, error: publicUserError } = await supabase
    .from("public_user_profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  console.log("[Profile Page] Fetch result:", {
    hasPrivateUser: !!privateUser,
    hasPrivateUserError: !!privateUserError,
    privateUserErrorCode: privateUserError?.code,
    hasPublicUser: !!publicUser,
    hasPublicUserError: !!publicUserError,
    publicUserErrorCode: publicUserError?.code,
  });

  // エラーハンドリング
  if (privateUserError) {
    if (privateUserError.code === "PGRST116") {
      // ユーザーが存在しない場合は新規登録として扱う
      console.log(
        "[Profile Page] Private user not found, treating as new user",
      );
    } else {
      // それ以外のエラーは詳細をログに出力してエラーをthrow
      console.error("[Profile Page] Error fetching private user:", {
        code: privateUserError.code,
        message: privateUserError.message,
        details: privateUserError.details,
        hint: privateUserError.hint,
        userId: user.id,
      });
      throw new Error(
        `Failed to fetch user profile: ${privateUserError.message}`,
      );
    }
  }

  if (publicUserError) {
    if (publicUserError.code === "PGRST116") {
      // public_user_profilesが存在しない場合は問題なし（トリガーで作成される）
      console.log(
        "[Profile Page] Public user profile not found, will be created by trigger",
      );
    } else {
      // それ以外のエラーは詳細をログに出力（ただしpublic_user_profilesのエラーは致命的ではない）
      console.error("[Profile Page] Error fetching public user:", {
        code: publicUserError.code,
        message: publicUserError.message,
        details: publicUserError.details,
        hint: publicUserError.hint,
        userId: user.id,
      });
      // public_user_profilesのエラーは致命的ではないので処理継続
    }
  }

  // 新規ユーザーかどうか判定
  const isNew = Boolean(params?.new);

  return (
    <div className="flex flex-col items-center justify-center py-2">
      <ProfileForm
        message={params}
        isNew={isNew}
        initialProfile={{
          name: privateUser?.name || user.user_metadata?.name || "",
          address_prefecture: privateUser?.address_prefecture || "",
          date_of_birth:
            privateUser?.date_of_birth ?? user.user_metadata?.date_of_birth,
          x_username: privateUser?.x_username || null,
          github_username: publicUser?.github_username || null,
          avatar_url: privateUser?.avatar_url || null,
        }}
        initialPrivateUser={privateUser}
      />
    </div>
  );
}
