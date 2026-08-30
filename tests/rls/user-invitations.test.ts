import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { type SupabaseClient, createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

describe("user_invitations RLS Policies", () => {
  let anonClient: SupabaseClient;
  let authenticatedClient: SupabaseClient;
  let serviceClient: SupabaseClient;
  let testUserId: string;
  let invitationId: string | null = null;

  beforeAll(async () => {
    anonClient = createClient(supabaseUrl, supabaseAnonKey);
    serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey);

    const testUserEmail = `test-invite-${Date.now()}@example.com`;
    const { data: authData, error: authError } =
      await serviceClient.auth.admin.createUser({
        email: testUserEmail,
        password: "test-password-123",
        email_confirm: true,
      });

    if (authError || !authData.user) {
      throw new Error(`Failed to create test user: ${authError?.message}`);
    }

    testUserId = authData.user.id;

    const signInClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: signInData } = await signInClient.auth.signInWithPassword({
      email: testUserEmail,
      password: "test-password-123",
    });

    authenticatedClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${signInData?.session?.access_token || ""}`,
        },
      },
    });
  });

  afterAll(async () => {
    if (invitationId) {
      await serviceClient
        .from("user_invitations")
        .delete()
        .eq("id", invitationId);
    }
    if (testUserId) {
      await serviceClient.auth.admin.deleteUser(testUserId);
    }
  });

  it("サービスロールは招待を作成できる", async () => {
    const { data, error } = await serviceClient
      .from("user_invitations")
      .insert({
        email: `pending-${Date.now()}@example.com`,
        invited_by: testUserId,
        status: "pending",
      })
      .select("id")
      .single();

    expect(error).toBeNull();
    expect(data?.id).toBeTruthy();
    invitationId = data?.id ?? null;
  });

  it("匿名ユーザーは招待を参照できない", async () => {
    const { data, error } = await anonClient
      .from("user_invitations")
      .select("id")
      .limit(1);

    expect(data === null || data.length === 0).toBe(true);
    expect(error).not.toBeNull();
  });

  it("認証済みユーザーは招待を参照できない", async () => {
    const { data, error } = await authenticatedClient
      .from("user_invitations")
      .select("id")
      .limit(1);

    expect(data === null || data.length === 0).toBe(true);
    expect(error).not.toBeNull();
  });

  it("認証済みユーザーは招待を作成できない", async () => {
    const { error } = await authenticatedClient
      .from("user_invitations")
      .insert({
        email: `blocked-${Date.now()}@example.com`,
        invited_by: testUserId,
        status: "pending",
      });

    expect(error).not.toBeNull();
  });
});
