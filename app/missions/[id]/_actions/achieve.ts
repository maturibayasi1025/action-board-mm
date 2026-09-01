"use server";

import { getSurveyLinkedMissionKind } from "@/app/(protected)/surveys/_lib/linked-post-mission";
import { hasAchievementInActiveSurveyPeriod } from "@/app/(protected)/surveys/_lib/survey-linked-achievement-in-period";
import { userRespondedActiveAwardSurvey } from "@/app/(protected)/surveys/_lib/user-responded-active-award-survey";
import { userRespondedActiveEnpsSurvey } from "@/app/(protected)/surveys/_lib/user-responded-active-enps-survey";
import { ARTIFACT_TYPES } from "@/lib/artifactTypes"; // パス変更
import { assertUserActive } from "@/lib/services/user-status";
import {
  getUserXpBonus,
  grantMissionCompletionXp,
  grantXp,
} from "@/lib/services/userLevel";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { calculateMissionXp } from "@/lib/utils/utils";

import { MAX_POSTING_COUNT, POSTING_POINTS_PER_UNIT } from "@/lib/constants";
import type { Database, TablesInsert } from "@/lib/types/supabase";
import { z } from "zod";
import {
  achieveMissionFormSchema,
  cancelSubmissionFormSchema,
} from "./schemas";

