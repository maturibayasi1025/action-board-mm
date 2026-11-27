"use client";

import { MissionGuidanceArrow } from "@/components/mission/MissionGuidanceArrow";
import { ARTIFACT_TYPES } from "@/lib/artifactTypes";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/types/supabase";
import type { User } from "@supabase/supabase-js";
import { useState } from "react";
import QRCode from "react-qr-code"; // 必要に応じてnpm install react-qr-code
import { useMissionSubmission } from "../_hooks/useMissionSubmission";
import { fetchSubmissionHistory } from "../_lib/submission-history";
import type { SubmissionData } from "../_lib/types";
import { CopyReferralButton } from "./CopyReferralButton";
import { MissionFormWrapper } from "./MissionFormWrapper";
import QRCodeDisplay from "./QRCodeDisplay";
import { SubmissionHistoryWrapper } from "./SubmissionHistoryWrapper";

type Props = {
  mission: Tables<"missions">;
  authUser: User;
  referralCode: string | null;
  /** 初期表示の提出履歴。サーバーでの取得に失敗したら null */
  initialSubmissions: SubmissionData[] | null;
  missionId: string;
  preloadedQuizQuestions?:
    | {
        id: string;
        question: string;
        options: string[];
        category?: string;
      }[]
    | null;
  mainLink: Tables<"mission_main_links"> | null;
};

export function MissionWithSubmissionHistory({
  mission,
  authUser,
  referralCode,
  initialSubmissions,
  missionId,
  preloadedQuizQuestions,
  mainLink,
}: Props) {
  const [submissions, setSubmissions] = useState<SubmissionData[] | null>(
    initialSubmissions,
  );
  const [refreshFailed, setRefreshFailed] = useState(false);
  const userAchievementCount = submissions?.length ?? 0;

  // useMissionSubmissionフックを使用して統一
  const { hasReachedUserMaxAchievements } = useMissionSubmission(
    mission,
    userAchievementCount,
  );

  // 取り直しに失敗したら、表示中の履歴を残してその場に失敗を出す
  const refreshSubmissions = async () => {
    try {
      setSubmissions(
        await fetchSubmissionHistory(createClient(), authUser.id, missionId),
      );
      setRefreshFailed(false);
    } catch (error) {
      console.error("Failed to refresh submissions:", error);
      setRefreshFailed(true);
    }
  };

  // クライアントサイドでのみwindow.location.originを使用
  const origin =
    process.env.NEXT_PUBLIC_APP_ORIGIN ||
    (typeof window !== "undefined" ? window.location.origin : "");
  const signupUrl = `${origin}/?ref=${referralCode}`;

  // LINK,QUIZ,リファラルは視覚的導線を表示しない
  const isNoGuidanceArrow =
    mission.required_artifact_type === ARTIFACT_TYPES.LINK_ACCESS.key ||
    mission.required_artifact_type === ARTIFACT_TYPES.QUIZ.key ||
    mission.required_artifact_type === ARTIFACT_TYPES.REFERRAL.key;

  // フォームが表示される条件と同じ
  const shouldShowGuidanceArrow =
    submissions !== null &&
    (!hasReachedUserMaxAchievements ||
      mission.required_artifact_type === ARTIFACT_TYPES.LINK_ACCESS.key) &&
    !isNoGuidanceArrow;

  return (
    <>
      {/* フォームと同じ条件で視覚的導線を表示 */}
      {shouldShowGuidanceArrow && <MissionGuidanceArrow />}
      {mission.required_artifact_type === "REFERRAL" &&
        authUser &&
        referralCode && (
          <div className="bg-white rounded-xl border-2 p-6 flex flex-col items-center">
            <p className="mb-2 font-semibold text-center text-lg">
              あなた専用紹介URL
            </p>
            <p className="text-sm text-muted-foreground">
              あなた専用の紹介URLを周りの人に共有して、紹介URLから登録が完了すると、自動でグッジョブクリア回数がカウントされます。
            </p>
            <p className="text-sm mt-4 font-bold">QRコードをスキャン</p>
            <QRCodeDisplay value={signupUrl} />
            <p className="text-sm">または</p>
            <CopyReferralButton referralUrl={signupUrl} />
          </div>
        )}

      {!submissions ? (
        <p
          role="alert"
          className="rounded-xl border-2 p-6 text-center text-sm text-muted-foreground"
        >
          提出履歴の取得に失敗しました。時間をおいて、ページを再読み込みしてください。
        </p>
      ) : (
        <>
          {mission.required_artifact_type !== "REFERRAL" && (
            <MissionFormWrapper
              mission={mission}
              authUser={authUser}
              userAchievementCount={userAchievementCount}
              onSubmissionSuccess={refreshSubmissions}
              preloadedQuizQuestions={preloadedQuizQuestions}
              mainLink={mainLink}
            />
          )}

          {refreshFailed && (
            <p role="alert" className="text-center text-sm text-red-600">
              提出履歴の更新に失敗しました。ページを再読み込みすると最新の履歴が表示されます。
            </p>
          )}

          {submissions.length > 0 && (
            <SubmissionHistoryWrapper
              submissions={submissions}
              missionId={missionId}
              userId={authUser.id}
              maxAchievementCount={mission.max_achievement_count || 0}
            />
          )}
        </>
      )}
    </>
  );
}
