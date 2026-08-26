import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import {
  adminClient,
  cleanupTestUser,
  createTestUser,
  getAnonClient,
} from "./utils";

describe("office closing check RLS", () => {
  let anonClient: ReturnType<typeof getAnonClient>;
  let user1: Awaited<ReturnType<typeof createTestUser>>;
  let user2: Awaited<ReturnType<typeof createTestUser>>;
  let floorId: string;
  let user1ReportId: string | null = null;

  beforeAll(async () => {
    anonClient = getAnonClient();
    user1 = await createTestUser(`office-check-1-${Date.now()}@example.com`);
    user2 = await createTestUser(`office-check-2-${Date.now()}@example.com`);

    const { data: floor, error } = await adminClient
      .from("office_floors")
      .insert({
        name: "RLS Test Floor",
        slug: `rls-test-${Date.now()}`,
        display_order: 999,
        is_active: true,
      })
      .select("id")
      .single();
    if (error || !floor) {
      throw new Error(error?.message ?? "failed to insert office floor");
    }
    floorId = floor.id;
  });

  afterAll(async () => {
    if (user1ReportId) {
      await adminClient
        .from("office_closing_reports")
        .delete()
        .eq("id", user1ReportId);
    }
    await adminClient.from("office_floors").delete().eq("id", floorId);
    await cleanupTestUser(user1.user.userId);
    await cleanupTestUser(user2.user.userId);
  });

  it("匿名ユーザーはフロアを読めない", async () => {
    const { data } = await anonClient
      .from("office_floors")
      .select("id")
      .eq("id", floorId);
    expect(data?.length ?? 0).toBe(0);
  });

  it("認証ユーザーはフロアを読める", async () => {
    const { data, error } = await user1.client
      .from("office_floors")
      .select("id")
      .eq("id", floorId);
    expect(error).toBeNull();
    expect(data?.length).toBe(1);
  });

  it("匿名ユーザーは報告を挿入できない", async () => {
    const { error } = await anonClient.from("office_closing_reports").insert({
      user_id: user1.user.userId,
      left_at: new Date().toISOString(),
    });
    expect(error).not.toBeNull();
  });

  it("認証ユーザーは自分の報告を挿入できる", async () => {
    const { data, error } = await user1.client
      .from("office_closing_reports")
      .insert({
        user_id: user1.user.userId,
        left_at: new Date().toISOString(),
        note: "rls test",
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    expect(data?.id).toBeTruthy();
    user1ReportId = data?.id ?? null;
  });

  it("認証ユーザーは他人名義の報告を挿入できない", async () => {
    const { error } = await user1.client.from("office_closing_reports").insert({
      user_id: user2.user.userId,
      left_at: new Date().toISOString(),
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");
  });

  it("認証ユーザーは自分の報告に階チェックを追加できる", async () => {
    expect(user1ReportId).toBeTruthy();
    const { error } = await user1.client
      .from("office_closing_report_floors")
      .insert({
        report_id: user1ReportId as string,
        floor_id: floorId,
        checked: true,
      });
    expect(error).toBeNull();
  });

  it("認証ユーザーは他人の報告に階チェックを追加できない", async () => {
    expect(user1ReportId).toBeTruthy();
    const { error } = await user2.client
      .from("office_closing_report_floors")
      .insert({
        report_id: user1ReportId as string,
        floor_id: floorId,
        checked: true,
      });
    expect(error).not.toBeNull();
  });

  it("認証ユーザーは他人の報告を読める", async () => {
    expect(user1ReportId).toBeTruthy();
    const { data, error } = await user2.client
      .from("office_closing_reports")
      .select("id")
      .eq("id", user1ReportId as string);
    expect(error).toBeNull();
    expect(data?.length).toBe(1);
  });
});
