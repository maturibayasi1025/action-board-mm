"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface CreateUserMissionInput {
  title: string;
  content: string;
  praisedUserIds: string[];
  mvvItems: {
    passionateExecution: boolean;
    supremeRelationships: boolean;
    happinessCirculation: boolean;
  };
}

export async function createUserMissionAction(input: CreateUserMissionInput) {
  const supabase = await createClient();

  try {
    // 認証チェック
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error("認証エラー:", authError);
      throw new Error("認証に失敗しました。再ログインしてください。");
    }

    if (!user) {
      throw new Error(
        "ログインが必要です。ログインしてから再度お試しください。",
      );
    }

    console.log("認証済みユーザー:", user.id);

    // グッジョブ作成（即時承認）
    const { data: mission, error: missionError } = await supabase
      .from("user_missions")
      .insert({
        created_by: user.id,
        title: input.title,
        content: input.content,
        status: "approved", // 自動承認で即時表示
        approved_at: new Date().toISOString(),
        approved_by: user.id, // 自分自身を承認者として設定
      })
      .select()
      .single();

    if (missionError) {
      console.error("グッジョブ作成エラー:", {
        code: missionError.code,
        message: missionError.message,
        details: missionError.details,
        hint: missionError.hint,
      });

      if (missionError.code === "42501") {
        throw new Error("権限がありません。ログイン状態を確認してください。");
      }
      if (missionError.code === "23503") {
        throw new Error("データの整合性エラーが発生しました。");
      }
      throw new Error(`グッジョブ作成に失敗しました: ${missionError.message}`);
    }

    // MVV項目を挿入
    const mvvItems = [];
    if (input.mvvItems.passionateExecution) {
      mvvItems.push({
        user_mission_id: mission.id,
        mvv_type: "passionate_execution",
      });
    }
    if (input.mvvItems.supremeRelationships) {
      mvvItems.push({
        user_mission_id: mission.id,
        mvv_type: "supreme_relationships",
      });
    }
    if (input.mvvItems.happinessCirculation) {
      mvvItems.push({
        user_mission_id: mission.id,
        mvv_type: "happiness_circulation",
      });
    }

    if (mvvItems.length > 0) {
      const { error: mvvError } = await supabase
        .from("user_mission_mvv_items")
        .insert(mvvItems);

      if (mvvError) {
        console.error("MVV項目挿入エラー:", mvvError);
        // ロールバック
        await supabase.from("user_missions").delete().eq("id", mission.id);
        throw new Error(`MVV項目の保存に失敗しました: ${mvvError.message}`);
      }
    }

    // 賞賛対象ユーザーを挿入
    if (input.praisedUserIds.length > 0) {
      const praisedUsers = input.praisedUserIds.map((userId) => ({
        user_mission_id: mission.id,
        praised_user_id: userId,
      }));

      const { error: praisedError } = await supabase
        .from("user_mission_praised_users")
        .insert(praisedUsers);

      if (praisedError) {
        console.error("賞賛対象ユーザー挿入エラー:", praisedError);
        // ロールバック
        await supabase.from("user_missions").delete().eq("id", mission.id);
        throw new Error(
          `賞賛対象ユーザーの保存に失敗しました: ${praisedError.message}`,
        );
      }
    }

    // ポイント付与処理
    await awardPointsForMissionCreation(
      mission.id,
      user.id,
      input.praisedUserIds,
      supabase,
    );

    // Slack通知を送信（Cloudflare環境では無効化）
    if (process.env.NODE_ENV !== "production" && !process.env.CF_PAGES) {
      try {
        await sendSlackNotificationForMissionCreation(
          mission.id,
          input.title,
          input.content,
          user.id,
          input.praisedUserIds,
          supabase,
        );
      } catch (slackError) {
        console.error("Slack通知エラー（継続）:", slackError);
        // Slack通知失敗してもグッジョブ作成処理は継続
      }
    }

    // ページを再検証（Cloudflare Pages環境では無効化）
    if (!process.env.CF_PAGES) {
      try {
        revalidatePath("/user-missions");
        revalidatePath("/user-missions/my");
        revalidatePath("/");
      } catch (revalidateError) {
        console.error("Revalidate エラー（継続）:", revalidateError);
        // 再検証失敗してもグッジョブ作成処理は継続
      }
    }

    return { success: true, missionId: mission.id };
  } catch (error) {
    console.error("createUserMissionAction総合エラー:", error);
    throw error;
  }
}