export const achieveMissionAction = async (formData: FormData) => {
  const supabase = await createClient();
  const missionId = formData.get("missionId")?.toString();
  const requiredArtifactType = formData.get("requiredArtifactType")?.toString();
  const artifactLink = formData.get("artifactLink")?.toString();
  const artifactText = formData.get("artifactText")?.toString();
  const artifactEmail = formData.get("artifactEmail")?.toString();
  const artifactImagePath = formData.get("artifactImagePath")?.toString();
  const artifactDescription = formData.get("artifactDescription")?.toString();
  // 位置情報データの取得
  const latitude = formData.get("latitude")?.toString();
  const longitude = formData.get("longitude")?.toString();
  const accuracy = formData.get("accuracy")?.toString();
  const altitude = formData.get("altitude")?.toString();
  // ポスティング用データの取得
  const postingCount = formData.get("postingCount")?.toString();
  const locationText = formData.get("locationText")?.toString();
  const validatedFields = achieveMissionFormSchema.safeParse({
    missionId,
    requiredArtifactType,
    artifactLink,
    artifactText,
    artifactEmail,
    artifactImagePath,
    artifactDescription,
    latitude,
    longitude,
    accuracy,
    altitude,
    postingCount,
    locationText,
  });

  // ポスティングボーナスXP + グッジョブ達成XP 用の変数
  let totalXpGranted = 0;

  if (!validatedFields.success) {
    return {
      success: false,
      error: validatedFields.error.errors
        .map((error) => error.message)
        .join("\n"),
    };
  }

  const validatedData = validatedFields.data;
  const {
    missionId: validatedMissionId,
    requiredArtifactType: validatedRequiredArtifactType,
    artifactDescription: validatedArtifactDescription,
  } = validatedData;

  // ユーザーがログイン済みかチェック (念のため)
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) {
    return {
      success: false,
      error: "認証エラーが発生しました。",
    };
  }

  try {
    await assertUserActive(authUser.id);
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "アカウントが停止されています",
    };
  }

  // グッジョブ情報を取得して、max_achievement_count と is_important を確認
  const { data: missionData, error: missionFetchError } = await supabase
    .from("missions")
    .select("max_achievement_count, is_important")
    .eq("id", validatedMissionId)
    .single();

  if (missionFetchError) {
    console.error(`Mission fetch error: ${missionFetchError.message}`);
    return {
      success: false,
      error: "グッジョブ情報の取得に失敗しました。",
    };
  }

  if (missionData?.max_achievement_count !== null) {
    // ユーザーの達成回数を取得
    const { data: userAchievements, error: userAchievementError } =
      await supabase
        .from("achievements")
        .select("id", { count: "exact" })
        .eq("user_id", authUser.id)
        .eq("mission_id", validatedMissionId);

    if (userAchievementError) {
      console.error(
        `User achievement count fetch error: ${userAchievementError.message}`,
      );
      return {
        success: false,
        error: "ユーザーの達成回数の取得に失敗しました。",
      };
    }

    // ユーザーの達成回数が最大達成回数に達しているかチェック
    if (
      userAchievements &&
      typeof missionData.max_achievement_count === "number" &&
      userAchievements.length >= missionData.max_achievement_count
    ) {
      return {
        success: false,
        error: "あなたはこのグッジョブの達成回数の上限に達しています。",
      };
    }
  }

  // 共有グッジョブ（is_important）の追加制限
  if (missionData?.is_important) {
    const surveyLinkedKind = getSurveyLinkedMissionKind(validatedMissionId);

    if (surveyLinkedKind === "award" || surveyLinkedKind === "enps") {
      if (surveyLinkedKind === "award") {
        const responded = await userRespondedActiveAwardSurvey(authUser.id);
        if (!responded) {
          return {
            success: false,
            error:
              "受付中の表彰アンケートに回答していないため、達成できません。",
          };
        }
      } else {
        const responded = await userRespondedActiveEnpsSurvey(authUser.id);
        if (!responded) {
          return {
            success: false,
            error:
              "受付中のeNPSアンケートに回答していないため、達成できません。",
          };
        }
      }

      const alreadyThisPeriod = await hasAchievementInActiveSurveyPeriod(
        supabase,
        authUser.id,
        validatedMissionId,
        surveyLinkedKind,
      );
      if (alreadyThisPeriod) {
        return {
          success: false,
          error:
            "このアンケートの受付期間中は、すでにグッジョブを記録済みです。",
        };
      }

      console.log(
        "[共有グッジョブ] アンケート連携: 当日ユーザーグッジョブ作成・当日達成回数チェックはスキップ（受付期間あたり1回）",
      );
    } else {
      // 1日1回制限（JST）— アンケート連携以外の共有グッジョブ
      const now = new Date();

      const jstTodayStartUTC = new Date(now);
      jstTodayStartUTC.setUTCHours(15, 0, 0, 0);
      if (jstTodayStartUTC > now) {
        jstTodayStartUTC.setUTCDate(jstTodayStartUTC.getUTCDate() - 1);
      }

      const jstTodayEndUTC = new Date(jstTodayStartUTC);
      jstTodayEndUTC.setUTCDate(jstTodayEndUTC.getUTCDate() + 1);
      jstTodayEndUTC.setUTCHours(14, 59, 59, 999);

      console.log(
        `[1日1回制限チェック] ユーザー: ${authUser.id}, グッジョブ: ${validatedMissionId}`,
      );
      console.log(
        `[1日1回制限チェック] JST今日の開始(UTC): ${jstTodayStartUTC.toISOString()}`,
      );
      console.log(
        `[1日1回制限チェック] JST今日の終了(UTC): ${jstTodayEndUTC.toISOString()}`,
      );

      const { data: todayUserMissions, error: todayUserMissionError } =
        await supabase
          .from("user_missions")
          .select("id, published_at")
          .eq("created_by", authUser.id)
          .eq("status", "approved")
          .not("published_at", "is", null)
          .gte("published_at", jstTodayStartUTC.toISOString())
          .lte("published_at", jstTodayEndUTC.toISOString());

      if (todayUserMissionError) {
        console.error(
          `Today's user mission check error: ${todayUserMissionError.message}`,
        );
        return {
          success: false,
          error: "今日のグッジョブ作成記録の確認に失敗しました。",
        };
      }

      console.log(
        `[1日1回制限チェック] 今日のグッジョブ作成記録数: ${todayUserMissions?.length || 0}`,
      );

      if (!todayUserMissions || todayUserMissions.length === 0) {
        return {
          success: false,
          error: "今日グッジョブを作成していないため、達成できません。",
        };
      }

      console.log(
        "[1日1回制限チェック] 今日作成されたグッジョブがあるため、今日達成した共有グッジョブをチェックします",
      );
      console.log(
        "[1日1回制限チェック] 公開記録:",
        todayUserMissions.map((m) => ({
          id: m.id,
          published_at: m.published_at,
        })),
      );

      const { data: todayAchievements, error: todayAchievementError } =
        await supabase
          .from("achievements")
          .select("id, created_at")
          .eq("user_id", authUser.id)
          .eq("mission_id", validatedMissionId)
          .gte("created_at", jstTodayStartUTC.toISOString())
          .lte("created_at", jstTodayEndUTC.toISOString());

      if (todayAchievementError) {
        console.error(
          `Today's achievement check error: ${todayAchievementError.message}`,
        );
        return {
          success: false,
          error: "今日の達成記録の確認に失敗しました。",
        };
      }

      console.log(
        `[1日1回制限チェック] 今日の達成記録数: ${todayAchievements?.length || 0}`,
      );
      if (todayAchievements && todayAchievements.length > 0) {
        console.log(
          "[1日1回制限チェック] 達成記録:",
          todayAchievements.map((a) => ({
            id: a.id,
            created_at: a.created_at,
          })),
        );
      }

      if (todayAchievements && todayAchievements.length > 0) {
        return {
          success: false,
          error: "共有グッジョブは1日1回までしか達成できません。",
        };
      }
    }
  }

  // LINK重複バリデーション
  if (
    validatedRequiredArtifactType === ARTIFACT_TYPES.LINK.key &&
    validatedData.requiredArtifactType === ARTIFACT_TYPES.LINK.key
  ) {
    const { data: duplicateArtifacts, error: duplicateError } = await supabase
      .from("mission_artifacts")
      .select(`
      id,
      achievements!inner(mission_id)
    `)
      .eq("user_id", authUser.id)
      .eq("artifact_type", ARTIFACT_TYPES.LINK.key)
      .eq("link_url", validatedData.artifactLink)
      .eq("achievements.mission_id", validatedMissionId);

    if (duplicateError) {
      return {
        success: false,
        error: "重複チェック中にエラーが発生しました。",
      };
    }

    if (duplicateArtifacts && duplicateArtifacts.length > 0) {
      return {
        success: false,
        error: "記録に失敗しました。同じURLがすでに登録されています。",
      };
    }
  }

  // グッジョブ達成を記録
  const achievementPayload = {
    user_id: authUser.id,
    mission_id: validatedMissionId,
  };

  const { data: achievement, error: achievementError } = await supabase
    .from("achievements")
    .insert(achievementPayload)
    .select("id")
    .single();

  if (achievementError) {
    console.error(
      `Achievement Error: ${achievementError.code} ${achievementError.message}`,
    );
    return {
      success: false,
      error: `グッジョブ達成の記録に失敗しました: ${achievementError.message}`,
    };
  }

  if (!achievement) {
    return {
      success: false,
      error: "達成記録の作成に失敗しました。",
    };
  }

  // 成果物がある場合は mission_artifacts に記録
  // LINK_ACCESSタイプの場合は成果物の保存をスキップ
  if (
    validatedRequiredArtifactType &&
    validatedRequiredArtifactType !== ARTIFACT_TYPES.NONE.key &&
    validatedRequiredArtifactType !== ARTIFACT_TYPES.LINK_ACCESS.key
  ) {
    const artifactPayload: TablesInsert<"mission_artifacts"> = {
      achievement_id: achievement.id,
      user_id: authUser.id,
      artifact_type: validatedRequiredArtifactType,
      description: validatedArtifactDescription || null,
    };

    let artifactTypeLabel = "OTHER";
    let validationError = null;

    // formDataの内容を全てログ出力
    const formDataObj: Record<string, string> = {};
    formData.forEach((value, key) => {
      formDataObj[key] = String(value);
    });

    if (validatedRequiredArtifactType === ARTIFACT_TYPES.LINK.key) {
      artifactTypeLabel = "LINK";
      if (validatedData.requiredArtifactType === ARTIFACT_TYPES.LINK.key) {
        artifactPayload.link_url = validatedData.artifactLink;
        // CHECK制約: link_url必須、他はnull
        artifactPayload.image_storage_path = null;
        artifactPayload.text_content = null;
      }
    } else if (validatedRequiredArtifactType === ARTIFACT_TYPES.TEXT.key) {
      artifactTypeLabel = "TEXT";
      if (validatedData.requiredArtifactType === ARTIFACT_TYPES.TEXT.key) {
        artifactPayload.text_content = validatedData.artifactText;
        // CHECK制約: text_content必須、他はnull
        artifactPayload.link_url = null;
        artifactPayload.image_storage_path = null;
      }
    } else if (validatedRequiredArtifactType === ARTIFACT_TYPES.EMAIL.key) {
      artifactTypeLabel = "EMAIL";
      if (validatedData.requiredArtifactType === ARTIFACT_TYPES.EMAIL.key) {
        artifactPayload.text_content = validatedData.artifactEmail;
        // CHECK制約: text_content必須、他はnull
        artifactPayload.link_url = null;
        artifactPayload.image_storage_path = null;
      }
    } else if (validatedRequiredArtifactType === ARTIFACT_TYPES.IMAGE.key) {
      artifactTypeLabel = "IMAGE";
      if (validatedData.requiredArtifactType === ARTIFACT_TYPES.IMAGE.key) {
        artifactPayload.image_storage_path = validatedData.artifactImagePath;
        // CHECK制約: image_storage_path必須、他はnull
        artifactPayload.link_url = null;
        artifactPayload.text_content = null;
      }
    } else if (
      validatedRequiredArtifactType ===
      ARTIFACT_TYPES.IMAGE_WITH_GEOLOCATION.key
    ) {
      artifactTypeLabel = "IMAGE_WITH_GEOLOCATION";
      if (
        validatedData.requiredArtifactType ===
        ARTIFACT_TYPES.IMAGE_WITH_GEOLOCATION.key
      ) {
        artifactPayload.image_storage_path = validatedData.artifactImagePath;
        artifactPayload.link_url = null;
        artifactPayload.text_content = null;
      }
    } else if (validatedRequiredArtifactType === ARTIFACT_TYPES.POSTING.key) {
      artifactTypeLabel = "POSTING";
      if (validatedData.requiredArtifactType === ARTIFACT_TYPES.POSTING.key) {
        // ポスティング情報をtext_contentに格納
        artifactPayload.text_content = `${validatedData.postingCount}枚を${validatedData.locationText}に配布`;
        // CHECK制約: text_content必須、他はnull
        artifactPayload.link_url = null;
        artifactPayload.image_storage_path = null;
      }
    } else if (validatedRequiredArtifactType === ARTIFACT_TYPES.QUIZ.key) {
      artifactTypeLabel = "QUIZ";
      if (validatedData.requiredArtifactType === ARTIFACT_TYPES.QUIZ.key) {
        // クイズ結果はdescriptionのみに格納
        artifactPayload.text_content = null;
        artifactPayload.link_url = null;
        artifactPayload.image_storage_path = null;
      }
    } else {
      // その他のタイプは全てnullに
      artifactPayload.link_url = null;
      artifactPayload.image_storage_path = null;
      artifactPayload.text_content = null;
    }

    // CHECK制約: QUIZタイプ以外はlink_url、text_content、image_storage_pathのいずれか一つは必須
    if (
      validatedRequiredArtifactType !== ARTIFACT_TYPES.QUIZ.key &&
      !artifactPayload.link_url &&
      !artifactPayload.image_storage_path &&
      !artifactPayload.text_content
    ) {
      validationError =
        validationError ||
        "リンク、テキスト、または画像のいずれかは必須です（CHECK制約違反防止）";
    }

    // バリデーションエラー時は詳細ログとともにリダイレクト
    if (validationError) {
      console.error(
        `[Artifact Validation Error] type=${artifactTypeLabel} payload=`,
        artifactPayload,
        "formData:",
        formDataObj,
        "error:",
        validationError,
      );
      return {
        success: false,
        error: validationError,
      };
    }

    const { data: newArtifact, error: artifactError } = await supabase
      .from("mission_artifacts")
      .insert(artifactPayload)
      .select("id") // 作成された artifact の ID を取得
      .single();

    if (artifactError) {
      console.error(
        `[Artifact Error] type=${artifactTypeLabel} payload=`,
        artifactPayload,
        "formData:",
        formDataObj,
        `error= ${artifactError.code} ${artifactError.message}`,
      );
      return {
        success: false,
        error: `成果物の保存に失敗しました: ${artifactError.message}`,
      };
    }

    if (!newArtifact) {
      return {
        success: false,
        error: "成果物レコードの作成に失敗しました。",
      };
    }

    // 位置情報がある場合は mission_artifact_geolocations に記録
    if (
      validatedRequiredArtifactType ===
        ARTIFACT_TYPES.IMAGE_WITH_GEOLOCATION.key &&
      validatedData.requiredArtifactType ===
        ARTIFACT_TYPES.IMAGE_WITH_GEOLOCATION.key
    ) {
      const geolocationPayload: TablesInsert<"mission_artifact_geolocations"> =
        {
          mission_artifact_id: newArtifact.id,
          lat: Number.parseFloat(validatedData.latitude),
          lon: Number.parseFloat(validatedData.longitude),
          accuracy: validatedData.accuracy
            ? Number.parseFloat(validatedData.accuracy)
            : null,
          altitude: validatedData.altitude
            ? Number.parseFloat(validatedData.altitude)
            : null,
        };
      const { error: geoError } = await supabase
        .from("mission_artifact_geolocations")
        .insert(geolocationPayload);

      if (geoError) {
        console.error(
          `Geolocation Error: ${geoError.code} ${geoError.message}`,
        );
        // 成果物レコードは作成済みだが、位置情報保存に失敗した場合のハンドリング
        // ここではエラーメッセージを出すに留めるが、より丁寧なエラー処理も検討可能
        return {
          success: false,
          error: `位置情報の保存に失敗しました: ${geoError.message}`,
        };
      }
    }

    // ポスティング活動の詳細情報を保存
    if (
      validatedRequiredArtifactType === ARTIFACT_TYPES.POSTING.key &&
      validatedData.requiredArtifactType === ARTIFACT_TYPES.POSTING.key
    ) {
      const { error: postingError } = await supabase
        .from("posting_activities")
        .insert({
          mission_artifact_id: newArtifact.id,
          posting_count: validatedData.postingCount,
          location_text: validatedData.locationText,
        });

      if (postingError) {
        console.error("Posting activity save error:", postingError);
        return {
          success: false,
          error: `ポスティング活動の保存に失敗しました: ${postingError.message}`,
        };
      }

      // ポスティング用のポイント計算とXP付与
      const pointsPerUnit = POSTING_POINTS_PER_UNIT; // 固定値（フェーズ1では固定、フェーズ2で設定テーブルから取得予定）
      const totalPoints = validatedData.postingCount * pointsPerUnit;

      // 通常のXP（グッジョブ難易度ベース）に加えて、ポスティングボーナスXPを付与
      const bonusXpResult = await grantXp(
        authUser.id,
        totalPoints,
        "BONUS",
        achievement.id,
        `ポスティング活動ボーナス（${validatedData.postingCount}枚×${pointsPerUnit}ポイント）`,
      );

      if (!bonusXpResult.success) {
        console.error(
          "ポスティングボーナスXP付与に失敗しました:",
          bonusXpResult.error,
        );
        // ボーナスXP付与の失敗はグッジョブ達成の成功を妨げない
      } else {
        totalXpGranted += totalPoints;
      }
    }
  }

  // グッジョブ達成時にXPを付与
  const xpResult = await grantMissionCompletionXp(
    authUser.id,
    validatedMissionId,
    achievement.id,
  );

  if (!xpResult.success) {
    console.error("XP付与に失敗しました:", {
      error: xpResult.error,
      userId: authUser.id,
      missionId: validatedMissionId,
      achievementId: achievement.id,
    });
    // XP付与の失敗はグッジョブ達成の成功を妨げない
    // バックフィル処理で後から補完可能
  }
  totalXpGranted += xpResult?.xpGranted ?? 0;
  return {
    success: true,
    message: "グッジョブを達成しました！",
    xpGranted: totalXpGranted,
    userLevel: xpResult.userLevel,
  };
};

