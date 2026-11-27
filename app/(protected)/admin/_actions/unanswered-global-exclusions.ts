"use server";

import { fetchAllRows, fetchByIdChunks } from "@/lib/supabase/fetch-all-rows";
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

  const rows = await fetchAllRows<{ user_id: string }>((from, to) =>
    supabase
      .from("unanswered_survey_global_exclusions")
      .select("user_id")
      .order("user_id", { ascending: true })
      .range(from, to),
  );
  if (rows.length === 0) {
    return [];
  }

  const users = await fetchByIdChunks<{ id: string; name: string }>(
    rows.map((r) => r.user_id),
    (chunk) =>
      supabase.from("private_users").select("id, name").in("id", chunk),
  );

  const list = users.map((u) => ({ id: u.id, name: u.name }));
  list.sort((a, b) => a.name.localeCompare(b.name, "ja"));
  return list;
}