export async function toggleLikeAction(missionId: string) {
  console.log(
    `[toggleLikeAction] 開始: missionId=${missionId}, CF_PAGES=${process.env.CF_PAGES}, NODE_ENV=${process.env.NODE_ENV}`,
  );

  const supabase = await createClient();

  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error("[toggleLikeAction] 認証エラー:", authError);
      throw new Error(`認証エラー: ${authError.message}`);
    }

    if (!user) {
      console.error("[toggleLikeAction] ユーザーが見つかりません");
      throw new Error("ログインが必要です");
    }

    console.log(`[toggleLikeAction] ユーザー認証成功: userId=${user.id}`);

    // グッジョブの作成者を確認
    const { data: mission, error: missionError } = await supabase
      .from("user_missions")
      .select("created_by")
      .eq("id", missionId)
      .single();

    if (missionError) {
      console.error("[toggleLikeAction] グッジョブ取得エラー:", missionError);
      throw new Error(
        `グッジョブ情報の取得に失敗しました: ${missionError.message}`,
      );
    }

    // 自分のグッジョブにはいいねできない
    if (mission.created_by === user.id) {
      throw new Error("自分のグッジョブにはいいねできません");
    }

    // 既存のいいねをチェック
    const { data: existingLike, error: checkError } = await supabase
      .from("user_mission_likes")
      .select()
      .eq("user_mission_id", missionId)
      .eq("user_id", user.id)
      .single();

    // single()はno rowsの場合エラーを返すため、PGRST116エラーは無視
    if (checkError && checkError.code !== "PGRST116") {
      console.error("[いいねチェックエラー]:", checkError);
      throw new Error(`いいね状態の確認に失敗: ${checkError.message}`);
    }

    if (existingLike) {
      console.log(`[いいね削除] likeId=${existingLike.id}`);
      // いいねを削除
      const { error } = await supabase
        .from("user_mission_likes")
        .delete()
        .eq("id", existingLike.id);

      if (error) {
        console.error("[いいね削除エラー]:", error);
        throw new Error(`いいね削除に失敗: ${error.message}`);
      }

      // いいね取り消し時のXP減算（オプション）
      await removeLikeGiverXP(missionId, user.id, supabase);

      // ページを再検証（Cloudflare Pages環境では無効化）
      if (!process.env.CF_PAGES) {
        try {
          revalidatePath("/user-missions");
          revalidatePath("/user-missions/my");
          revalidatePath("/");
        } catch (revalidateError) {
          console.error("Revalidate エラー（継続）:", revalidateError);
          // 再検証失敗してもいいね取り消し処理は継続
        }
      }

      console.log("[toggleLikeAction] 成功: liked=false");
      return { liked: false };
    }

    // いいねを追加
    console.log(`[いいね追加] missionId=${missionId}, userId=${user.id}`);
    const { error } = await supabase.from("user_mission_likes").insert({
      user_mission_id: missionId,
      user_id: user.id,
    });

    if (error) {
      console.error("[いいね追加エラー]:", error);
      throw new Error(`いいね追加に失敗: ${error.message}`);
    }

    // いいねしたユーザーにXPを付与
    await awardLikeGiverXP(missionId, user.id, supabase);

    // グッジョブ作成者にマイルストーンXPを付与
    await checkAndAwardMilestoneXP(missionId, supabase);

    // Slack通知を送信（Cloudflare環境では無効化）
    if (process.env.NODE_ENV !== "production" && !process.env.CF_PAGES) {
      try {
        await sendSlackNotificationForLike(missionId, user.id, supabase);
      } catch (slackError) {
        console.error("Slack通知エラー（継続）:", slackError);
        // Slack通知失敗してもいいね処理は継続
      }
    }

    // ページを再検証（Cloudflare Pages環境では無効化）
    if (!process.env.CF_PAGES) {
      try {
        revalidatePath("/user-missions");
        revalidatePath("/user-missions/my");
        revalidatePath("/");
      } catch (revalidateError) {
        console.error("Revalidate エラー（継続）:", revalidateError);
        // 再検証失敗してもいいね処理は継続
      }
    }

    console.log("[toggleLikeAction] 成功: liked=true");
    return { liked: true };
  } catch (error) {
    console.error("[toggleLikeAction] 総合エラー:", error);
    // エラーメッセージを適切に伝搬
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("いいね処理中に予期しないエラーが発生しました");
  }
}

// いいねをしたユーザーにXPを付与
// 新しいポイント設計: いいねしたユーザーに1ポイント
async function awardLikeGiverXP(
  missionId: string,
  userId: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  try {
    // 1いいねあたり1XPを付与
    await supabase.from("xp_transactions").insert({
      user_id: userId,
      xp_amount: 1,
      source_type: "USER_MISSION_LIKE_GIVEN",
      source_id: missionId,
      description: "ユーザーグッジョブにいいねしました",
    });

    console.log(`いいねユーザー ${userId} に1XPを付与しました`);
  } catch (error) {
    console.error("いいねユーザーXP付与エラー:", error);
    // エラーが発生してもいいね処理は続行
  }
}

