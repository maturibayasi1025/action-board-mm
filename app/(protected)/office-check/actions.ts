"use server";

import {
  formatJstDateTime,
  leftAtFromJstTime,
} from "@/lib/office-check/left-at";
import { remainingUserIds } from "@/lib/office-check/remaining";
import {
  type OfficePresenceKind,
  buildOfficeClosingSlackMessage,
} from "@/lib/office-check/slack-message";
import {
  assertAllFloorsChecked,
  officeClosingFormSchema,
} from "@/lib/office-check/validation";
import { resolveOfficeCheckSlackWebhookUrl } from "@/lib/slack/survey-webhook-urls";
import { createClient } from "@/lib/supabase/server";
import { getTodayStartJST } from "@/lib/utils/date-timezone";
import { revalidatePath } from "next/cache";

export type SubmitOfficeClosingResult =
  | { success: true }
  | { success: false; error: string };

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

async function loadRemainingUserIds(
  supabase: SupabaseServerClient,
  todayStart: string,
): Promise<string[]> {
  const [{ data: checkins }, { data: leaves }] = await Promise.all([
    supabase
      .from("office_checkins")
      .select("user_id, checked_in_at")
      .gte("checked_in_at", todayStart),
    supabase
      .from("office_closing_reports")
      .select("user_id, left_at")
      .gte("left_at", todayStart),
  ]);

  return remainingUserIds(
    (checkins ?? []).map((row) => ({
      userId: row.user_id,
      at: row.checked_in_at,
    })),
    (leaves ?? []).map((row) => ({
      userId: row.user_id,
      at: row.left_at,
    })),
  );
}

async function namesForUserIds(
  supabase: SupabaseServerClient,
  ids: string[],
): Promise<string[]> {
  if (ids.length === 0) {
    return [];
  }
  const { data: users } = await supabase
    .from("private_users")
    .select("id, name")
    .in("id", ids);
  const nameById = new Map((users ?? []).map((row) => [row.id, row.name]));
  return ids
    .map((id) => nameById.get(id) ?? "不明")
    .sort((a, b) => a.localeCompare(b, "ja"));
}

async function loadRemainingNames(
  supabase: SupabaseServerClient,
  todayStart: string,
): Promise<string[]> {
  const ids = await loadRemainingUserIds(supabase, todayStart);
  return namesForUserIds(supabase, ids);
}

