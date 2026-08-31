import { assertUserActive } from "@/lib/services/user-status";
import { grantXp } from "@/lib/services/userLevel";
import { isLikeExpired } from "@/lib/utils/user-mission-likes";
import { createClient } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

export async function POST(request: NextRequest) {
  try {
    const { missionId } = await request.json();

    const authorization = request.headers.get("authorization");
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: "サーバー設定エラー" },
        { status: 500 },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authorization || "",
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    try {
      await assertUserActive(user.id);
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "アカウントが停止されています",
        },
        { status: 403 },
      );
    }

    const { data: mission } = await supabase
      .from("user_missions")
      .select("created_by, title, published_at")
      .eq("id", missionId)
      .single();

    if (mission?.created_by === user.id) {
      return NextResponse.json(
        { error: "自分のグッジョブにはいいねできません" },
        { status: 400 },
      );
    }

    if (isLikeExpired(mission?.published_at ?? null)) {
      return NextResponse.json(
        { error: "いいね可能期間（7日間）を過ぎています" },
        { status: 400 },
      );
    }

    const { data: existingLike } = await supabase
      .from("user_mission_likes")
      .select()
      .eq("user_mission_id", missionId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingLike) {
      await supabase
        .from("user_mission_likes")
        .delete()
        .eq("id", existingLike.id);

      await grantXp(
        user.id,
        -1,
        "USER_MISSION_LIKE_GIVEN",
        missionId,
        "ユーザーグッジョブのいいねを取り消しました",
      );

      if (mission) {
        await grantXp(
          mission.created_by,
          -1,
          "USER_MISSION_LIKES",
          `${missionId}:${user.id}`,
          `ユーザーグッジョブ「${mission.title}」のいいねが取り消されました`,
        );
      }

      return NextResponse.json({ liked: false });
    }

    await supabase.from("user_mission_likes").insert({
      user_mission_id: missionId,
      user_id: user.id,
    });

    await grantXp(
      user.id,
      1,
      "USER_MISSION_LIKE_GIVEN",
      missionId,
      "ユーザーグッジョブにいいねしました",
    );

    if (mission) {
      await grantXp(
        mission.created_by,
        1,
        "USER_MISSION_LIKES",
        `${missionId}:${user.id}`,
        `ユーザーグッジョブ「${mission.title}」がいいねを獲得`,
      );
    }

    if (process.env.SLACK_WEBHOOK_URL && mission) {
      const { data: likerData } = await supabase
        .from("private_users")
        .select("name")
        .eq("id", user.id)
        .single();

      const { data: creatorData } = await supabase
        .from("private_users")
        .select("name")
        .eq("id", mission.created_by)
        .single();

      fetch(new URL("/api/slack-notification", request.url).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "user_mission_liked",
          data: {
            title: mission.title,
            likerName: likerData?.name || "不明なユーザー",
            creatorName: creatorData?.name || "不明なユーザー",
          },
        }),
      }).catch((error) => console.error("Slack通知エラー（非同期）:", error));
    }

    return NextResponse.json({ liked: true });
  } catch (error) {
    console.error("APIルートエラー:", error);
    return NextResponse.json(
      { error: "いいね処理に失敗しました" },
      { status: 500 },
    );
  }
}
