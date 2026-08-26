"use server";

import {
  formatJstDateTime,
  leftAtFromJstTime,
} from "@/lib/office-check/left-at";
import { buildOfficeClosingSlackMessage } from "@/lib/office-check/slack-message";
import {
  assertAllFloorsChecked,
  officeClosingFormSchema,
} from "@/lib/office-check/validation";
import { resolveOfficeCheckSlackWebhookUrl } from "@/lib/slack/survey-webhook-urls";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type SubmitOfficeClosingResult =
  | { success: true }
  | { success: false; error: string };

async function sendOfficeClosingSlackNotification(input: {
  reporterName: string;
  leftAt: Date;
  floors: { name: string; checked: boolean }[];
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
  const slackMessage = buildOfficeClosingSlackMessage({
    reporterName: input.reporterName,
    leftAtLabel: formatJstDateTime(input.leftAt),
    floors: input.floors,
    note: input.note,
  });

  const response = await fetch(notificationUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "office_closing_check",
      data: {
        reporterName: input.reporterName,
        leftAtLabel: formatJstDateTime(input.leftAt),
        floors: input.floors,
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

export async function submitOfficeClosingCheckAction(input: {
  leftAtTime: string;
  checkedFloorIds: string[];
  note?: string;
}): Promise<SubmitOfficeClosingResult> {
  const supabase = await createClient();

  try {
    const parsed = officeClosingFormSchema.safeParse({
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

    const { data: floors, error: floorsError } = await supabase
      .from("office_floors")
      .select("id, name, display_order")
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    if (floorsError || !floors) {
      console.error("[最終チェック] フロア取得エラー:", floorsError);
      return { success: false, error: "フロア情報の取得に失敗しました" };
    }

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

    const leftAt = leftAtFromJstTime(parsed.data.leftAtTime);
    const note = parsed.data.note?.trim() ? parsed.data.note.trim() : null;

    const { data: report, error: reportError } = await supabase
      .from("office_closing_reports")
      .insert({
        user_id: user.id,
        left_at: leftAt.toISOString(),
        note,
      })
      .select("id")
      .single();

    if (reportError || !report) {
      console.error("[最終チェック] 報告保存エラー:", reportError);
      return { success: false, error: "最終チェックの保存に失敗しました" };
    }

    const checkedSet = new Set(parsed.data.checkedFloorIds);
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

    const { data: reporter } = await supabase
      .from("private_users")
      .select("name")
      .eq("id", user.id)
      .single();

    try {
      await sendOfficeClosingSlackNotification({
        reporterName: reporter?.name || "不明",
        leftAt,
        floors: floors.map((floor) => ({
          name: floor.name,
          checked: checkedSet.has(floor.id),
        })),
        note,
      });
    } catch (slackError) {
      console.error("[最終チェック] Slack通知エラー（継続）:", slackError);
    }

    if (!process.env.CF_PAGES) {
      revalidatePath("/office-check");
    }

    return { success: true };
  } catch (error) {
    console.error("[最終チェック] 予期しないエラー:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "最終チェックの送信に失敗しました",
    };
  }
}
