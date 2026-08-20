"use server";

// Edge Runtime互換のCrypto APIを使用
import {
  getOrInitializeUserLevel,
  grantMissionCompletionXp,
} from "@/lib/services/userLevel";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { deleteCookie, getCookie } from "@/lib/utils/server-cookies";
import { calculateAge, encodedRedirect } from "@/lib/utils/utils";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  forgotPasswordFormSchema,
  lineAuthSchema,
  signInAndLoginFormSchema,
  signUpAndLoginFormSchema,
} from "@/lib/validation/auth";

import {
  isEmailAlreadyUsedInReferral,
  isValidReferralCode,
} from "@/lib/validation/referral";

import { isSuspendedUser } from "@/lib/services/user-status";
import { USER_SUSPENDED_ERROR } from "@/lib/utils/user-status";
import { validateReturnUrl } from "@/lib/validation/url";

import { handleReferralCode } from "./referral";

export const signInActionWithState = async (
  prevState: {
    error?: string;
    success?: string;
    message?: string;
    formData?: {
      email: string;
    };
  } | null,
  formData: FormData,
) => {
  const email = formData.get("email")?.toString();
  const password = formData.get("password")?.toString();
  const returnUrl = formData.get("returnUrl")?.toString();

  // フォームデータを保存（エラー時の状態復元用、メールアドレスのみ）
  const currentFormData = {
    email: email || "",
  };

  // 本番環境でのデバッグログ
  if (process.env.NODE_ENV === "production") {
    console.log("[Sign In Debug] Attempt:", { email, hasPassword: !!password });
    console.log(
      "[Sign In Debug] Supabase URL:",
      process.env.NEXT_PUBLIC_SUPABASE_URL,
    );
    console.log(
      "[Sign In Debug] Has Anon Key:",
      !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    );
  }

  const validatedFields = signInAndLoginFormSchema.safeParse({
    email,
    password,
  });
  if (!validatedFields.success) {
    console.log("[Sign In Debug] Validation failed:", validatedFields.error);
    return {
      error: "メールアドレスまたはパスワードが間違っています",
      formData: currentFormData,
    };
  }

  if (!email || !password) {
    return {
      error: "メールアドレスまたはパスワードが間違っています",
      formData: currentFormData,
    };
  }

  try {
    const supabase = await createClient();
    console.log("[Sign In Debug] Supabase client created successfully");

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    console.log("[Sign In Debug] Auth response:", {
      hasUser: !!data?.user,
      hasSession: !!data?.session,
      error: error ? { code: error.status, message: error.message } : null,
    });

    if (error) {
      console.log("[Sign In Debug] Auth error details:", error);
      return {
        error: `認証エラー: ${error.message} (コード: ${error.status})`,
        formData: currentFormData,
      };
    }

    if (!data.user || !data.session) {
      console.log("[Sign In Debug] No user or session returned");
      return {
        error: "ユーザーまたはセッションが見つかりません",
        formData: currentFormData,
      };
    }

    if (await isSuspendedUser(data.user.id)) {
      await supabase.auth.signOut();
      return {
        error: USER_SUSPENDED_ERROR,
        formData: currentFormData,
      };
    }

    // Validate returnUrl before redirecting
    const validatedReturnUrl = validateReturnUrl(returnUrl);

    console.log(
      "[Sign In Debug] Login successful, redirecting to:",
      validatedReturnUrl || "/",
    );

    return {
      success: "ログインに成功しました",
      redirectUrl: validatedReturnUrl || "/",
    };
  } catch (error) {
    console.error("[Sign In Debug] Unexpected error:", error);
    return {
      error: `予期しないエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`,
      formData: currentFormData,
    };
  }
};

