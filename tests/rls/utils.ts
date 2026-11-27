import type { Database } from "@/lib/types/supabase";
import { createClient } from "@supabase/supabase-js";

// 環境変数の設定が必要
if (
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  !process.env.SUPABASE_SERVICE_ROLE_KEY
) {
  console.error("必要な環境変数が設定されていません");
  process.exit(1);
}

// サービスロールクライアント（RLSをバイパスする管理者権限）
export const adminClient = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

function newTestEmail(): string {
  // Date.now() だけだと、CI の並列ワーカーが同じミリ秒で衝突する
  return `test-${Date.now()}-${crypto.randomUUID()}@example.com`;
}

// テストユーザーの情報
export type TestUser = {
  email: string;
  password: string;
  userId: string;
};

/**
 * テストユーザーを作成し、認証情報を持つクライアントを返す
 */
export async function createTestUser(
  email = newTestEmail(),
  password = "password123",
): Promise<{
  user: TestUser;
  client: ReturnType<typeof createClient<Database>>;
}> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URLが設定されていません");
  }

  // 並列実行で Auth の作成が一時的に失敗することがあるので、新しいメールでやり直す
  let createdEmail = email;
  let authData:
    | Awaited<ReturnType<typeof adminClient.auth.admin.createUser>>["data"]
    | null = null;
  let authError: { message: string } | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const emailToUse = attempt === 0 ? email : newTestEmail();
    const created = await adminClient.auth.admin.createUser({
      email: emailToUse,
      password,
      email_confirm: true,
    });
    if (!created.error && created.data.user) {
      authData = created.data;
      createdEmail = emailToUse;
      authError = null;
      break;
    }
    authError = created.error;
    if (attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
    }
  }

  if (authError || !authData?.user) {
    throw new Error(
      `テストユーザーの作成に失敗しました: ${authError?.message}`,
    );
  }

  const authId = authData.user.id;

  // private_usersテーブルにデータを挿入（管理者権限で）
  const { error: insertError } = await adminClient
    .from("private_users")
    .insert({
      id: authId,
      name: "テストユーザー",
      address_prefecture: "東京都",
      date_of_birth: "1990-12-01",
    });

  if (insertError) {
    throw new Error(
      `private_usersへのデータ挿入に失敗しました: ${insertError.message}`,
    );
  }

  // 認証情報を持つクライアントを作成
  const { data: sessionData, error: sessionError } =
    await adminClient.auth.admin.generateLink({
      type: "magiclink",
      email: createdEmail,
    });

  if (sessionError || !sessionData.properties?.hashed_token) {
    throw new Error(`セッション生成に失敗しました: ${sessionError?.message}`);
  }

  // ログインしたクライアントを生成
  const userClient = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  const { error: signInError } = await userClient.auth.signInWithPassword({
    email: createdEmail,
    password,
  });

  if (signInError) {
    throw new Error(`サインインに失敗しました: ${signInError.message}`);
  }

  return {
    user: {
      email: createdEmail,
      password,
      userId: authId,
    },
    client: userClient,
  };
}

/**
 * テストユーザーをクリーンアップ
 */
export async function cleanupTestUser(authId: string): Promise<void> {
  // public_user_profilesからユーザーを削除
  const { data } = await adminClient
    .from("private_users")
    .select("id")
    .eq("id", authId)
    .single();

  if (!data) {
    console.error(`ユーザーが見つかりません: authId=${authId}`);
    return;
  }

  await adminClient.from("public_user_profiles").delete().eq("id", data?.id);

  // private_usersからユーザーを削除
  await adminClient.from("private_users").delete().eq("id", authId);

  // Auth ユーザーを削除
  await adminClient.auth.admin.deleteUser(authId);
}

/**
 * 匿名ユーザー用のクライアントを取得
 */
export function getAnonClient(): ReturnType<typeof createClient<Database>> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URLが設定されていません");
  }
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
