"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  type AwardLateGrantRow,
  createAwardLateSubmissionGrant,
} from "@/lib/actions/admin/late-grant";
import {
  type EnpsLateGrantRow,
  createEnpsLateSubmissionGrant,
} from "@/lib/actions/admin/late-grant";
import { useState } from "react";
import { toast } from "sonner";

type Candidate = { id: string; name: string };

interface LateSubmissionGrantPanelProps {
  surveyId: string;
  kind: "award" | "enps";
  unansweredCandidates: Candidate[];
  existingGrants: AwardLateGrantRow[] | EnpsLateGrantRow[];
}

export function LateSubmissionGrantPanel({
  surveyId,
  kind,
  unansweredCandidates,
  existingGrants,
}: LateSubmissionGrantPanelProps) {
  const [userId, setUserId] = useState<string>("");
  const [pending, setPending] = useState(false);
  const [lastUrl, setLastUrl] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!userId) {
      toast.error("ユーザーを選択してください");
      return;
    }
    setPending(true);
    setLastUrl(null);
    try {
      const result =
        kind === "award"
          ? await createAwardLateSubmissionGrant(surveyId, userId)
          : await createEnpsLateSubmissionGrant(surveyId, userId);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setLastUrl(result.answerUrl);
      toast.success(
        "期限後回答用のリンクを発行しました（この画面に一度だけ表示されます）",
      );
    } catch (e) {
      console.error(e);
      toast.error("付与の作成に失敗しました");
    } finally {
      setPending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>期限後回答（管理者承認）</CardTitle>
        <CardDescription>
          回答終了後、未回答のメンバーに対してのみワンタイムURLを発行できます。本番集計（指名・NPSの期限内枠）とは別枠で記録されます。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <label className="text-sm font-medium" htmlFor="late-grant-user">
              対象ユーザー（未回答のみ）
            </label>
            <select
              id="late-grant-user"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
            >
              <option value="">選択してください</option>
              {unansweredCandidates.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
          <Button
            type="button"
            onClick={() => void handleCreate()}
            disabled={pending || unansweredCandidates.length === 0}
          >
            {pending ? "発行中…" : "リンクを発行"}
          </Button>
        </div>

        {lastUrl ? (
          <div className="space-y-2 rounded-md border border-dashed p-3">
            <p className="text-sm font-medium">
              発行したURL（再表示されません）
            </p>
            <Input readOnly value={lastUrl} className="font-mono text-xs" />
          </div>
        ) : null}

        {existingGrants.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">付与履歴</p>
            <div className="rounded-md border divide-y text-sm">
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 px-3 py-2 bg-muted/40 font-medium text-xs text-muted-foreground">
                <span>対象</span>
                <span className="whitespace-nowrap">作成</span>
                <span className="whitespace-nowrap">期限</span>
                <span>状態</span>
              </div>
              {existingGrants.map((g) => (
                <div
                  key={g.id}
                  className="grid grid-cols-[1fr_auto_auto_auto] gap-2 px-3 py-2 items-start"
                >
                  <span>{g.user_name}</span>
                  <span className="whitespace-nowrap text-muted-foreground text-xs">
                    {new Date(g.created_at).toLocaleString("ja-JP")}
                  </span>
                  <span className="whitespace-nowrap text-xs">
                    {new Date(g.expires_at).toLocaleString("ja-JP")}
                  </span>
                  <span>
                    {g.used_at ? (
                      <span className="text-muted-foreground text-xs">
                        使用済 {new Date(g.used_at).toLocaleString("ja-JP")}
                      </span>
                    ) : new Date(g.expires_at) < new Date() ? (
                      <span className="text-destructive text-xs">期限切れ</span>
                    ) : (
                      <span className="text-xs">未使用</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
