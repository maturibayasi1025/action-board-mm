"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { requireOwner } from "@/lib/utils/isOwner";
import { revalidatePath } from "next/cache";

export async function addGlobalUnansweredExclusion(userId: string) {
  await requireOwner();
  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("unanswered_survey_global_exclusions")
    .insert({ user_id: userId });

  if (error) {
    return { ok: false as const, error: error.message };
  }

  revalidatePath("/admin/enps-surveys", "layout");
  revalidatePath("/admin/award-surveys", "layout");
  return { ok: true as const };
}

export async function removeGlobalUnansweredExclusion(userId: string) {
  await requireOwner();
  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("unanswered_survey_global_exclusions")
    .delete()
    .eq("user_id", userId);

  if (error) {
    return { ok: false as const, error: error.message };
  }

  revalidatePath("/admin/enps-surveys", "layout");
  revalidatePath("/admin/award-surveys", "layout");
  return { ok: true as const };
}

export async function listGlobalUnansweredExclusions(): Promise<
  { id: string; name: string }[]
> {
  await requireOwner();
  const supabase = await createServiceClient();

  const { data: rows, error } = await supabase
    .from("unanswered_survey_global_exclusions")
    .select("user_id");

  if (error || !rows?.length) {
    return [];
  }

  const ids = rows.map((r) => r.user_id);
  const { data: users } = await supabase
    .from("private_users")
    .select("id, name")
    .in("id", ids);

  const list = (users ?? []).map((u) => ({ id: u.id, name: u.name }));
  list.sort((a, b) => a.name.localeCompare(b.name, "ja"));
  return list;
}
