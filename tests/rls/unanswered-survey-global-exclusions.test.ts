import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

describe("unanswered_survey_global_exclusions RLS", () => {
  let anonClient: SupabaseClient;
  let serviceClient: SupabaseClient;
  let testUserId: string;

  beforeAll(async () => {
    anonClient = createClient(supabaseUrl, supabaseAnonKey);
    serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { data: authData, error: authError } =
      await serviceClient.auth.admin.createUser({
        email: `test-unanswered-excl-${Date.now()}@example.com`,
        password: "test-password-123",
        email_confirm: true,
      });

    if (authError || !authData.user) {
      throw new Error(`Failed to create test user: ${authError?.message}`);
    }

    testUserId = authData.user.id;

    const { error: privateUserError } = await serviceClient
      .from("private_users")
      .insert({
        id: testUserId,
        name: "未回答除外テストユーザー",
        address_prefecture: "東京都",
        date_of_birth: "1990-01-01",
      });

    if (privateUserError) {
      throw new Error(
        `Failed to create private user: ${privateUserError.message}`,
      );
    }
  });

  afterAll(async () => {
    if (!serviceClient || !testUserId) {
      return;
    }

    await serviceClient.from("private_users").delete().eq("id", testUserId);
    await serviceClient.auth.admin.deleteUser(testUserId);
  });

  it("should not allow anonymous users to read exclusions", async () => {
    const { error: insertError } = await serviceClient
      .from("unanswered_survey_global_exclusions")
      .insert({ user_id: testUserId });

    expect(insertError).toBeNull();

    const { data, error } = await anonClient
      .from("unanswered_survey_global_exclusions")
      .select("*");

    await serviceClient
      .from("unanswered_survey_global_exclusions")
      .delete()
      .eq("user_id", testUserId);

    expect(error).toBeNull();
    expect(data?.length ?? 0).toBe(0);
  });

  it("should not allow anonymous users to insert", async () => {
    const { error } = await anonClient
      .from("unanswered_survey_global_exclusions")
      .insert({ user_id: testUserId });

    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");
  });

  it("should allow service role to insert and delete", async () => {
    const { error: insertError } = await serviceClient
      .from("unanswered_survey_global_exclusions")
      .insert({ user_id: testUserId });

    expect(insertError).toBeNull();

    const { error: deleteError } = await serviceClient
      .from("unanswered_survey_global_exclusions")
      .delete()
      .eq("user_id", testUserId);

    expect(deleteError).toBeNull();
  });
});