// いいね取り消し時のXP減算
async function removeLikeGiverXP(
  missionId: string,
  userId: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  try {
    // いいね取り消しで-1XPを付与（減算）
    await supabase.from("xp_transactions").insert({
      user_id: userId,
      xp_amount: -1,
      source_type: "USER_MISSION_LIKE_GIVEN",
      source_id: missionId,
      description: "ユーザーグッジョブのいいねを取り消しました",
    });

    console.log(`いいね取り消しユーザー ${userId} から1XPを減算しました`);
  } catch (error) {
    console.error("いいね取り消しXP減算エラー:", error);
    // エラーが発生してもいいね取り消し処理は続行
  }
}

// グッジョブ作成者にマイルストーンXPを付与
// 新しいポイント設計: いいね数 × 1ポイントを作成者に付与
async function checkAndAwardMilestoneXP(
  missionId: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  // グッジョブの詳細といいね数を取得
  const { data: mission, error } = await supabase
    .from("user_missions")
    .select("*")
    .eq("id", missionId)
    .single();

  if (error || !mission) return;

  // いいねがつくたびに作成者に1ポイント付与
  await supabase.from("xp_transactions").insert({
    user_id: mission.created_by,
    xp_amount: 1,
    source_type: "USER_MISSION_LIKES",
    source_id: missionId,
    description: `ユーザーグッジョブ「${mission.title}」がいいねを獲得`,
  });
}

// グッジョブ作成時のポイント付与
async function awardPointsForMissionCreation(
  missionId: string,
  creatorId: string,
  praisedUserIds: string[],
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  try {
    // 作成者に5ポイント
    await supabase.from("xp_transactions").insert({
      user_id: creatorId,
      xp_amount: 5,
      source_type: "USER_MISSION_CREATION",
      source_id: missionId,
      description: "ユーザーグッジョブを作成しました",
    });

    // 賞賛対象者に各々5ポイント
    for (const userId of praisedUserIds) {
      if (userId === creatorId) continue;
      // 作成者には賞賛できない
      await supabase.from("xp_transactions").insert({
        user_id: userId,
        xp_amount: 5,
        source_type: "USER_MISSION_PRAISED",
        source_id: missionId,
        description: "ユーザーグッジョブで賞賛されました",
      });
    }
  } catch (error) {
    console.error("ポイント付与エラー:", error);
  }
}

// Slack通知（グッジョブ作成時）
async function sendSlackNotificationForMissionCreation(
  missionId: string,
  title: string,
  content: string,
  creatorId: string,
  praisedUserIds: string[],
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  try {
    // 作成者情報を取得
    const { data: creator } = await supabase
      .from("private_users")
      .select("name")
      .eq("id", creatorId)
      .single();

    // 賞賛対象者情報を取得
    const { data: praisedUsers } = await supabase
      .from("private_users")
      .select("name")
      .in("id", praisedUserIds);

    const praisedNames = praisedUsers?.map((u) => u.name).join(", ") || "";

    // Slack通知APIを呼び出し（サーバーサイド）
    const apiUrl =
      process.env.NEXT_PUBLIC_APP_ORIGIN || "http://localhost:3000";
    await fetch(`${apiUrl}/api/slack-notification`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "user_mission_created",
        data: {
          missionId,
          title,
          content,
          creatorName: creator?.name || "不明",
          praisedNames,
        },
      }),
    });
  } catch (error) {
    console.error("Slack通知エラー:", error);
  }
}

// Slack通知（いいね時）
async function sendSlackNotificationForLike(
  missionId: string,
  userId: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  try {
    // グッジョブ情報を取得
    const { data: mission } = await supabase
      .from("user_missions")
      .select("title, created_by")
      .eq("id", missionId)
      .single();

    // いいねしたユーザー情報を取得
    const { data: liker } = await supabase
      .from("private_users")
      .select("name")
      .eq("id", userId)
      .single();

    // 作成者情報を取得
    const { data: creator } = mission?.created_by
      ? await supabase
          .from("private_users")
          .select("name")
          .eq("id", mission.created_by)
          .single()
      : { data: null };

    // Slack通知APIを呼び出し（サーバーサイド）
    const apiUrl =
      process.env.NEXT_PUBLIC_APP_ORIGIN || "http://localhost:3000";
    await fetch(`${apiUrl}/api/slack-notification`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "user_mission_liked",
        data: {
          missionId,
          title: mission?.title || "",
          likerName: liker?.name || "不明",
          creatorName: creator?.name || "不明",
        },
      }),
    });
  } catch (error) {
    console.error("Slack通知エラー:", error);
  }
}
