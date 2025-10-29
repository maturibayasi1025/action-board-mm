import { PREFECTURES } from "@/lib/address";
import { AVATAR_MAX_FILE_SIZE } from "@/lib/avatar";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "edge";

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

export async function POST(request: NextRequest) {
  try {
    console.log("[Update Profile API] Starting profile update");

    const supabaseClient = await createClient();
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      console.error("[Update Profile API] User not found");
      return NextResponse.json(
        { success: false, error: "認証が必要です" },
        { status: 401 },
      );
    }

    console.log("[Update Profile API] User authenticated:", {
      userId: user.id,
    });

    const formData = await request.formData();

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
      return NextResponse.json({
        success: false,
        error: validatedFields.error.errors
          .map((error) => error.message)
          .join("\n"),
      });
    }

    // バリデーション済みのデータを使用
    const validatedData = validatedFields.data;

    // 先にユーザー情報を取得
    const { data: privateUser, error: privateUserFetchError } =
      await supabaseClient
        .from("private_users")
        .select("*")
        .eq("id", user.id)
        .single();

    // privateUser取得時のエラーログ（PGRST116は新規ユーザーなので問題なし）
    if (privateUserFetchError && privateUserFetchError.code !== "PGRST116") {
      console.error("[Update Profile API] Error fetching private user:", {
        code: privateUserFetchError.code,
        message: privateUserFetchError.message,
        details: privateUserFetchError.details,
        userId: user.id,
      });
    }

    // フォームから送信されたavatar_url
    let avatar_path = formData.get("avatar_path") as string | null;

    // 空文字をnullとして扱う
    if (avatar_path === "") {
      avatar_path = null;
    }

    // 以前の画像URL
    const previousAvatarUrl = privateUser?.avatar_url || null;

    // avatar_pathが未設定の場合、既存の画像パスを使用
    if (!avatar_path) {
      avatar_path = previousAvatarUrl;
    }

    console.log("[Update Profile API] Avatar paths:", {
      fromForm: formData.get("avatar_path"),
      previous: previousAvatarUrl,
      current: avatar_path,
    });

    // 画像ファイルが送信されているか確認
    const avatar_file = formData.get("avatar") as File | null;

    // 画像ファイルのバリデーション
    if (avatar_file && avatar_file.size > 0) {
      // ファイルサイズのチェック
      if (avatar_file.size > AVATAR_MAX_FILE_SIZE) {
        return NextResponse.json({
          success: false,
          error: "画像ファイルのサイズは5MB以下にしてください",
        });
      }

      // ファイルタイプのチェック
      const allowedTypes = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp",
      ];
      if (!allowedTypes.includes(avatar_file.type)) {
        return NextResponse.json({
          success: false,
          error: "対応している画像形式はJPEG、PNG、WebPです",
        });
      }
    }

    // 古い画像を削除するかチェック
    const shouldDeleteOldAvatar =
      previousAvatarUrl &&
      (avatar_path === null || (avatar_file && avatar_file.size > 0));

    if (shouldDeleteOldAvatar) {
      try {
        const pathMatch = previousAvatarUrl.match(/\/avatars\/(.+)$/);
        if (pathMatch?.[1]) {
          const filePath = pathMatch[1];
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
      }
    }

    // 新しい画像をアップロード
    if (avatar_file && avatar_file.size > 0) {
      try {
        const userId = user.id;
        const fileExt = avatar_file.name.split(".").pop();
        const fileName = `${userId}/${Date.now()}.${fileExt}`;
        const fileBuffer = await avatar_file.arrayBuffer();

        const { error } = await supabaseClient.storage
          .from("avatars")
          .upload(fileName, fileBuffer, {
            contentType: avatar_file.type,
            upsert: true,
          });

        if (error) {
          console.error("Upload error:", error);
        }
        avatar_path = fileName;
        console.log("[Update Profile API] Avatar uploaded successfully:", {
          fileName,
          avatar_path,
        });
      } catch (error) {
        console.error("Avatar upload error during profile update:", error);
      }
    }

    // private_users テーブルを更新
    if (!privateUser) {
      console.log("[Update Profile API] Inserting new private_user");
      const { error: privateUserError } = await supabaseClient
        .from("private_users")
        .insert({
          id: user.id,
          name: validatedData.name,
          address_prefecture: validatedData.address_prefecture,
          date_of_birth: validatedData.date_of_birth,
          x_username: validatedData.x_username || null,
          avatar_url: avatar_path,
          hubspot_contact_id: null,
          updated_at: new Date().toISOString(),
        });
      if (privateUserError) {
        console.error("[Update Profile API] Error inserting private_user:", {
          code: privateUserError.code,
          message: privateUserError.message,
          details: privateUserError.details,
        });
        return NextResponse.json({
          success: false,
          error: "ユーザー情報の登録に失敗しました",
        });
      }
      console.log("[Update Profile API] Successfully inserted private_user");
    } else {
      console.log("[Update Profile API] Updating existing private_user");
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
        console.error("[Update Profile API] Error updating private_user:", {
          code: privateUserError.code,
          message: privateUserError.message,
          details: privateUserError.details,
        });
        return NextResponse.json({
          success: false,
          error: "ユーザー情報の更新に失敗しました",
        });
      }
      console.log("[Update Profile API] Successfully updated private_user");
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
        // Edge Runtime対応: Web Crypto APIを使用してランダムコードを生成
        const array = new Uint8Array(8);
        crypto.getRandomValues(array);
        const referralCode = Array.from(array, (byte) =>
          byte.toString(16).padStart(2, "0"),
        )
          .join("")
          .substring(0, 8);

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
        return NextResponse.json({
          success: false,
          error: "紹介コードの登録に失敗しました。（重複によるリトライ上限）",
        });
      }
    }

    console.log("[Update Profile API] Profile update completed successfully");
    console.log("[Update Profile API] Final avatar_path:", avatar_path);

    // キャッシュを無効化
    revalidatePath("/settings/profile");

    console.log("[Update Profile API] Returning success response");

    return NextResponse.json({
      success: true,
      avatar_path: avatar_path, // 新しい画像パスを返す
    });
  } catch (error) {
    console.error("[Update Profile API] Caught exception:", {
      error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json({
      success: false,
      error: `プロフィール更新中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}
