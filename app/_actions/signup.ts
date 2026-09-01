"use server";

// Edge Runtime互換のCrypto APIを使用
import {
  getOrInitializeUserLevel,
  grantMissionCompletionXp,
} from "@/lib/services/userLevel";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { deleteCookie, getCookie } from "@/lib/utils/server-cookies";
import { encodedRedirect } from "@/lib/utils/utils";
import { signUpAndLoginFormSchema } from "@/lib/validation/auth";
import { headers } from "next/headers";

import {
  isEmailAlreadyUsedInReferral,
  isValidReferralCode,
} from "@/lib/validation/referral";

export const signUpActionWithState = async (
  prevState: {
    error?: string;
    success?: string;
    message?: string;
    formData?: {
      email: string;
      password: string;
      date_of_birth: string;
      terms_agreed: boolean;
      privacy_agreed: boolean;
    };
  } | null,
  formData: FormData,
) => {
  const email = formData.get("email")?.toString();
  const password = formData.get("password")?.toString();
  const date_of_birth = formData.get("date_of_birth")?.toString();
  const terms_agreed = formData.get("terms_agreed")?.toString();
  const privacy_agreed = formData.get("privacy_agreed")?.toString();

  //クエリストリングからリファラルコードを取得（フォームから）
  const rawReferral = formData.get("ref");
  let referralCode =
    typeof rawReferral === "string" ? rawReferral.trim() : null;

  // フォームにリファラルコードがない場合はcookieから取得
  if (!referralCode) {
    referralCode = (await getCookie("referral_code")) || null;
  }

  // フォームデータを保存（エラー時の状態復元用）
  const currentFormData = {
    email: email || "",
    password: password || "",
    date_of_birth: date_of_birth || "",
    terms_agreed: terms_agreed === "true",
    privacy_agreed: privacy_agreed === "true",
  };

  const validatedFields = signUpAndLoginFormSchema.safeParse({
    email,
    password,
  });
  if (!validatedFields.success) {
    return {
      error: validatedFields.error.errors
        .map((error) => error.message)
        .join("\n"),
      formData: currentFormData,
    };
  }

  const supabase = await createClient();
  const origin = (await headers()).get("origin");

  const normalizedEmail = validatedFields.data.email;
  const validatedPassword = validatedFields.data.password;

  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password: validatedPassword,
    options: {
      data: {
        ...(date_of_birth ? { date_of_birth } : {}),
      },
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  // エラーチェック
  if (error) {
    return {
      error: `ユーザー登録に失敗しました: ${error.message}`,
      formData: currentFormData,
    };
  }

  // サインアップ完了後にuserIdを取得（型安全に）
  const userId = data?.user?.id;
  if (!userId) {
    return { error: "ユーザー登録に失敗しました", formData: currentFormData };
  }

  //紹介URLから遷移した場合のみ以下を実行
  if (referralCode) {
    const serviceSupabase = await createServiceClient();
    let shouldInsertReferral = false;
    let referrerUserId: string | null = null;
    let referralMissionId: string | null = null;

    try {
      const [isValid, isDuplicate] = await Promise.all([
        isValidReferralCode(referralCode),
        isEmailAlreadyUsedInReferral(normalizedEmail),
      ]);

      if (isValid && !isDuplicate) {
        const { data: mission } = await serviceSupabase
          .from("missions")
          .select("id")
          .eq("required_artifact_type", "REFERRAL")
          .maybeSingle();

        const { data: referrerRecord } = await serviceSupabase
          .from("user_referral")
          .select("user_id")
          .eq("referral_code", referralCode)
          .maybeSingle();

        if (mission && referrerRecord?.user_id) {
          shouldInsertReferral = true;
          referrerUserId = referrerRecord.user_id;
          referralMissionId = mission.id;
        }
      }
    } catch (e) {
      // ログだけ残す（ユーザーには知らせない）
      console.warn("紹介コード処理エラー:", e);
    }

    if (shouldInsertReferral && referrerUserId && referralMissionId) {
      try {
        const { data: achievement, error: achievementError } =
          await serviceSupabase
            .from("achievements")
            .insert({
              user_id: referrerUserId,
              mission_id: referralMissionId,
            })
            .select("id")
            .single();

        if (achievement && !achievementError) {
          await serviceSupabase.from("mission_artifacts").insert({
            user_id: referrerUserId,
            achievement_id: achievement.id,
            artifact_type: "REFERRAL",
            text_content: normalizedEmail,
          });
          // グッジョブ達成時にXPを付与
          await grantMissionCompletionXp(
            referrerUserId,
            referralMissionId,
            achievement.id,
          );
        } else {
          console.warn("achievements挿入エラー:", achievementError);
        }
      } catch (e) {
        console.warn("紹介グッジョブ登録処理に失敗:", e);
      }
    }

    // 紹介コード処理完了後、cookieを削除
    await deleteCookie("referral_code");
  }

  // userIdは104行目で既に取得・チェック済み
  if (userId) {
    try {
      await getOrInitializeUserLevel(userId);

      // 外部ユーザー用の保留ポイントを付与
      const serviceSupabase = await createServiceClient();

      // ユーザー名を取得
      const { data: userProfile } = await serviceSupabase
        .from("private_users")
        .select("name")
        .eq("id", userId)
        .maybeSingle();

      if (userProfile?.name) {
        // 名前で保留ポイントを検索
        const { data: pendingXpRecords, error: pendingXpError } =
          await serviceSupabase
            .from("external_user_pending_xp")
            .select("*")
            .eq("external_user_name", userProfile.name)
            .is("claimed_at", null);

        if (
          !pendingXpError &&
          pendingXpRecords &&
          pendingXpRecords.length > 0
        ) {
          // 保留ポイントをxp_transactionsに変換
          const xpTransactions = pendingXpRecords.map((record) => ({
            user_id: userId,
            xp_amount: record.xp_amount,
            source_type: "USER_MISSION_PRAISED_EXTERNAL",
            source_id: record.user_mission_id,
            description:
              record.description ||
              "ユーザーグッジョブで賞賛されました（登録後に付与）",
          }));

          // xp_transactionsに挿入
          const { error: xpInsertError } = await serviceSupabase
            .from("xp_transactions")
            .insert(xpTransactions);

          if (!xpInsertError) {
            // 保留ポイントを付与済みに更新
            const recordIds = pendingXpRecords.map((r) => r.id);
            await serviceSupabase
              .from("external_user_pending_xp")
              .update({
                claimed_at: new Date().toISOString(),
                claimed_by_user_id: userId,
              })
              .in("id", recordIds);

            console.log(
              `外部ユーザー ${userProfile.name} に ${xpTransactions.length}件の保留ポイントを付与しました`,
            );
          } else {
            console.error("保留ポイントの付与エラー:", xpInsertError);
          }
        }
      }
    } catch (levelError) {
      console.error("Failed to initialize user level:", levelError);
    }
  }

  // 成功時はリダイレクトする
  return encodedRedirect("success", "/sign-up-success", "登録が完了しました。");
};

// useActionState用のサインインアクション

export const emailSignUpActionWithState = async (
  prevState: {
    error?: string;
    success?: string;
    message?: string;
    formData?: {
      email: string;
      password: string;
    };
  } | null,
  formData: FormData,
) => {
  const email = formData.get("email")?.toString();
  const password = formData.get("password")?.toString();
  const dateOfBirth = formData.get("date_of_birth")?.toString();
  const referralCode = formData.get("ref")?.toString();

  const newFormData = new FormData();
  newFormData.set("email", email || "");
  newFormData.set("password", password || "");
  if (dateOfBirth) {
    newFormData.set("date_of_birth", dateOfBirth);
  }
  newFormData.set("terms_agreed", "true");
  newFormData.set("privacy_agreed", "true");
  if (referralCode) {
    newFormData.set("ref", referralCode);
  }

  return signUpActionWithState(null, newFormData);
};

// LINE認証処理のServer Action
