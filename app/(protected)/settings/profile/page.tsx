import type { Message } from "@/components/form-message";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ProfileForm from "./ProfileForm";

// Edge RuntimeはcreateServiceClientとの互換性の問題があるため無効化
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
  const supabaseService = await createServiceClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/sign-in");
  }

  // ユーザー情報を取得
  const { data: privateUser, error: privateUserError } = await supabaseService
    .from("private_users")
    .select("*")
    .eq("id", user.id)
    .single();

  const { data: publicUser, error: publicUserError } = await supabaseService
    .from("public_user_profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  // エラーハンドリング
  if (privateUserError && privateUserError.code !== "PGRST116") {
    console.error("Error fetching private user:", privateUserError);
  }

  if (publicUserError && publicUserError.code !== "PGRST116") {
    console.error("Error fetching public user:", publicUserError);
  }

  // 新規ユーザーかどうか判定
  const isNew = Boolean(params?.new);

  return (
    <div className="flex flex-col items-center justify-center py-2">
      <ProfileForm
        message={params}
        isNew={isNew}
        initialProfile={{
          name: privateUser?.name || (user.user_metadata?.name as string) || "",
          address_prefecture: privateUser?.address_prefecture || "",
          date_of_birth:
            privateUser?.date_of_birth ??
            (user.user_metadata?.date_of_birth as string),
          x_username: privateUser?.x_username || null,
          github_username: publicUser?.github_username || null,
          avatar_url: privateUser?.avatar_url || null,
        }}
        initialPrivateUser={privateUser}
      />
    </div>
  );
}
