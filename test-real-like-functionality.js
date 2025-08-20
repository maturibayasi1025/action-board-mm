const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  "http://127.0.0.1:54321",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0",
);

async function testRealLikeFunctionality() {
  console.log("🧪 実際のいいね機能のテスト\n");

  // 1. ログイン
  console.log("1️⃣ ユーザーログイン");
  const { data: authData, error: authError } =
    await supabase.auth.signInWithPassword({
      email: "tanaka.hanako@example.com",
      password: "password123",
    });

  if (authError) {
    console.error("❌ ログインエラー:", authError);
    return;
  }

  console.log("✅ ログイン成功:", authData.user.email);

  // 2. 利用可能なグッジョブを確認
  console.log("\n2️⃣ 利用可能なグッジョブ確認");
  const { data: missions, error: missionsError } = await supabase
    .from("user_missions")
    .select("id, title, likes_count, created_by")
    .eq("status", "approved")
    .neq("created_by", authData.user.id); // 自分以外が作成したグッジョブ

  if (missionsError || !missions?.length) {
    console.error("❌ グッジョブ取得エラー:", missionsError);
    return;
  }

  const targetMission = missions[0];
  console.log("✅ 対象グッジョブ:", targetMission.title);
  console.log("   現在のいいね数:", targetMission.likes_count);

  // 3. 既存のいいねを確認・削除
  console.log("\n3️⃣ 既存いいねチェック");
  const { data: existingLike } = await supabase
    .from("user_mission_likes")
    .select()
    .eq("user_mission_id", targetMission.id)
    .eq("user_id", authData.user.id)
    .single();

  if (existingLike) {
    console.log("既存のいいねを削除中...");
    await supabase
      .from("user_mission_likes")
      .delete()
      .eq("id", existingLike.id);
  }

  // 4. いいね追加（サーバーアクションをシミュレート）
  console.log("\n4️⃣ いいね追加（認証済みユーザー）");
  const { error: likeError } = await supabase
    .from("user_mission_likes")
    .insert({
      user_mission_id: targetMission.id,
      user_id: authData.user.id,
    });

  if (likeError) {
    console.error("❌ いいね追加エラー:", likeError);
    return;
  }

  console.log("✅ いいね追加成功");

  // 5. XPトランザクション追加（サーバーアクションをシミュレート）
  console.log("\n5️⃣ XPトランザクション追加");
  const { error: xpError } = await supabase.from("xp_transactions").insert({
    user_id: authData.user.id,
    xp_amount: 5,
    source_type: "USER_MISSION_LIKE_GIVEN",
    source_id: targetMission.id,
    description: "ユーザーグッジョブにいいねしました",
  });

  if (xpError) {
    console.error("❌ XP追加エラー:", xpError);
  } else {
    console.log("✅ XP追加成功");
  }

  // 6. いいね後のグッジョブ状態確認
  console.log("\n6️⃣ いいね後のグッジョブ確認");
  const { data: updatedMission, error: fetchError } = await supabase
    .from("user_missions")
    .select(`
      id,
      title,
      likes_count,
      user_mission_likes (
        user_id
      )
    `)
    .eq("id", targetMission.id)
    .single();

  if (fetchError) {
    console.error("❌ グッジョブ取得エラー:", fetchError);
  } else {
    console.log("✅ 更新後のグッジョブ状態:");
    console.log("   タイトル:", updatedMission.title);
    console.log("   likes_count:", updatedMission.likes_count);
    console.log("   実際のいいね数:", updatedMission.user_mission_likes.length);

    if (
      updatedMission.likes_count === updatedMission.user_mission_likes.length
    ) {
      console.log("🎉 likes_countと実際のいいね数が一致しています！");
    } else {
      console.log("⚠️  likes_countと実際のいいね数が不一致です");
    }
  }

  // 7. ユーザー情報もチェック（現在のユーザーがいいね済みか）
  console.log("\n7️⃣ 現在のユーザーのいいね状態");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isLikedByCurrentUser = updatedMission.user_mission_likes?.some(
    (like) => like.user_id === user.id,
  );
  console.log("✅ 現在のユーザーがいいね済み:", isLikedByCurrentUser);

  console.log("\n🏁 実際のいいね機能テスト完了");
}

testRealLikeFunctionality().catch(console.error);