async function sendOfficePresenceSlackNotification(input: {
  kind: OfficePresenceKind;
  reporterName: string;
  at: Date;
  remainingNames: string[];
  floors?: { name: string; checked: boolean }[];
  note?: string | null;
}): Promise<void> {
  if (!resolveOfficeCheckSlackWebhookUrl()) {
    console.warn(
      "[最終チェック] Slack Webhook URLが未設定のため通知をスキップします",
    );
    return;
  }

  const apiUrl = process.env.NEXT_PUBLIC_APP_ORIGIN || "http://localhost:3000";
  const notificationUrl = `${apiUrl}/api/slack-notification`;
  const atLabel = formatJstDateTime(input.at);
  const slackMessage = buildOfficeClosingSlackMessage({
    kind: input.kind,
    reporterName: input.reporterName,
    atLabel,
    remainingNames: input.remainingNames,
    floors: input.floors,
    note: input.note,
  });

  const response = await fetch(notificationUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "office_closing_check",
      data: {
        kind: input.kind,
        reporterName: input.reporterName,
        atLabel,
        remainingNames: input.remainingNames,
        floors: input.floors ?? [],
        note: input.note ?? null,
      },
      message: slackMessage,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Slack通知API呼び出し失敗: ${response.status} ${response.statusText}. ${body}`,
    );
  }
}

function revalidateOfficeCheck(): void {
  if (!process.env.CF_PAGES) {
    revalidatePath("/office-check");
  }
}

export async function submitOfficeCheckinAction(): Promise<SubmitOfficeClosingResult> {
  const supabase = await createClient();

  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: "ログインが必要です" };
    }

    const todayStart = getTodayStartJST().toISOString();
    const currentlyPresentIds = await loadRemainingUserIds(
      supabase,
      todayStart,
    );
    if (currentlyPresentIds.includes(user.id)) {
      return { success: false, error: "すでに在室中です" };
    }

    const { data: me } = await supabase
      .from("private_users")
      .select("name")
      .eq("id", user.id)
      .single();
    const myName = me?.name || "不明";

    const checkedInAt = new Date();
    const { error: insertError } = await supabase
      .from("office_checkins")
      .insert({
        user_id: user.id,
        checked_in_at: checkedInAt.toISOString(),
      });
    if (insertError) {
      console.error("[入室] 保存エラー:", insertError);
      return { success: false, error: "入室の記録に失敗しました" };
    }

    const remainingNames = await loadRemainingNames(supabase, todayStart);
    try {
      await sendOfficePresenceSlackNotification({
        kind: "checkin",
        reporterName: myName,
        at: checkedInAt,
        remainingNames,
      });
    } catch (slackError) {
      console.error("[入室] Slack通知エラー（継続）:", slackError);
    }

    revalidateOfficeCheck();
    return { success: true };
  } catch (error) {
    console.error("[入室] 予期しないエラー:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "入室の記録に失敗しました",
    };
  }
}

export async function submitOfficeClosingCheckAction(input: {
  leaveKind: "midday" | "final";
  leftAtTime: string;
  checkedFloorIds: string[];
  note?: string;
}): Promise<SubmitOfficeClosingResult> {
  const supabase = await createClient();

  try {
    const parsed = officeClosingFormSchema.safeParse({
      leaveKind: input.leaveKind,
      leftAtTime: input.leftAtTime,
      checkedFloorIds: input.checkedFloorIds,
      note: input.note,
    });
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "入力内容を確認してください",
      };
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: "ログインが必要です" };
    }

    const leaveKind = parsed.data.leaveKind;
    const { data: floors, error: floorsError } = await supabase
      .from("office_floors")
      .select("id, name, display_order")
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    if (floorsError || !floors) {
      console.error("[最終チェック] フロア取得エラー:", floorsError);
      return { success: false, error: "フロア情報の取得に失敗しました" };
    }

    if (leaveKind === "final") {
      if (floors.length === 0) {
        return {
          success: false,
          error: "チェック対象の階が登録されていません",
        };
      }
      try {
        assertAllFloorsChecked(
          floors.map((floor) => floor.id),
          parsed.data.checkedFloorIds,
        );
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "各階のチェックが不足しています",
        };
      }
    }

    const leftAt = leftAtFromJstTime(parsed.data.leftAtTime);
    const note = parsed.data.note?.trim() ? parsed.data.note.trim() : null;

    const { data: report, error: reportError } = await supabase
      .from("office_closing_reports")
      .insert({
        user_id: user.id,
        left_at: leftAt.toISOString(),
        leave_kind: leaveKind,
        note,
      })
      .select("id")
      .single();

    if (reportError || !report) {
      console.error("[最終チェック] 報告保存エラー:", reportError);
      return { success: false, error: "退室の保存に失敗しました" };
    }

    const checkedSet = new Set(parsed.data.checkedFloorIds);
    if (leaveKind === "final") {
      const floorRows = floors.map((floor) => ({
        report_id: report.id,
        floor_id: floor.id,
        checked: checkedSet.has(floor.id),
      }));
      const { error: floorRowsError } = await supabase
        .from("office_closing_report_floors")
        .insert(floorRows);

      if (floorRowsError) {
        console.error("[最終チェック] 階チェック保存エラー:", floorRowsError);
        await supabase
          .from("office_closing_reports")
          .delete()
          .eq("id", report.id);
        return {
          success: false,
          error: "各階チェックの保存に失敗しました",
        };
      }
    }

    const { data: reporter } = await supabase
      .from("private_users")
      .select("name")
      .eq("id", user.id)
      .single();

    const remainingNames = await loadRemainingNames(
      supabase,
      getTodayStartJST().toISOString(),
    );

    try {
      await sendOfficePresenceSlackNotification({
        kind: leaveKind,
        reporterName: reporter?.name || "不明",
        at: leftAt,
        remainingNames,
        floors:
          leaveKind === "final"
            ? floors.map((floor) => ({
                name: floor.name,
                checked: checkedSet.has(floor.id),
              }))
            : undefined,
        note,
      });
    } catch (slackError) {
      console.error("[最終チェック] Slack通知エラー（継続）:", slackError);
    }

    revalidateOfficeCheck();
    return { success: true };
  } catch (error) {
    console.error("[最終チェック] 予期しないエラー:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "退室の送信に失敗しました",
    };
  }
}
