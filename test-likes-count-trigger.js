const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  "http://127.0.0.1:54321",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU",
);

async function testLikesCountTrigger() {
  console.log("🧪 いいね数トリガーのテスト\n");

  // 1. テストグッジョブを作成
  console.log("1️⃣ テストグッジョブ作成");
  const { data: mission, error: missionError } = await supabase
    .from("user_missions")
    .insert({
      created_by: "f47ac10b-58cc-4372-a567-0e02b2c3d479", // 佐藤太郎
      title: "いいね数トリガーテスト",
      content: "このグッジョブはいいね数トリガーをテストするためのものです",
      praised_person_name: "テスト太郎さん",
      status: "approved",
      approved_at: new Date().toISOString(),
      approved_by: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    })
    .select()
    .single();

  if (missionError) {
    console.error("❌ グッジョブ作成エラー:", missionError);
    return;
  }

  console.log("✅ テストグッジョブ作成完了:", mission.title);
  console.log("   初期いいね数:", mission.likes_count);
  const missionId = mission.id;

  // 2. いいねを追加（直接テーブルに挿入）
  console.log("\n2️⃣ いいね追加テスト");
  const { error: likeError } = await supabase
    .from("user_mission_likes")
    .insert({
      user_mission_id: missionId,
      user_id: "2c23c05b-8e25-4d0d-9e68-d3be74e4ae8f", // 田中花子
    });

  if (likeError) {
    console.error("❌ いいね追加エラー:", likeError);
    return;
  }

  console.log("✅ いいね追加完了");

  // 3. いいね数を確認
  console.log("\n3️⃣ いいね後のグッジョブ確認");
  const { data: updatedMission, error: fetchError } = await supabase
    .from("user_missions")
    .select("likes_count")
    .eq("id", missionId)
    .single();

  if (fetchError) {
    console.error("❌ グッジョブ取得エラー:", fetchError);
  } else {
    console.log("✅ 更新後いいね数:", updatedMission.likes_count);

    if (updatedMission.likes_count === 1) {
      console.log("🎉 トリガーが正常に動作しています！");
    } else {
      console.log("⚠️  トリガーが動作していない可能性があります");
    }
  }

  // 4. いいね一覧を確認
  console.log("\n4️⃣ いいね一覧確認");
  const { data: likes, error: likesError } = await supabase
    .from("user_mission_likes")
    .select("*")
    .eq("user_mission_id", missionId);

  if (likesError) {
    console.error("❌ いいね一覧取得エラー:", likesError);
  } else {
    console.log("✅ いいね一覧:");
    likes.forEach((like, index) => {
      console.log(`   ${index + 1}. ユーザー: ${like.user_id}`);
    });
    console.log("   総いいね数:", likes.length);
  }

  // 5. いいね削除テスト
  console.log("\n5️⃣ いいね削除テスト");
  const { error: deleteError } = await supabase
    .from("user_mission_likes")
    .delete()
    .eq("user_mission_id", missionId)
    .eq("user_id", "2c23c05b-8e25-4d0d-9e68-d3be74e4ae8f");

  if (deleteError) {
    console.error("❌ いいね削除エラー:", deleteError);
  } else {
    console.log("✅ いいね削除完了");
  }

  // 6. 削除後のいいね数確認
  console.log("\n6️⃣ 削除後のグッジョブ確認");
  const { data: finalMission, error: finalError } = await supabase
    .from("user_missions")
    .select("likes_count")
    .eq("id", missionId)
    .single();

  if (finalError) {
    console.error("❌ 最終確認エラー:", finalError);
  } else {
    console.log("✅ 削除後いいね数:", finalMission.likes_count);

    if (finalMission.likes_count === 0) {
      console.log("🎉 削除時のトリガーも正常に動作しています！");
    } else {
      console.log("⚠️  削除時のトリガーに問題がある可能性があります");
    }
  }

  console.log("\n🏁 いいね数トリガーテスト完了");
}

testLikesCountTrigger().catch(console.error);
