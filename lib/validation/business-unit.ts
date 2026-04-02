import type { Database } from "@/lib/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

/**
 * フォームから渡された事業部 ID を検証し、有効ならその UUID、未設定なら null を返す。
 */
export async function resolveBusinessUnitIdFromForm(
  supabase: SupabaseClient<Database>,
  raw: string | undefined | null,
): Promise<
  { ok: true; businessUnitId: string | null } | { ok: false; error: string }
> {
  if (raw === undefined || raw === null || raw === "" || raw === "__none") {
    return { ok: true, businessUnitId: null };
  }
  const parsed = z.string().uuid().safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "事業部の指定が不正です" };
  }
  const { data } = await supabase
    .from("business_units")
    .select("id")
    .eq("id", parsed.data)
    .eq("is_active", true)
    .maybeSingle();
  if (!data) {
    return { ok: false, error: "選択した事業部が見つかりません" };
  }
  return { ok: true, businessUnitId: parsed.data };
}
