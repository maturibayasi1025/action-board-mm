import {
  adminClient,
  cleanupTestUser,
  createTestUser,
  getAnonClient,
} from "./utils";

describe("user_mission_likes テーブルのRLSテスト（7日制限）", () => {
  let ownerUser: Awaited<ReturnType<typeof createTestUser>>;
  let likerUser: Awaited<ReturnType<typeof createTestUser>>;
  let recentMissionId: string;
  let expiredMissionId: string;
  let legacyMissionId: string;

  beforeEach(async () => {
    ownerUser = await createTestUser(`${crypto.randomUUID()}@example.com`);
    likerUser = await createTestUser(`${crypto.randomUUID()}@example.com`);

    const now = new Date();
    const recentPublishedAt = new Date(
      now.getTime() - 24 * 60 * 60 * 1000,
    ).toISOString();
    const expiredPublishedAt = new Date(
      now.getTime() - 8 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const recentMission = {
      id: crypto.randomUUID(),
      created_by: ownerUser.user.userId,
      title: "recent mission",
      content: "recent mission content",
      status: "approved",
      approved_at: recentPublishedAt,
      approved_by: ownerUser.user.userId,
      published_at: recentPublishedAt,
    };

    const expiredMission = {
      id: crypto.randomUUID(),
      created_by: ownerUser.user.userId,
      title: "expired mission",
      content: "expired mission content",
      status: "approved",
      approved_at: expiredPublishedAt,
      approved_by: ownerUser.user.userId,
      published_at: expiredPublishedAt,
    };

    const legacyMission = {
      id: crypto.randomUUID(),
      created_by: ownerUser.user.userId,
      title: "legacy mission",
      content: "legacy mission content",
      status: "approved",
      approved_at: now.toISOString(),
      approved_by: ownerUser.user.userId,
      published_at: null,
    };

    const { error: recentError } = await adminClient
      .from("user_missions")
      .insert(recentMission);
    if (recentError) {
      throw new Error(`recent mission 作成エラー: ${recentError.message}`);
    }

    const { error: expiredError } = await adminClient
      .from("user_missions")
      .insert(expiredMission);
    if (expiredError) {
      throw new Error(`expired mission 作成エラー: ${expiredError.message}`);
    }

    const { error: legacyError } = await adminClient
      .from("user_missions")
      .insert(legacyMission);
    if (legacyError) {
      throw new Error(`legacy mission 作成エラー: ${legacyError.message}`);
    }

    recentMissionId = recentMission.id;
    expiredMissionId = expiredMission.id;
    legacyMissionId = legacyMission.id;
  });

  afterEach(async () => {
    await adminClient
      .from("user_mission_likes")
      .delete()
      .in("user_mission_id", [recentMissionId, expiredMissionId, legacyMissionId]);
    await adminClient
      .from("user_missions")
      .delete()
      .in("id", [recentMissionId, expiredMissionId, legacyMissionId]);
    await cleanupTestUser(ownerUser.user.userId);
    await cleanupTestUser(likerUser.user.userId);
  });

  test("認証済みユーザーは公開から7日以内のグッジョブにいいねできる", async () => {
    const { data, error } = await likerUser.client
      .from("user_mission_likes")
      .insert({
        user_mission_id: recentMissionId,
        user_id: likerUser.user.userId,
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data?.user_mission_id).toBe(recentMissionId);
    expect(data?.user_id).toBe(likerUser.user.userId);
  });

  test("認証済みユーザーは公開から7日を超えたグッジョブにいいねできない", async () => {
    const { data, error } = await likerUser.client.from("user_mission_likes").insert({
      user_mission_id: expiredMissionId,
      user_id: likerUser.user.userId,
    });

    expect(error).toBeTruthy();
    expect(data).toBeNull();

    const { data: likes } = await adminClient
      .from("user_mission_likes")
      .select("id")
      .eq("user_mission_id", expiredMissionId)
      .eq("user_id", likerUser.user.userId);
    expect(likes).toHaveLength(0);
  });

  test("公開日がNULLの既存グッジョブには従来通りいいねできる", async () => {
    const { data, error } = await likerUser.client
      .from("user_mission_likes")
      .insert({
        user_mission_id: legacyMissionId,
        user_id: likerUser.user.userId,
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data?.user_mission_id).toBe(legacyMissionId);
  });

  test("認証済みユーザーは公開から7日以内の自分のいいねを取り消せる", async () => {
    const likeId = crypto.randomUUID();
    const { error: seedError } = await adminClient.from("user_mission_likes").insert({
      id: likeId,
      user_mission_id: recentMissionId,
      user_id: likerUser.user.userId,
    });
    if (seedError) {
      throw new Error(`いいねのシード作成エラー: ${seedError.message}`);
    }

    const { error: deleteError } = await likerUser.client
      .from("user_mission_likes")
      .delete()
      .eq("id", likeId);
    expect(deleteError).toBeNull();

    const { data: remaining } = await adminClient
      .from("user_mission_likes")
      .select("id")
      .eq("id", likeId);
    expect(remaining).toHaveLength(0);
  });

  test("認証済みユーザーは公開から7日を超えたグッジョブのいいねを取り消せない", async () => {
    const likeId = crypto.randomUUID();
    const { error: seedError } = await adminClient.from("user_mission_likes").insert({
      id: likeId,
      user_mission_id: expiredMissionId,
      user_id: likerUser.user.userId,
    });
    if (seedError) {
      throw new Error(`いいねのシード作成エラー: ${seedError.message}`);
    }

    const { error: deleteError } = await likerUser.client
      .from("user_mission_likes")
      .delete()
      .eq("id", likeId);
    expect(deleteError).toBeNull();

    const { data: remaining } = await adminClient
      .from("user_mission_likes")
      .select("id")
      .eq("id", likeId);
    expect(remaining).toHaveLength(1);
  });

  test("匿名ユーザーはいいねを作成できない", async () => {
    const anonClient = getAnonClient();
    const { data, error } = await anonClient.from("user_mission_likes").insert({
      user_mission_id: recentMissionId,
      user_id: likerUser.user.userId,
    });

    expect(error).toBeTruthy();
    expect(data).toBeNull();
  });
});
