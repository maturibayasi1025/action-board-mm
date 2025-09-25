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

    // グッジョブの作成者を確認
    const { data: mission } = await supabase
      .from("user_missions")
      .select("created_by")
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

      return NextResponse.json({ liked: false });
    }

    // いいね追加
    await supabase.from("user_mission_likes").insert({
      user_mission_id: missionId,
      user_id: user.id,
    });

    return NextResponse.json({ liked: true });
  } catch (error) {
    console.error("APIルートエラー:", error);
    return NextResponse.json(
      { error: "いいね処理に失敗しました" },
      { status: 500 },
    );
  }
}
