import {
  adminClient,
  cleanupTestUser,
  createTestUser,
  getAnonClient,
} from "./utils";

describe("missions テーブルのRLSテスト", () => {
  let user1: Awaited<ReturnType<typeof createTestUser>>;
  let missionId: string;

  beforeEach(async () => {
    // テストユーザーを作成
    user1 = await createTestUser(`${crypto.randomUUID()}@example.com`);

    // テスト用グッジョブを作成（管理者権限で）
    const missionData = {
      id: crypto.randomUUID(),
      title: "テストグッジョブ for RLS",
      content: "これはRLSテスト用のグッジョブです",
      difficulty: 1,
      slug: `test-mission-rls-${crypto.randomUUID()}`,
    };

    const { error } = await adminClient.from("missions").insert(missionData);
    if (error) throw new Error(`グッジョブ作成エラー: ${error.message}`);

    missionId = missionData.id;
  });

  afterEach(async () => {
    // テストデータをクリーンアップ
    await adminClient.from("missions").delete().eq("id", missionId);
    await cleanupTestUser(user1.user.userId);
  });

  test("匿名ユーザーはグッジョブ一覧を読み取れる", async () => {
    const anonClient = getAnonClient();
    const { data, error } = await anonClient.from("missions").select("*");

    expect(error).toBeNull();
    expect(data).toBeTruthy();
    expect(data?.some((mission) => mission.id === missionId)).toBeTruthy();
  });

  test("認証済みユーザーはグッジョブ一覧を読み取れる", async () => {
    const { data, error } = await user1.client.from("missions").select("*");

    expect(error).toBeNull();
    expect(data).toBeTruthy();
    expect(data?.some((mission) => mission.id === missionId)).toBeTruthy();
  });

  test("匿名ユーザーはグッジョブを作成できない", async () => {
    const anonClient = getAnonClient();
    const newMissionId = crypto.randomUUID();

    const { data, error } = await anonClient.from("missions").insert({
      id: newMissionId,
      title: "匿名ユーザーからのグッジョブ",
      content: "これは失敗するはずです",
      difficulty: 1,
      slug: `test-anon-mission-${crypto.randomUUID()}`,
    });

    expect(error).toBeTruthy();
    expect(data).toBeNull();
  });

  test("認証済みユーザーはグッジョブを作成できない", async () => {
    const newMissionId = crypto.randomUUID();

    const { data, error } = await user1.client.from("missions").insert({
      id: newMissionId,
      title: "一般ユーザーからのグッジョブ",
      content: "これは失敗するはずです",
      difficulty: 1,
      slug: `test-user-mission-${crypto.randomUUID()}`,
    });

    expect(error).toBeTruthy();
    expect(data).toBeNull();
  });

  test("認証済みユーザーはグッジョブを更新できない", async () => {
    const { data } = await user1.client
      .from("missions")
      .update({ title: "更新されたタイトル" })
      .eq("id", missionId);

    expect(data).toBeNull();

    const { data: updatedData } = await user1.client
      .from("missions")
      .select("*")
      .eq("id", missionId);
    expect(updatedData?.[0]?.title).toBe("テストグッジョブ for RLS");
  });

  test("認証済みユーザーはグッジョブを削除できない", async () => {
    const { data } = await user1.client
      .from("missions")
      .delete()
      .eq("id", missionId);

    expect(data).toBeNull();

    const { data: remainingData } = await user1.client
      .from("missions")
      .select("*")
      .eq("id", missionId);
    expect(remainingData).toBeTruthy();
  });
});
