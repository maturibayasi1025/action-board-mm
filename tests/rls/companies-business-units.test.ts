import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/supabase";
import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { adminClient, createTestUser, cleanupTestUser } from "./utils";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

describe("Companies and business_units RLS", () => {
  let anonClient: SupabaseClient<Database>;
  let authClient: SupabaseClient<Database>;
  let testUserId: string;
  let activeCompanyId: string;
  let inactiveCompanyId: string;
  let activeUnitId: string;
  let inactiveUnitId: string;

  beforeAll(async () => {
    anonClient = createClient<Database>(supabaseUrl, supabaseAnonKey);

    const { data: cActive, error: e1 } = await adminClient
      .from("companies")
      .insert({
        name: "RLS Test Active Co",
        display_order: 0,
        is_active: true,
      })
      .select("id")
      .single();
    if (e1 || !cActive) throw new Error(e1?.message ?? "insert company");
    activeCompanyId = cActive.id;

    const { data: cInactive, error: e2 } = await adminClient
      .from("companies")
      .insert({
        name: "RLS Test Inactive Co",
        display_order: 1,
        is_active: false,
      })
      .select("id")
      .single();
    if (e2 || !cInactive) throw new Error(e2?.message ?? "insert company");
    inactiveCompanyId = cInactive.id;

    const { data: uActive, error: e3 } = await adminClient
      .from("business_units")
      .insert({
        company_id: activeCompanyId,
        name: "Active Unit",
        display_order: 0,
        is_active: true,
      })
      .select("id")
      .single();
    if (e3 || !uActive) throw new Error(e3?.message ?? "insert unit");
    activeUnitId = uActive.id;

    const { data: uInactive, error: e4 } = await adminClient
      .from("business_units")
      .insert({
        company_id: activeCompanyId,
        name: "Inactive Unit",
        display_order: 1,
        is_active: false,
      })
      .select("id")
      .single();
    if (e4 || !uInactive) throw new Error(e4?.message ?? "insert unit");
    inactiveUnitId = uInactive.id;

    const { user, client } = await createTestUser(
      `test-bu-${Date.now()}@example.com`,
    );
    testUserId = user.userId;
    authClient = client;
  });

  afterAll(async () => {
    await cleanupTestUser(testUserId);
    await adminClient.from("business_units").delete().eq("company_id", activeCompanyId);
    await adminClient.from("companies").delete().eq("id", activeCompanyId);
    await adminClient.from("companies").delete().eq("id", inactiveCompanyId);
  });

  it("allows anon to read active companies", async () => {
    const { data, error } = await anonClient
      .from("companies")
      .select("id")
      .eq("id", activeCompanyId);
    expect(error).toBeNull();
    expect(data?.length).toBe(1);
  });

  it("does not expose inactive companies to anon", async () => {
    const { data } = await anonClient
      .from("companies")
      .select("id")
      .eq("id", inactiveCompanyId);
    expect(data?.length ?? 0).toBe(0);
  });

  it("allows anon to read active business_units", async () => {
    const { data, error } = await anonClient
      .from("business_units")
      .select("id")
      .eq("id", activeUnitId);
    expect(error).toBeNull();
    expect(data?.length).toBe(1);
  });

  it("does not expose inactive business_units to anon", async () => {
    const { data } = await anonClient
      .from("business_units")
      .select("id")
      .eq("id", inactiveUnitId);
    expect(data?.length ?? 0).toBe(0);
  });

  it("denies anon insert on companies", async () => {
    const { error } = await anonClient.from("companies").insert({
      name: "evil",
      display_order: 0,
      is_active: true,
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");
  });

  it("denies authenticated insert on companies", async () => {
    const { error } = await authClient.from("companies").insert({
      name: "evil2",
      display_order: 0,
      is_active: true,
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");
  });

  it("allows user to set own business_unit_id to an active unit", async () => {
    const { error } = await authClient
      .from("private_users")
      .update({ business_unit_id: activeUnitId })
      .eq("id", testUserId);
    expect(error).toBeNull();

    const { data: pu } = await authClient
      .from("private_users")
      .select("business_unit_id")
      .eq("id", testUserId)
      .single();
    expect(pu?.business_unit_id).toBe(activeUnitId);
  });

  it("allows user to clear own business_unit_id", async () => {
    const { error } = await authClient
      .from("private_users")
      .update({ business_unit_id: null })
      .eq("id", testUserId);
    expect(error).toBeNull();
  });
});
