import type { Message } from "@/components/form-message";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";
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

  console.log("[Profile Page] Starting page render");

  // 認証確認用のクライアント
  let supabaseAuth: SupabaseClient<Database>;
  let supabaseAdmin: SupabaseClient<Database>;

  try {
    console.log("[Profile Page] Creating auth client");
    supabaseAuth = await createClient();

    console.log("[Profile Page] Creating service client");
    supabaseAdmin = await createServiceClient();

    console.log("[Profile Page] Clients created successfully");
  } catch (error) {
    console.error("[Profile Page] Error creating clients:", error);
    throw error;
  }

  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();

  if (!user) {
    console.log("[Profile Page] No user found, redirecting to sign-in");
    return redirect("/sign-in");
  }

  console.log("[Profile Page] User authenticated:", { userId: user.id });

  // Service Role Keyを使用してユーザー情報を取得（RLSバイパス）
  console.log("[Profile Page] Fetching user data with service role:", {
    userId: user.id,
  });

  let privateUser: {
    id: string;
    name: string;
    address_prefecture: string;
    date_of_birth: string;
    x_username: string | null;
    avatar_url: string | null;
    hubspot_contact_id: string | null;
    registered_at: string;
    created_at: string;
    updated_at: string;
  } | null = null;

  let privateUserError: {
    code?: string;
    message?: string;
    details?: string;
    hint?: string;
  } | null = null;

  let publicUser: {
    id: string;
    name: string;
    address_prefecture: string;
    x_username: string | null;
    avatar_url: string | null;
    github_username: string | null;
    created_at: string;
  } | null = null;

  let publicUserError: {
    code?: string;
    message?: string;
    details?: string;
    hint?: string;
  } | null = null;

  try {
    console.log("[Profile Page] Fetching private_users");
    const privateResult = await supabaseAdmin
      .from("private_users")
      .select("*")
      .eq("id", user.id)
      .single();

    privateUser = privateResult.data;
    privateUserError = privateResult.error;

    console.log("[Profile Page] Private user fetch result:", {
      hasData: !!privateUser,
      hasError: !!privateUserError,
      errorCode: privateUserError?.code,
      errorMessage: privateUserError?.message,
    });
  } catch (error) {
    console.error("[Profile Page] Exception fetching private user:", error);
    privateUserError = { code: "EXCEPTION", message: String(error) };
  }

  try {
    console.log("[Profile Page] Fetching public_user_profiles");
    const publicResult = await supabaseAdmin
      .from("public_user_profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    publicUser = publicResult.data;
    publicUserError = publicResult.error;

    console.log("[Profile Page] Public user fetch result:", {
      hasData: !!publicUser,
      hasError: !!publicUserError,
      errorCode: publicUserError?.code,
      errorMessage: publicUserError?.message,
    });
  } catch (error) {
    console.error("[Profile Page] Exception fetching public user:", error);
    publicUserError = { code: "EXCEPTION", message: String(error) };
  }

  // エラーハンドリング
  let errorMessage: string | undefined;

  if (privateUserError) {
    if (privateUserError.code === "PGRST116") {
      // ユーザーが存在しない場合は新規登録として扱う
      console.log(
        "[Profile Page] Private user not found, treating as new user",
      );
    } else {
      // それ以外のエラーは詳細をログに出力
      console.error("[Profile Page] Error fetching private user:", {
        code: privateUserError.code,
        message: privateUserError.message,
        details: privateUserError.details,
        hint: privateUserError.hint,
        userId: user.id,
      });
      // エラーメッセージを設定
      errorMessage = `プロフィール情報の取得に失敗しました。ページを再読み込みしてください。（エラーコード: ${privateUserError.code}）`;
    }
  }

  if (publicUserError && publicUserError.code !== "PGRST116") {
    // public_user_profilesのエラーは詳細をログに出力（致命的ではない）
    console.error("[Profile Page] Error fetching public user:", {
      code: publicUserError.code,
      message: publicUserError.message,
      details: publicUserError.details,
      hint: publicUserError.hint,
      userId: user.id,
    });
  }

  // エラーがある場合はエラーページを表示
  if (errorMessage) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <div className="w-full max-w-md p-6 bg-red-50 border border-red-200 rounded-lg">
          <h2 className="text-xl font-bold text-red-800 mb-4">
            プロフィール情報の取得に失敗しました
          </h2>
          <p className="text-red-700 mb-4">{errorMessage}</p>
          <div className="space-y-2 text-sm text-red-600">
            <p>以下をお試しください：</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>ページを再読み込みする</li>
              <li>一度サインアウトしてから再度サインインする</li>
              <li>問題が続く場合はサポートにお問い合わせください</li>
            </ul>
          </div>
          <div className="mt-6 flex gap-4">
            <a
              href="/settings/profile"
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-center"
            >
              ページを再読み込み
            </a>
            <a
              href="/"
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-center"
            >
              ホームに戻る
            </a>
          </div>
        </div>
      </div>
    );
  }

  // 新規ユーザーかどうか判定（PGRST116の場合のみ新規とみなす）
  const isNew = Boolean(
    params?.new || (privateUserError?.code === "PGRST116" && !privateUser),
  );

  return (
    <div className="flex flex-col items-center justify-center py-2">
      <ProfileForm
        message={params}
        isNew={isNew}
        initialProfile={{
          name: privateUser?.name || user.user_metadata?.name || "",
          address_prefecture: privateUser?.address_prefecture || "",
          date_of_birth: privateUser?.date_of_birth || undefined,
          x_username: privateUser?.x_username ?? null,
          github_username: publicUser?.github_username ?? null,
          avatar_url: privateUser?.avatar_url ?? null,
        }}
        initialPrivateUser={privateUser || null}
      />
    </div>
  );
}
