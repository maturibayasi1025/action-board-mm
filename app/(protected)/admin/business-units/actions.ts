"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { requireOwner } from "@/lib/utils/isOwner";
import { revalidatePath } from "next/cache";

export type CompanyRow = {
  id: string;
  name: string;
  slug: string | null;
  display_order: number;
  is_active: boolean;
};

export type BusinessUnitRow = {
  id: string;
  company_id: string;
  name: string;
  display_order: number;
  is_active: boolean;
  parent_id: string | null;
};

export async function listCompaniesAndUnits(): Promise<
  | { success: true; companies: CompanyRow[]; units: BusinessUnitRow[] }
  | { success: false; error: string }
> {
  try {
    await requireOwner();
    const supabase = await createServiceClient();
    const [{ data: companies, error: e1 }, { data: units, error: e2 }] =
      await Promise.all([
        supabase.from("companies").select("*").order("display_order"),
        supabase.from("business_units").select("*").order("display_order"),
      ]);
    if (e1) {
      return { success: false, error: e1.message };
    }
    if (e2) {
      return { success: false, error: e2.message };
    }
    return {
      success: true,
      companies: (companies ?? []) as CompanyRow[],
      units: (units ?? []) as BusinessUnitRow[],
    };
  } catch (error) {
    if (error instanceof Error && error.message === "経営者権限が必要です") {
      return { success: false, error: "経営者権限が必要です" };
    }
    console.error(error);
    return { success: false, error: "一覧の取得に失敗しました" };
  }
}

export async function createCompany(
  formData: FormData,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await requireOwner();
    const name = formData.get("name")?.toString().trim();
    if (!name) {
      return { success: false, error: "会社名を入力してください" };
    }
    const slugRaw = formData.get("slug")?.toString().trim();
    const slug = slugRaw === "" ? null : slugRaw;
    const supabase = await createServiceClient();
    const { error } = await supabase.from("companies").insert({
      name,
      slug,
      display_order: Number(formData.get("display_order") ?? 0) || 0,
      is_active: formData.get("is_active") === "on",
    });
    if (error) {
      return { success: false, error: error.message };
    }
    revalidatePath("/admin/business-units");
    return { success: true };
  } catch (error) {
    if (error instanceof Error && error.message === "経営者権限が必要です") {
      return { success: false, error: "経営者権限が必要です" };
    }
    console.error(error);
    return { success: false, error: "登録に失敗しました" };
  }
}

export async function updateCompany(
  companyId: string,
  formData: FormData,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await requireOwner();
    const name = formData.get("name")?.toString().trim();
    if (!name) {
      return { success: false, error: "会社名を入力してください" };
    }
    const slugRaw = formData.get("slug")?.toString().trim();
    const slug = slugRaw === "" ? null : slugRaw;
    const supabase = await createServiceClient();
    const { error } = await supabase
      .from("companies")
      .update({
        name,
        slug,
        display_order: Number(formData.get("display_order") ?? 0) || 0,
        is_active: formData.get("is_active") === "on",
        updated_at: new Date().toISOString(),
      })
      .eq("id", companyId);
    if (error) {
      return { success: false, error: error.message };
    }
    revalidatePath("/admin/business-units");
    return { success: true };
  } catch (error) {
    if (error instanceof Error && error.message === "経営者権限が必要です") {
      return { success: false, error: "経営者権限が必要です" };
    }
    console.error(error);
    return { success: false, error: "更新に失敗しました" };
  }
}

export async function createBusinessUnit(
  formData: FormData,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await requireOwner();
    const companyId = formData.get("company_id")?.toString();
    const name = formData.get("name")?.toString().trim();
    if (!companyId || !name) {
      return { success: false, error: "会社と事業部名を入力してください" };
    }
    const supabase = await createServiceClient();
    const { error } = await supabase.from("business_units").insert({
      company_id: companyId,
      name,
      display_order: Number(formData.get("display_order") ?? 0) || 0,
      is_active: formData.get("is_active") === "on",
    });
    if (error) {
      return { success: false, error: error.message };
    }
    revalidatePath("/admin/business-units");
    return { success: true };
  } catch (error) {
    if (error instanceof Error && error.message === "経営者権限が必要です") {
      return { success: false, error: "経営者権限が必要です" };
    }
    console.error(error);
    return { success: false, error: "登録に失敗しました" };
  }
}

export async function updateBusinessUnit(
  unitId: string,
  formData: FormData,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await requireOwner();
    const name = formData.get("name")?.toString().trim();
    if (!name) {
      return { success: false, error: "事業部名を入力してください" };
    }
    const supabase = await createServiceClient();
    const { error } = await supabase
      .from("business_units")
      .update({
        name,
        display_order: Number(formData.get("display_order") ?? 0) || 0,
        is_active: formData.get("is_active") === "on",
        updated_at: new Date().toISOString(),
      })
      .eq("id", unitId);
    if (error) {
      return { success: false, error: error.message };
    }
    revalidatePath("/admin/business-units");
    return { success: true };
  } catch (error) {
    if (error instanceof Error && error.message === "経営者権限が必要です") {
      return { success: false, error: "経営者権限が必要です" };
    }
    console.error(error);
    return { success: false, error: "更新に失敗しました" };
  }
}
