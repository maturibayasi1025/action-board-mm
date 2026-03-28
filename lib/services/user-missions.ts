import { createClient } from "@/lib/supabase/client";
import type { PraisedUser } from "@/lib/types/user-missions";
import { excludeCreatorFromPraisedUserIds } from "@/lib/utils/user-mission-praised";

export interface CreateUserMissionInput {
  title: string;
  content: string;
  praisedUserIds: string[];
  praisedExternalUserNames?: string[];
  mvvItems: {
    passionateExecution: boolean;
    supremeRelationships: boolean;
    happinessCirculation: boolean;
  };
}

export interface UserMission {
  id: string;
  createdBy: string;
  title: string;
  content: string;
  praisedUsers: string[];
  praisedExternalUsers?: string[];
  status: "pending" | "approved" | "rejected";
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
  approvedBy?: string;
  publicMissionId?: string;
  likesCount: number;
  mvvItems: {
    passionateExecution: boolean;
    supremeRelationships: boolean;
    happinessCirculation: boolean;
  };
  isLikedByCurrentUser?: boolean;
}

export async function createUserMission(input: CreateUserMissionInput) {
  const supabase = createClient();

  try {
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

    // トランザクション的な処理のため、まずグッジョブを作成（即時承認）
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

      // エラーコードに応じた適切なメッセージ
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
        // MVV項目の挿入に失敗した場合、グッジョブも削除（ロールバック的な処理）
        await supabase.from("user_missions").delete().eq("id", mission.id);
        throw new Error(`MVV項目の保存に失敗しました: ${mvvError.message}`);
      }
    }

    // 賞賛対象者を挿入
    const praisedUserIdsSafe = excludeCreatorFromPraisedUserIds(
      input.praisedUserIds ?? [],
      user.id,
    );
    if (praisedUserIdsSafe.length > 0) {
      const praisedUsers = praisedUserIdsSafe.map((userId) => ({
        user_mission_id: mission.id,
        praised_user_id: userId,
      }));

      const { error: praisedError } = await supabase
        .from("user_mission_praised_users")
        .insert(praisedUsers);

      if (praisedError) {
        console.error("賞賛対象者の挿入エラー:", praisedError);
        // 賞賛対象者の挿入に失敗した場合、グッジョブも削除（ロールバック的な処理）
        await supabase.from("user_missions").delete().eq("id", mission.id);
        throw new Error(
          `賞賛対象者の保存に失敗しました: ${praisedError.message}`,
        );
      }
    }

    // Slack通知を送信
    try {
      await sendSlackNotification({
        id: mission.id,
        title: mission.title,
        content: mission.content,
        created_by: mission.created_by,
        created_at: mission.created_at,
      });
    } catch (slackError) {
      console.error("Slack通知エラー:", slackError);
      // Slack通知失敗は致命的でないため、処理を続行
    }

    return mission;
  } catch (error) {
    console.error("createUserMission総合エラー:", error);
    throw error;
  }
}

export async function getUserMissions(userId?: string) {
  try {
    const supabase = createClient();

    let query = supabase
      .from("user_missions")
      .select(`
        *,
        user_mission_mvv_items (
          mvv_type
        ),
        user_mission_likes (
          user_id
        ),
        user_mission_praised_users (
          praised_user_id,
          private_users!praised_user_id (
            name
          )
        ),
        user_mission_praised_external_users (
          praised_person_name
        )
      `)
      .order("published_at", { ascending: false, nullsFirst: false });

    if (userId) {
      query = query.eq("created_by", userId);
    } else {
      // ユーザーIDが指定されていない場合は承認済みのみ表示
      query = query.eq("status", "approved");
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching user missions:", {
        error: error,
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        userId: userId,
      });
      throw error;
    }

    // データを整形
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!data) return [];

    return data.map(
      (mission): UserMission => ({
        id: mission.id,
        createdBy: mission.created_by,
        title: mission.title,
        content: mission.content,
        praisedUsers:
          mission.user_mission_praised_users
            ?.map(
              (p: unknown) => (p as unknown as PraisedUser).private_users?.name,
            )
            .filter((name: string | undefined): name is string =>
              Boolean(name),
            ) || [],
        praisedExternalUsers:
          mission.user_mission_praised_external_users?.map(
            (p: { praised_person_name: string }) => p.praised_person_name,
          ) || [],
        status: mission.status as "pending" | "approved" | "rejected",
        rejectionReason: mission.rejection_reason || undefined,
        createdAt: mission.created_at,
        updatedAt: mission.updated_at,
        approvedAt: mission.approved_at || undefined,
        approvedBy: mission.approved_by || undefined,
        publicMissionId: mission.public_mission_id || undefined,
        likesCount: mission.likes_count,
        mvvItems: {
          passionateExecution:
            mission.user_mission_mvv_items?.some(
              (item: unknown) =>
                (item as unknown as { mvv_type: string }).mvv_type ===
                "passionate_execution",
            ) || false,
          supremeRelationships:
            mission.user_mission_mvv_items?.some(
              (item: unknown) =>
                (item as unknown as { mvv_type: string }).mvv_type ===
                "supreme_relationships",
            ) || false,
          happinessCirculation:
            mission.user_mission_mvv_items?.some(
              (item: unknown) =>
                (item as unknown as { mvv_type: string }).mvv_type ===
                "happiness_circulation",
            ) || false,
        },
        isLikedByCurrentUser: user
          ? mission.user_mission_likes?.some(
              (like: unknown) =>
                (like as unknown as { user_id: string }).user_id === user.id,
            ) || false
          : false,
      }),
    );
  } catch (error) {
    console.error("Error in getUserMissions:", error);
    return [];
  }
}

