"use server";

import { PREFECTURES } from "@/lib/address";
import { AVATAR_MAX_FILE_SIZE } from "@/lib/avatar";
import { sendWelcomeMail } from "@/lib/mail";
import { createOrUpdateHubSpotContact } from "@/lib/services/hubspot";
import { createClient } from "@/lib/supabase/server";
import { encodedRedirect } from "@/lib/utils/utils";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

export type UpdateProfileResult = {
  success: boolean;
  error?: string;
};

export type UploadAvatarResult = {
  success: boolean;
  avatarPath?: string;
  error?: string;
};

const updateProfileFormSchema = z.object({
  name: z
    .string()
    .nonempty({ message: "ニックネームを入力してください" })
    .max(100, { message: "ニックネームは100文字以内で入力してください" }),
  address_prefecture: z
    .string()
    .nonempty({ message: "都道府県を選択してください" })
    .refine((val) => PREFECTURES.includes(val), {
      message: "有効な都道府県を選択してください",
    }),
  date_of_birth: z
    .string()
    .nonempty({ message: "生年月日を入力してください" })
    .regex(/^\d{4}-\d{2}-\d{2}$/, {
      message: "生年月日はYYYY-MM-DD形式で入力してください",
    }),
  x_username: z
    .string()
    .max(50, { message: "Xユーザー名は50文字以内で入力してください" })
    .optional(),
  github_username: z
    .string()
    .max(39, { message: "GitHubユーザー名は39文字以内で入力してください" })
    .optional(),
});

