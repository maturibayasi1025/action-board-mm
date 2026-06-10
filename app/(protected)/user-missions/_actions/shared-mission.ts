"use server";

import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/types/supabase";
import { excludeCreatorFromPraisedUserIds } from "@/lib/utils/user-mission-praised";
import { revalidatePath } from "next/cache";
export async function checkIsFirstGoodJobToday(
  userId: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<boolean> {
  try {
    console.log("[checkIsFirstGoodJobToday] 開始:", { userId });
    // JST（UTC+9）で今日の開始時刻と終了時刻を計算
    const now = new Date();

    // JSTの今日の開始時刻（00:00:00）をUTCに変換
    // UTC 15:00（前日）= JST 00:00（当日）
    const jstTodayStartUTC = new Date(now);
    jstTodayStartUTC.setUTCHours(15, 0, 0, 0);
    if (jstTodayStartUTC > now) {
      // まだ日本時間の0時になっていない場合は前日にする
      jstTodayStartUTC.setUTCDate(jstTodayStartUTC.getUTCDate() - 1);
    }

    // JSTの今日の終了時刻（23:59:59.999）をUTCに変換
    const jstTodayEndUTC = new Date(jstTodayStartUTC);
    jstTodayEndUTC.setUTCDate(jstTodayEndUTC.getUTCDate() + 1);
    jstTodayEndUTC.setUTCHours(14, 59, 59, 999);

    console.log("[checkIsFirstGoodJobToday] 時間範囲:", {
      jstTodayStartUTC: jstTodayStartUTC.toISOString(),
      jstTodayEndUTC: jstTodayEndUTC.toISOString(),
      now: now.toISOString(),
    });

    // 今日公開されたグッジョブをカウント（承認済みのみ、published_at基準）
    const { count, error } = await supabase
      .from("user_missions")
      .select("id", { count: "exact", head: true })
      .eq("created_by", userId)
      .eq("status", "approved")
      .not("published_at", "is", null)
      .gte("published_at", jstTodayStartUTC.toISOString())
      .lte("published_at", jstTodayEndUTC.toISOString());

    if (error) {
      console.error("[checkIsFirstGoodJobToday] クエリエラー:", {
        error,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      // エラーが発生した場合は安全のためfalseを返す（共有グッジョブは表示しない）
      return false;
    }

    const todayCount = count ?? 0;
    const isFirst = todayCount === 0;
    console.log("[checkIsFirstGoodJobToday] 結果:", {
      todayCount,
      isFirst,
    });

    // 投稿作成前にチェックするため、カウントが0の場合にtrueを返す
    return isFirst;
  } catch (error) {
    console.error("[checkIsFirstGoodJobToday] 予期しないエラー:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    // エラーが発生した場合は安全のためfalseを返す（共有グッジョブは表示しない）
    return false;
  }
}

/**
 * 今日まだ達成していない共有グッジョブを取得
 */
export async function getAvailableSharedMissions(
  userId: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  try {
    console.log("[getAvailableSharedMissions] 開始:", { userId });
    // JST（UTC+9）で今日の開始時刻と終了時刻を計算
    const now = new Date();

    // JSTの今日の開始時刻（00:00:00）をUTCに変換
    const jstTodayStartUTC = new Date(now);
    jstTodayStartUTC.setUTCHours(15, 0, 0, 0);
    if (jstTodayStartUTC > now) {
      jstTodayStartUTC.setUTCDate(jstTodayStartUTC.getUTCDate() - 1);
    }

    // JSTの今日の終了時刻（23:59:59.999）をUTCに変換
    const jstTodayEndUTC = new Date(jstTodayStartUTC);
    jstTodayEndUTC.setUTCDate(jstTodayEndUTC.getUTCDate() + 1);
    jstTodayEndUTC.setUTCHours(14, 59, 59, 999);

    console.log("[getAvailableSharedMissions] 時間範囲:", {
      jstTodayStartUTC: jstTodayStartUTC.toISOString(),
      jstTodayEndUTC: jstTodayEndUTC.toISOString(),
    });

    // 特定の共有グッジョブのみを取得
    const TARGET_MISSION_ID = "e1f1d556-df31-4f79-b96d-6a1badeb5a0b";
    console.log("[getAvailableSharedMissions] 共有グッジョブを取得:", {
      targetMissionId: TARGET_MISSION_ID,
    });

    const { data: importantMissions, error: missionsError } = await supabase
      .from("missions")
      .select(
        "id, title, icon_url, difficulty, content, important_display_start_date, important_display_end_date",
      )
      .eq("id", TARGET_MISSION_ID)
      .eq("is_important", true)
      .eq("is_hidden", false)
      .order("difficulty", { ascending: true })
      .order("created_at", { ascending: false });

    if (missionsError) {
      console.error("[getAvailableSharedMissions] 共有グッジョブ取得エラー:", {
        error: missionsError,
        code: missionsError.code,
        message: missionsError.message,
        details: missionsError.details,
        hint: missionsError.hint,
      });
      return [];
    }

    if (!importantMissions || importantMissions.length === 0) {
      console.log(
        "[getAvailableSharedMissions] 共有グッジョブが見つかりませんでした",
      );
      return [];
    }

    console.log("[getAvailableSharedMissions] 共有グッジョブ取得完了:", {
      count: importantMissions.length,
      missions: importantMissions.map((m) => ({
        id: m.id,
        title: m.title,
      })),
    });

    // 期間設定を考慮してフィルタリング
    const nowDate = new Date(now);
    const validMissions = importantMissions.filter((mission) => {
      const startDate = mission.important_display_start_date
        ? new Date(mission.important_display_start_date)
        : null;
      const endDate = mission.important_display_end_date
        ? new Date(mission.important_display_end_date)
        : null;

      // 開始日が設定されている場合、現在日時が開始日以降である必要がある
      if (startDate && nowDate < startDate) {
        return false;
      }

      // 終了日が設定されている場合、現在日時が終了日以前である必要がある
      if (endDate && nowDate > endDate) {
        return false;
      }

      return true;
    });

    if (validMissions.length === 0) {
      console.log(
        "[getAvailableSharedMissions] 期間内の共有グッジョブがありません",
      );
      return [];
    }

    console.log("[getAvailableSharedMissions] 期間内の共有グッジョブ:", {
      count: validMissions.length,
    });

    // 今日達成した共有グッジョブのIDを取得
    const { data: todayAchievements, error: achievementsError } = await supabase
      .from("achievements")
      .select("mission_id")
      .eq("user_id", userId)
      .in(
        "mission_id",
        validMissions.map((m) => m.id),
      )
      .gte("created_at", jstTodayStartUTC.toISOString())
      .lte("created_at", jstTodayEndUTC.toISOString());

    if (achievementsError) {
      console.error("[getAvailableSharedMissions] 今日の達成記録取得エラー:", {
        error: achievementsError,
        code: achievementsError.code,
        message: achievementsError.message,
      });
      // エラー時は安全のため空配列を返す（すべて返すと誤って表示される可能性がある）
      return [];
    }

    const achievedMissionIds = new Set(
      todayAchievements?.map((a) => a.mission_id).filter(Boolean) || [],
    );

    console.log("[getAvailableSharedMissions] 今日達成した共有グッジョブ:", {
      count: achievedMissionIds.size,
      missionIds: Array.from(achievedMissionIds),
    });

    // 今日まだ達成していない共有グッジョブのみを返す
    const availableMissions = validMissions.filter(
      (mission) => !achievedMissionIds.has(mission.id),
    );

    console.log("[getAvailableSharedMissions] 利用可能な共有グッジョブ:", {
      count: availableMissions.length,
      missions: availableMissions.map((m) => ({
        id: m.id,
        title: m.title,
      })),
    });

    // 必要なフィールドのみを抽出して返す（型不一致とシリアライズエラーを防ぐため）
    // undefinedをnullに変換し、すべての値をプリミティブ型に変換
    return availableMissions.map((mission) => ({
      id: String(mission.id),
      title: String(mission.title),
      icon_url: mission.icon_url ?? null,
      difficulty: Number(mission.difficulty),
      content: mission.content ?? null,
    }));
  } catch (error) {
    console.error("[getAvailableSharedMissions] 予期しないエラー:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    // エラーが発生した場合は安全のため空配列を返す
    return [];
  }
}

/**
 * 成果物なしで共有グッジョブを完了する
 */
export async function completeSharedMissionAction(missionId: string) {
  const supabase = await createClient();

  try {
    // 認証チェック
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        success: false,
        error: "認証に失敗しました。再ログインしてください。",
      };
    }

    // グッジョブ情報を取得して、is_importantを確認
    const { data: missionData, error: missionFetchError } = await supabase
      .from("missions")
      .select("is_important, max_achievement_count")
      .eq("id", missionId)
      .single();

    if (missionFetchError || !missionData) {
      return {
        success: false,
        error: "グッジョブ情報の取得に失敗しました。",
      };
    }

    if (!missionData.is_important) {
      return {
        success: false,
        error: "このグッジョブは共有グッジョブではありません。",
      };
    }

    // 1日1回制限チェック（JSTで判定）
    const now = new Date();
    const jstTodayStartUTC = new Date(now);
    jstTodayStartUTC.setUTCHours(15, 0, 0, 0);
    if (jstTodayStartUTC > now) {
      jstTodayStartUTC.setUTCDate(jstTodayStartUTC.getUTCDate() - 1);
    }

    const jstTodayEndUTC = new Date(jstTodayStartUTC);
    jstTodayEndUTC.setUTCDate(jstTodayEndUTC.getUTCDate() + 1);
    jstTodayEndUTC.setUTCHours(14, 59, 59, 999);

    // 今日既に達成しているかチェック
    const { data: todayAchievements, error: todayAchievementError } =
      await supabase
        .from("achievements")
        .select("id")
        .eq("user_id", user.id)
        .eq("mission_id", missionId)
        .gte("created_at", jstTodayStartUTC.toISOString())
        .lte("created_at", jstTodayEndUTC.toISOString());

    if (todayAchievementError) {
      return {
        success: false,
        error: "今日の達成記録の確認に失敗しました。",
      };
    }

    if (todayAchievements && todayAchievements.length > 0) {
      return {
        success: false,
        error: "共有グッジョブは1日1回までしか達成できません。",
      };
    }

    // 成果物なしでグッジョブ達成を記録
    const { data: achievement, error: achievementError } = await supabase
      .from("achievements")
      .insert({
        user_id: user.id,
        mission_id: missionId,
      })
      .select()
      .single();

    if (achievementError || !achievement) {
      console.error("グッジョブ達成記録エラー:", achievementError);
      return {
        success: false,
        error: `グッジョブ達成の記録に失敗しました: ${achievementError?.message}`,
      };
    }

    // XPを付与
    const { grantMissionCompletionXp } = await import(
      "@/lib/services/userLevel"
    );
    const xpResult = await grantMissionCompletionXp(
      user.id,
      missionId,
      achievement.id,
    );

    if (!xpResult.success) {
      console.error("XP付与に失敗しました:", {
        error: xpResult.error,
        userId: user.id,
        missionId,
        achievementId: achievement.id,
      });
      // XP付与の失敗はグッジョブ達成の成功を妨げない
      // バックフィル処理で後から補完可能
    }

    return {
      success: true,
      message: "共有グッジョブを完了しました！",
      xpGranted: xpResult.xpGranted ?? 0,
      userLevel: xpResult.userLevel,
    };
  } catch (error) {
    console.error("completeSharedMissionActionエラー:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "予期しないエラーが発生しました",
    };
  }
}

// 下書き削除
