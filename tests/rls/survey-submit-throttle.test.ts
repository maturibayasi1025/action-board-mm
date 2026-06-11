import { beforeAll, describe, expect, it } from "@jest/globals";
import { type SupabaseClient, createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

describe("survey_submit_throttle RLS Policies", () => {
  let anonClient: SupabaseClient;
  let authenticatedClient: SupabaseClient;
  let serviceClient: SupabaseClient;
  let testUserId: string;
  let testSurveyId: string;

  beforeAll(async () => {
    anonClient = createClient(supabaseUrl, supabaseAnonKey);
    serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey);

    const email = `test-throttle-${Date.now()}@example.com`;
    const { data: authData, error: authError } =
      await serviceClient.auth.admin.createUser({
        email,
        password: "test-password-123",
        email_confirm: true,
      });

    if (authError || !authData.user) {
      throw new Error(`Failed to create test user: ${authError?.message}`);
    }

    testUserId = authData.user.id;

    // anonClient で signIn すると anonClient 自体が認証状態になり匿名テストが壊れるため専用クライアントを使う
    const signInClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: signInData } = await signInClient.auth.signInWithPassword({
      email,
      password: "test-password-123",
    });

    authenticatedClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${signInData?.session?.access_token || ""}`,
        },
      },
    });

    testSurveyId = "00000000-0000-4000-8000-000000000001";
  });

  it("should allow authenticated users to insert their own throttle row", async () => {
    const { data, error } = await authenticatedClient
      .from("survey_submit_throttle")
      .insert({
        survey_id: testSurveyId,
        user_id: testUserId,
        last_submitted_at: new Date().toISOString(),
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data?.survey_id).toBe(testSurveyId);

    await serviceClient
      .from("survey_submit_throttle")
      .delete()
      .eq("survey_id", testSurveyId)
      .eq("user_id", testUserId);
  });

  it("should allow authenticated users to select and update their own row", async () => {
    await serviceClient.from("survey_submit_throttle").insert({
      survey_id: testSurveyId,
      user_id: testUserId,
      last_submitted_at: new Date().toISOString(),
    });

    const { data: rows, error: selectError } = await authenticatedClient
      .from("survey_submit_throttle")
      .select("*")
      .eq("survey_id", testSurveyId);

    expect(selectError).toBeNull();
    expect(rows?.length).toBe(1);

    const { error: updateError } = await authenticatedClient
      .from("survey_submit_throttle")
      .update({ last_submitted_at: new Date().toISOString() })
      .eq("survey_id", testSurveyId)
      .eq("user_id", testUserId);

    expect(updateError).toBeNull();

    await serviceClient
      .from("survey_submit_throttle")
      .delete()
      .eq("survey_id", testSurveyId)
      .eq("user_id", testUserId);
  });

  it("should not allow anonymous users to insert", async () => {
    const { error } = await anonClient.from("survey_submit_throttle").insert({
      survey_id: "00000000-0000-4000-8000-000000000002",
      user_id: testUserId,
      last_submitted_at: new Date().toISOString(),
    });

    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");
  });
});