export async function updateProfile(
  previousState: UpdateProfileResult | null,
  formData: FormData,
): Promise<UpdateProfileResult | null> {
  try {
    console.log("[Update Profile] Starting profile update");
    const supabaseClient = await createClient();
    console.log("[Update Profile] Supabase client created");

    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      console.error("[Update Profile] User not found");
      return redirect("/sign-in");
    }

    console.log("[Update Profile] User authenticated:", { userId: user.id });

    // フォームデータの取得
    const name = formData.get("name")?.toString();
    const address_prefecture = formData.get("address_prefecture")?.toString();
    const date_of_birth = formData.get("date_of_birth")?.toString();
    const x_username = formData.get("x_username")?.toString() || "";
    const github_username = formData.get("github_username")?.toString() || "";

    // バリデーション
    const validatedFields = updateProfileFormSchema.safeParse({
      name,
      address_prefecture,
      date_of_birth,
      x_username,
      github_username,
    });

    if (!validatedFields.success) {
      return {
        success: false,
        error: validatedFields.error.errors
          .map((error) => error.message)
          .join("\n"),
      };
    }

    // バリデーション済みのデータを使用
    const validatedData = validatedFields.data;

    // 先にユーザー情報を取得
    const { data: authUser } = await supabaseClient.auth.getUser();
    const { data: privateUser, error: privateUserFetchError } =
      await supabaseClient
        .from("private_users")
        .select("*")
        .eq("id", user.id)
        .single();

    if (!authUser) {
      console.error("[Update Profile] Auth user not found");
      return encodedRedirect("error", "/sign-in", "ユーザーが見つかりません");
    }

    // privateUser取得時のエラーログ（PGRST116は新規ユーザーなので問題なし）
    if (privateUserFetchError && privateUserFetchError.code !== "PGRST116") {
      console.error("[Update Profile] Error fetching private user:", {
        code: privateUserFetchError.code,
        message: privateUserFetchError.message,
        details: privateUserFetchError.details,
        userId: user.id,
      });
      // エラーがあっても新規登録の可能性があるので処理継続
    }

    // フォームから送信されたavatar_url
    let avatar_path = formData.get("avatar_path") as string | null;

    // 以前の画像URL
    const previousAvatarUrl = privateUser?.avatar_url || null;

    // 画像ファイルが送信されているか確認
    const avatar_file = formData.get("avatar") as File | null;

    // 画像ファイルのバリデーション
    if (avatar_file && avatar_file.size > 0) {
      // ファイルサイズのチェック
      if (avatar_file.size > AVATAR_MAX_FILE_SIZE) {
        return {
          success: false,
          error: "画像ファイルのサイズは5MB以下にしてください",
        };
      }

      // ファイルタイプのチェック
      const allowedTypes = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp",
      ];
      if (!allowedTypes.includes(avatar_file.type)) {
        return {
          success: false,
          error: "対応している画像形式はJPEG、PNG、WebPです",
        };
      }
    }

    // 古い画像を削除するかチェック:
    // 1. 画像が削除された場合（avatar_urlがnullになった）
    // 2. 新しい画像がアップロードされる場合
    const shouldDeleteOldAvatar =
      previousAvatarUrl &&
      (avatar_path === null || (avatar_file && avatar_file.size > 0));

    if (shouldDeleteOldAvatar) {
      try {
        // URLからファイルパスを抽出
        // 例: https://xxxx.supabase.co/storage/v1/object/public/avatars/userid/12345.jpg
        const pathMatch = previousAvatarUrl.match(/\/avatars\/(.+)$/);

        if (pathMatch?.[1]) {
          const filePath = pathMatch[1];
          // 古い画像をストレージから削除
          const { error: deleteError } = await supabaseClient.storage
            .from("avatars")
            .remove([filePath]);

          if (deleteError) {
            console.error("Error deleting old avatar:", deleteError);
          } else {
            console.log("Successfully deleted old avatar:", filePath);
          }
        }
      } catch (error) {
        console.error("Error deleting old avatar:", error);
        // 画像削除に失敗しても、更新処理は継続する
      }
    }

    // 新しい画像をアップロード
    if (avatar_file && avatar_file.size > 0) {
      try {
        // ユーザーIDを取得
        const userId = privateUser?.id || crypto.randomUUID();

        // ファイル名の生成
        const fileExt = avatar_file.name.split(".").pop();
        const fileName = `${userId}/${Date.now()}.${fileExt}`;

        // ファイルのバイナリデータを取得
        const fileBuffer = await avatar_file.arrayBuffer();

        // Supabase Storageにアップロード
        const { error } = await supabaseClient.storage
          .from("avatars")
          .upload(fileName, fileBuffer, {
            contentType: avatar_file.type,
            upsert: true,
          });

        if (error) {
          console.error("Upload error:", error);
          // アップロードに失敗しても、他のプロフィール情報は更新を続ける
        } else {
          // 公開URLを取得して保存用に設定
          const { data } = supabaseClient.storage
            .from("avatars")
            .getPublicUrl(fileName);
        }
        avatar_path = fileName;
      } catch (error) {
        console.error("Avatar upload error during profile update:", error);
        // エラーがあっても他のプロフィール情報の更新は続ける
      }
    }

    const hubspot_contact_id = privateUser?.hubspot_contact_id || null;

    // private_users テーブルを更新
    if (!privateUser) {
      console.log("[Update Profile] Inserting new private_user");
      const { error: privateUserError } = await supabaseClient
        .from("private_users")
        .insert({
          id: user.id,
          name: validatedData.name,
          address_prefecture: validatedData.address_prefecture,
          date_of_birth: validatedData.date_of_birth,
          x_username: validatedData.x_username || null,
          avatar_url: avatar_path,
          hubspot_contact_id: null, // 初期値はnull、HubSpot連携後に更新
          updated_at: new Date().toISOString(),
        });
      if (privateUserError) {
        console.error("[Update Profile] Error inserting private_user:", {
          code: privateUserError.code,
          message: privateUserError.message,
          details: privateUserError.details,
        });
        return {
          success: false,
          error: "ユーザー情報の登録に失敗しました",
        };
      }
      console.log("[Update Profile] Successfully inserted private_user");

      // public_user_profilesへの挿入はトリガー関数(sync_public_user_profile)に任せる
      // トリガーがprivate_usersのINSERT/UPDATEを検知して自動的にpublic_user_profilesを更新する

      try {
        if (user.email) {
          await sendWelcomeMail(user.email);
        }
      } catch (e) {
        console.error("案内メール送信失敗:", e);
      }
    } else {
      console.log("[Update Profile] Updating existing private_user");
      const { error: privateUserError } = await supabaseClient
        .from("private_users")
        .update({
          name: validatedData.name,
          address_prefecture: validatedData.address_prefecture,
          date_of_birth: validatedData.date_of_birth,
          x_username: validatedData.x_username || null,
          avatar_url: avatar_path,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);
      if (privateUserError) {
        console.error("[Update Profile] Error updating private_user:", {
          code: privateUserError.code,
          message: privateUserError.message,
          details: privateUserError.details,
        });
        return {
          success: false,
          error: "ユーザー情報の更新に失敗しました",
        };
      }
      console.log("[Update Profile] Successfully updated private_user");

      // public_user_profilesの更新はトリガー関数に任せる
      // private_usersの更新時にトリガーが自動的にpublic_user_profilesを同期する
      console.log("[Update Profile] Trigger will sync public_user_profiles");
    }

    // HubSpot連携処理（プロフィール更新成功後に実行）
    try {
      const hubspotResult = await createOrUpdateHubSpotContact(
        {
          email: user.email || "",
          firstname: user.email || "", // firstnameにもemailを設定
        },
        hubspot_contact_id,
      );

      if (hubspotResult.success) {
        // HubSpot連携成功時、コンタクトIDをデータベースに保存
        const { error: updateHubSpotIdError } = await supabaseClient
          .from("private_users")
          .update({ hubspot_contact_id: hubspotResult.contactId })
          .eq("id", user.id);

        if (updateHubSpotIdError) {
          console.error(
            "Error updating hubspot_contact_id:",
            updateHubSpotIdError,
          );
        } else {
          console.log(
            "HubSpot contact ID updated successfully:",
            hubspotResult.contactId,
          );
        }
      } else {
        console.error("HubSpot integration failed:", hubspotResult.error);
        // HubSpot連携に失敗してもプロフィール更新は成功として扱う
      }
    } catch (error) {
      console.error("HubSpot integration error:", error);
      // HubSpot連携エラーでもプロフィール更新は成功として扱う
    }

    // ユーザー別紹介コードの登録処理（重複時は最大5回リトライ）
    const MAX_RETRY = 5;

    const { data: existingReferral } = await supabaseClient
      .from("user_referral")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!existingReferral) {
      let success = false;
      let lastError = null;

      for (let attempt = 0; attempt < MAX_RETRY; attempt++) {
        const referralCode = nanoid(8); // 8桁ランダムコード

        const { error: referralInsertError } = await supabaseClient
          .from("user_referral")
          .insert({
            user_id: user.id,
            referral_code: referralCode,
          });

        if (!referralInsertError) {
          success = true;
          break;
        }

        // 重複ならリトライ、それ以外なら終了
        if (referralInsertError.code !== "23505") {
          lastError = referralInsertError;
          break;
        }
      }

      if (!success) {
        console.error("紹介コード登録に失敗:", lastError);
        return {
          success: false,
          error: "紹介コードの登録に失敗しました。（重複によるリトライ上限）",
        };
      }
    }

    console.log("[Update Profile] Profile update completed successfully");

    // キャッシュを無効化してページを再読み込み
    console.log("[Update Profile] Revalidating path: /settings/profile");
    revalidatePath("/settings/profile");

    console.log("[Update Profile] Returning success response");

    return {
      success: true,
    };
  } catch (error) {
    console.error("[Update Profile] Caught exception:", {
      error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return {
      success: false,
      error: `プロフィール更新中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
