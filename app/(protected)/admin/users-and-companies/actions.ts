"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { requireOwner } from "@/lib/utils/isOwner";

export type UserWithCompanyRow = {
  id: string;
  name: string;
  businessUnitId: string | null;
  businessUnitName: string | null;
  companyName: string | null;
};

export async function listUsersWithCompanies(): Promise<
  | { success: true; users: UserWithCompanyRow[] }
  | { success: false; error: string }
> {
  try {
    await requireOwner();
    const supabase = await createServiceClient();

    const { data, error } = await supabase
      .from("public_user_profiles")
      .select(
        `
        id,
        name,
        business_unit_id,
        business_units (
          id,
          name,
          companies (
            name
          )
        )
      `,
      )
      .order("name", { ascending: true });

    if (error) {
      console.error("listUsersWithCompanies:", error);
      return { success: false, error: error.message };
    }

    const users: UserWithCompanyRow[] = (data ?? []).map((row) => {
      const bu = row.business_units;
      const unit =
        bu === null ? null : Array.isArray(bu) ? (bu[0] ?? null) : bu;
      const comp = unit?.companies;
      const companyName =
        comp === null || comp === undefined
          ? null
          : Array.isArray(comp)
            ? (comp[0]?.name ?? null)
            : comp.name;
      return {
        id: row.id,
        name: row.name,
        businessUnitId: row.business_unit_id,
        businessUnitName: unit?.name ?? null,
        companyName,
      };
    });

    return { success: true, users };
  } catch (error) {
    if (error instanceof Error && error.message === "経営者権限が必要です") {
      return { success: false, error: "経営者権限が必要です" };
    }
    console.error(error);
    return { success: false, error: "一覧の取得に失敗しました" };
  }
}
