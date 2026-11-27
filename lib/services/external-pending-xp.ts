import {
  DEFAULT_IN_CHUNK_SIZE,
  fetchAllRows,
} from "@/lib/supabase/fetch-all-rows";
import type { Database, Tables } from "@/lib/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 登録したユーザーの名前で保留されている社外称賛のポイントを、すべて付与して付与済みにする。
 * 付与した件数を返す。保留ポイントの取得に失敗したら、何も付与せず例外にする。
 */
export async function claimExternalPendingXp(
  supabase: SupabaseClient<Database>,
  userId: string,
  userName: string,
): Promise<number> {
  const pending = await fetchAllRows<Tables<"external_user_pending_xp">>(
    (from, to) =>
      supabase
        .from("external_user_pending_xp")
        .select("*")
        .eq("external_user_name", userName)
        .is("claimed_at", null)
        .order("id", { ascending: true })
        .range(from, to),
  );
  if (pending.length === 0) {
    return 0;
  }

  const { error: insertError } = await supabase.from("xp_transactions").insert(
    pending.map((record) => ({
      user_id: userId,
      xp_amount: record.xp_amount,
      source_type: "USER_MISSION_PRAISED_EXTERNAL",
      source_id: record.user_mission_id,
      description:
        record.description ||
        "ユーザーグッジョブで賞賛されました（登録後に付与）",
    })),
  );
  if (insertError) {
    throw new Error(insertError.message);
  }

  // ID が多いと URL 長の上限を超えるので分割して更新する
  const claimedAt = new Date().toISOString();
  for (let i = 0; i < pending.length; i += DEFAULT_IN_CHUNK_SIZE) {
    const { error } = await supabase
      .from("external_user_pending_xp")
      .update({ claimed_at: claimedAt, claimed_by_user_id: userId })
      .in(
        "id",
        pending.slice(i, i + DEFAULT_IN_CHUNK_SIZE).map((record) => record.id),
      );
    if (error) {
      throw new Error(error.message);
    }
  }
  return pending.length;
}