export const forgotPasswordAction = async (formData: FormData) => {
  const email = formData.get("email")?.toString();
  const supabase = await createClient();
  const origin = (await headers()).get("origin");
  const callbackUrl = formData.get("callbackUrl")?.toString();

  if (!email) {
    return encodedRedirect(
      "error",
      "/forgot-password",
      "メールアドレスが必要です",
    );
  }

  const validatedFields = forgotPasswordFormSchema.safeParse({ email });
  if (!validatedFields.success) {
    return encodedRedirect(
      "error",
      "/forgot-password",
      validatedFields.error.errors.map((error) => error.message).join("\n"),
    );
  }

  // LINEユーザーかどうかを確認
  const serviceSupabase = await createServiceClient();

  // 効率的なPostgreSQL関数を使用してメールアドレスでユーザーを検索 (O(1))
  // listUsers()の全件取得 (O(n)) から大幅な性能改善
  const { data: userResults, error: userFetchError } =
    await serviceSupabase.rpc("get_user_by_email", { user_email: email });

  if (userFetchError) {
    console.error("get_user_by_email function failed:", userFetchError);
    throw new Error("Failed to check user existence");
  }

  const userWithEmail = userResults?.[0] || null;

  // LINEユーザーの場合、パスワードリセットは出来ない
  if (
    userWithEmail &&
    (userWithEmail.user_metadata as { provider: string })?.provider === "line"
  ) {
    return encodedRedirect(
      "error",
      "/forgot-password",
      "パスワードリセットに失敗しました",
    );
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?redirect_to=/reset-password`,
  });

  if (error) {
    console.error(error.message);
    return encodedRedirect(
      "error",
      "/forgot-password",
      "パスワードリセットに失敗しました",
    );
  }

  if (callbackUrl) {
    return redirect(callbackUrl);
  }

  return encodedRedirect(
    "success",
    "/forgot-password",
    "パスワードリセット用のリンクをメールでお送りしました。",
  );
};

export const resetPasswordAction = async (formData: FormData) => {
  const supabase = await createClient();

  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!password || !confirmPassword) {
    encodedRedirect(
      "error",
      "/reset-password",
      "パスワードとパスワード確認が必要です",
    );
  }

  if (password !== confirmPassword) {
    encodedRedirect("error", "/reset-password", "パスワードが一致しません");
  }

  const { error } = await supabase.auth.updateUser({
    password: password,
  });

  if (error) {
    encodedRedirect(
      "error",
      "/reset-password",
      error.code === "same_password"
        ? "新しいパスワードは現在のパスワードと異なるものを設定してください"
        : "パスワードの更新に失敗しました",
    );
  }

  encodedRedirect("success", "/sign-in", "パスワードを更新しました");
};

export const signOutAction = async () => {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return redirect("/sign-in");
};

// Email + Password専用サインアップアクション（Two-Step Signup用）

export async function handleLineAuthAction(
  code: string,
  dateOfBirth?: string,
  referralCode?: string | null,
  returnUrl?: string | null,
): Promise<
  { success: true; redirectTo: string } | { success: false; error: string }
> {
  try {
    // バリデーション
    const validationResult = lineAuthSchema.safeParse({
      code,
      dateOfBirth,
      referralCode,
      returnUrl,
    });

    if (!validationResult.success) {
      return {
        success: false,
        error: "認証データが無効です",
      };
    }

    const {
      code: validatedCode,
      dateOfBirth: validatedDateOfBirth,
      referralCode: validatedReferralCode,
      returnUrl: validatedReturnUrl,
    } = validationResult.data;

    // リファラルコードが渡されていない場合はcookieから取得
    let finalReferralCode = validatedReferralCode;
    if (!finalReferralCode) {
      const cookieReferralCode = await getCookie("referral_code");
      finalReferralCode = cookieReferralCode || null;
    }

    // 1. LINE APIでトークンと交換
    const clientId = process.env.NEXT_PUBLIC_LINE_CLIENT_ID;
    const clientSecret = process.env.LINE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error("LINE認証の環境変数が設定されていません");
    }

    const origin = (await headers()).get("origin");
    const redirectUri = `${origin || "http://localhost:3000"}/api/auth/callback/line`;
    const tokenParams = {
      grant_type: "authorization_code",
      code: validatedCode,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    };

    const tokenResponse = await fetch("https://api.line.me/oauth2/v2.1/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(tokenParams),
    });

    if (!tokenResponse.ok) {
      const errorBody = await tokenResponse.text();
      throw new Error(
        `Failed to get access token: ${tokenResponse.status} ${errorBody}`,
      );
    }

    const tokens = await tokenResponse.json();

    // 2. IDトークンからユーザー情報を取得
    let userInfo: {
      sub?: string;
      name?: string;
      email?: string;
      picture?: string;
    } = {};

    if (tokens.id_token) {
      const base64Payload = tokens.id_token.split(".")[1];
      const payload = JSON.parse(
        Buffer.from(base64Payload, "base64").toString(),
      );
      userInfo = payload;
    }

    if (!userInfo.sub) {
      throw new Error("Failed to get user information");
    }

    // 3. Supabaseでユーザー処理
    const supabase = await createServiceClient();
    const lineUserId = userInfo.sub;
    const email = userInfo.email || `line-${lineUserId}@line.local`;
    const name = userInfo.name || "LINEユーザー";
    const image = userInfo.picture;

    // 4. 既存ユーザーチェック
    let userId: string;
    let isNewUser = false;

    // 効率的なPostgreSQL関数を使用してメールアドレスでユーザーを検索 (O(1))
    // listUsers()の全件取得 (O(n)) から大幅な性能改善
    const { data: userResults, error: userFetchError } = await supabase.rpc(
      "get_user_by_email",
      { user_email: email },
    );

    if (userFetchError) {
      console.error(
        "LINE Auth - get_user_by_email function failed:",
        userFetchError,
      );
      throw new Error(
        "Failed to check user existence during LINE authentication",
      );
    }

    const userWithEmail = userResults?.[0] || null;

    if (userWithEmail) {
      // 既存ユーザーの場合：作成方法に応じて処理を分岐
      const metadata = userWithEmail.user_metadata as {
        provider?: string;
        picture?: string;
      };
      const userProvider = metadata?.provider;

      if (userProvider === "line") {
        // LINEで作成されたユーザーの場合：ログイン処理
        userId = userWithEmail.id;
        isNewUser = false;

        // LINE関連のメタデータを更新
        await supabase.auth.admin.updateUserById(userId, {
          user_metadata: {
            ...metadata,
            line_user_id: lineUserId,
            line_linked_at: new Date().toISOString(),
            picture: image || metadata?.picture,
          },
        });
      } else {
        // email+passwordで作成されたユーザーの場合：エラーを返す
        return {
          success: false,
          error: "このメールアドレスは既に登録されています。",
        };
      }
    } else {
      // 新規ユーザーの場合：登録処理

      // 新規ユーザーの場合、date_of_birthが必要
      if (!validatedDateOfBirth) {
        return {
          success: false,
          error:
            "新規ユーザー登録には各種同意と生年月日が必要です。サインアップページから登録してください。",
        };
      }

      const { data: newUser, error: createError } =
        await supabase.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: {
            sub: "",
            name,
            email,
            provider: "line",
            line_user_id: lineUserId,
            date_of_birth: validatedDateOfBirth,
            email_verified: true,
            line_linked_at: new Date().toISOString(),
            phone_verified: false,
            picture: image,
          },
        });

      if (createError || !newUser.user) {
        throw new Error(`Failed to create user: ${createError?.message}`);
      }

      userId = newUser.user.id;
      isNewUser = true;

      // subフィールドを正しく設定
      await supabase.auth.admin.updateUserById(userId, {
        user_metadata: {
          ...newUser.user.user_metadata,
          sub: userId,
        },
      });

      // ユーザーレベル初期化（新規ユーザーのみ）
      await getOrInitializeUserLevel(userId);

      // 紹介コード処理（新規ユーザーのみ）
      if (finalReferralCode && email) {
        await handleReferralCode(finalReferralCode, email);
        // 紹介コード処理完了後、cookieを削除
        await deleteCookie("referral_code");
      }
    }

    // 5. 一時パスワードを設定（Edge Runtime互換）
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const tempPassword = Array.from(array)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const { error: passwordError } = await supabase.auth.admin.updateUserById(
      userId,
      {
        password: tempPassword,
      },
    );

    if (passwordError) {
      console.error("Failed to set temporary password:", passwordError);
      // パスワード設定に失敗した場合でも続行しますが、ログに記録します
    }

    // 6. Supabaseセッション作成
    const clientSupabase = await createClient();
    const { error: signInError } = await clientSupabase.auth.signInWithPassword(
      {
        email,
        password: tempPassword,
      },
    );

    if (signInError) {
      throw new Error("Supabaseログインに失敗しました");
    }

    // 7. リダイレクト先を返す
    const safeReturnUrl = validateReturnUrl(validatedReturnUrl || undefined);

    if (isNewUser) {
      return {
        success: true,
        redirectTo: "/settings/profile?new=true",
      };
    }

    return {
      success: true,
      redirectTo: safeReturnUrl || "/?login=success",
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "ログイン処理に失敗しました",
    };
  }
}

// 紹介コード処理