export const cancelSubmissionAction = async (formData: FormData) => {
  const achievementId = formData.get("achievementId")?.toString();
  const missionId = formData.get("missionId")?.toString();

  // zodによるバリデーション
  const validatedFields = cancelSubmissionFormSchema.safeParse({
    achievementId,
    missionId,
  });

  if (!validatedFields.success) {
    return {
      success: false,
      error: validatedFields.error.errors
        .map((error) => error.message)
        .join("\n"),
    };
  }

  const {
    achievementId: validatedAchievementId,
    missionId: validatedMissionId,
  } = validatedFields.data;

  const supabase = await createClient();

  // ユーザーがログイン済みかチェック
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) {
    return { success: false, error: "認証エラーが発生しました。" };
  }

  // 達成記録が存在し、ユーザーのものかチェック
  const { data: achievement, error: achievementFetchError } = await supabase
    .from("achievements")
    .select("id, user_id, mission_id")
    .eq("id", validatedAchievementId)
    .eq("user_id", authUser.id)
    .single();

  if (achievementFetchError || !achievement) {
    console.error("Achievement fetch error:", achievementFetchError);
    return {
      success: false,
      error: "達成記録が見つからないか、アクセス権限がありません。",
    };
  }

  // mission_idがnullでないことを確認
  if (!achievement.mission_id) {
    return {
      success: false,
      error: "グッジョブIDが見つかりません。",
    };
  }

  // グッジョブ情報を取得してXP計算のための難易度を確認
  const { data: missionData, error: missionFetchError } = await supabase
    .from("missions")
    .select("difficulty, title, slug")
    .eq("id", achievement.mission_id)
    .single();

  if (missionFetchError || !missionData) {
    console.error("Mission fetch error:", missionFetchError);
    return {
      success: false,
      error: "グッジョブ情報の取得に失敗しました。",
    };
  }

  // 達成記録を削除（CASCADE により関連する mission_artifacts と mission_artifact_geolocations も削除される）
  const { error: deleteError } = await supabase
    .from("achievements")
    .delete()
    .eq("id", validatedAchievementId);

  if (deleteError) {
    console.error(`Delete Error: ${deleteError.code} ${deleteError.message}`);
    return {
      success: false,
      error: `達成の取り消しに失敗しました: ${deleteError.message}`,
    };
  }

  // XPを減算する（グッジョブ達成時に付与されたXPを取り消し）
  const xpToRevoke = calculateMissionXp(missionData.difficulty);
  const isBonusMission = [
    "posting-magazine",
    "put-up-poster-on-board",
  ].includes(missionData.slug);
  const bonusXp = isBonusMission
    ? await getUserXpBonus(authUser.id, validatedAchievementId)
    : 0;
  const totalXpToRevoke = xpToRevoke + bonusXp;

  const xpResult = await grantXp(
    authUser.id,
    -totalXpToRevoke, // 負の値でXPを減算
    "MISSION_CANCELLATION",
    validatedAchievementId,
    `グッジョブ「${missionData.title}」の提出取り消しによる経験値減算`,
  );

  if (!xpResult.success) {
    console.error("XP減算に失敗しました:", xpResult.error);
    // XP減算の失敗はエラーとして扱うが、達成記録は既に削除済み
    return {
      success: false,
      error: `達成の取り消しは完了しましたが、経験値の減算に失敗しました: ${xpResult.error}`,
    };
  }

  return {
    success: true,
    message: "達成を取り消しました。",
    xpRevoked: xpToRevoke,
    userLevel: xpResult.userLevel,
  };
};