export async function toggleLike(missionId: string) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("ユーザーが認証されていません");

  // 既存のいいねをチェック
  const { data: existingLike } = await supabase
    .from("user_mission_likes")
    .select()
    .eq("user_mission_id", missionId)
    .eq("user_id", user.id)
    .single();

  if (existingLike) {
    // いいねを削除
    const { error } = await supabase
      .from("user_mission_likes")
      .delete()
      .eq("id", existingLike.id);

    if (error) throw error;
    return { liked: false };
  }

  // いいねを追加
  const { error } = await supabase.from("user_mission_likes").insert({
    user_mission_id: missionId,
    user_id: user.id,
  });

  if (error) throw error;

  // いいね数に基づいてXPを付与
  await checkAndAwardXP(missionId);

  return { liked: true };
}

async function checkAndAwardXP(missionId: string) {
  const supabase = createClient();

  // グッジョブの詳細といいね数を取得
  const { data: mission, error } = await supabase
    .from("user_missions")
    .select("*, user_mission_likes(count)")
    .eq("id", missionId)
    .single();

  if (error || !mission) return;

  const likesCount = mission.user_mission_likes[0]?.count || 0;

  // 10いいねごとにXPを付与
  const xpMilestones = [10, 25, 50, 100];
  const xpRewards = [50, 100, 200, 500];

  for (let i = 0; i < xpMilestones.length; i++) {
    if (likesCount === xpMilestones[i]) {
      // source_idにマイルストーン情報を含めることで、同じマイルストーンに対して重複してXPが付与されることを防止
      const sourceId = `${missionId}:milestone:${xpMilestones[i]}`;

      // XPトランザクションが既に存在するかチェック
      const { data: existingXP } = await supabase
        .from("xp_transactions")
        .select()
        .eq("source_type", "USER_MISSION_LIKES")
        .eq("source_id", sourceId)
        .single();

      if (!existingXP) {
        // XPを付与
        await supabase.from("xp_transactions").insert({
          user_id: mission.created_by,
          xp_amount: xpRewards[i],
          source_type: "USER_MISSION_LIKES",
          source_id: sourceId,
          description: `ユーザーグッジョブ「${mission.title}」が${xpMilestones[i]}いいねを獲得`,
        });
      }
      break;
    }
  }
}

async function sendSlackNotification(mission: {
  id: string;
  title: string;
  content: string;
  created_by: string;
  created_at: string;
}) {
  try {
    // Slack WebhookのURLは環境変数から取得
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) {
      console.warn("Slack Webhook URLが設定されていません");
      return;
    }

    // 賞賛対象者の情報を取得
    const supabase = createClient();
    const { data: praisedUsers } = await supabase
      .from("user_mission_praised_users")
      .select(`
        private_users!praised_user_id (
          name
        )
      `)
      .eq("user_mission_id", mission.id);

    const praisedUserNames =
      praisedUsers
        ?.map((p) => (p as unknown as PraisedUser).private_users?.name)
        .filter((name: string | undefined): name is string => Boolean(name)) ||
      [];

    const message = {
      text: "新しいユーザーグッジョブが作成されました",
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "🎯 新しいユーザーグッジョブ",
          },
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*タイトル:*\n${mission.title}`,
            },
            {
              type: "mrkdwn",
              text: `*賞賛対象:*\n${praisedUserNames.join(", ")}`,
            },
          ],
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*内容:*\n${mission.content}`,
          },
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `作成日時: ${new Date(mission.created_at).toLocaleString("ja-JP")}`,
            },
          ],
        },
      ],
    };

    // Next.js APIルートを経由してSlackに通知
    await fetch("/api/slack-notification", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message }),
    });
  } catch (error) {
    console.error("Slack通知の送信に失敗しました:", error);
  }
}
