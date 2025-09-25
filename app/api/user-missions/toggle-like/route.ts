import { createClient } from "@supabase/supabase-js";
// app/api/user-missions/toggle-like/route.ts
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

export async function POST(request: NextRequest) {
  try {
    const { missionId } = await request.json();

    // リクエストヘッダーから認証情報を取得
    const authorization = request.headers.get("authorization");
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: "サーバー設定エラー" },
        { status: 500 },
      );
    }

    // Edgeで動作するクライアント
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

    // 認証情報を確認
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // グッジョブの作成者とタイトルを確認
    const { data: mission } = await supabase
      .from("user_missions")
      .select("created_by, title")
      .eq("id", missionId)
      .single();

    if (mission?.created_by === user.id) {
      return NextResponse.json(
        { error: "自分のグッジョブにはいいねできません" },
        { status: 400 },
      );
    }

    // 既存のいいねをチェック
    const { data: existingLike } = await supabase
      .from("user_mission_likes")
      .select()
      .eq("user_mission_id", missionId)
      .eq("user_id", user.id)
      .maybeSingle(); // single()ではなくmaybeSingle()を使用

    if (existingLike) {
      // いいね削除
      await supabase
        .from("user_mission_likes")
        .delete()
        .eq("id", existingLike.id);

      // いいね取り消し時のXP減算
      await supabase.from("xp_transactions").insert({
        user_id: user.id,
        xp_amount: -1,
        source_type: "USER_MISSION_LIKE_GIVEN",
        source_id: missionId,
        description: "ユーザーグッジョブのいいねを取り消しました",
      });

      return NextResponse.json({ liked: false });
    }

    // いいね追加
    await supabase.from("user_mission_likes").insert({
      user_mission_id: missionId,
      user_id: user.id,
    });

    // いいね時のXP付与
    await supabase.from("xp_transactions").insert({
      user_id: user.id,
      xp_amount: 1,
      source_type: "USER_MISSION_LIKE_GIVEN",
      source_id: missionId,
      description: "ユーザーグッジョブにいいねしました",
    });

    // Slack通知を非同期で送信（Webhook URLが設定されている場合）
    if (process.env.SLACK_WEBHOOK_URL && mission) {
      // ユーザー情報を取得
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

      // 非同期でSlack通知を送信（レスポンスを待たない）
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
