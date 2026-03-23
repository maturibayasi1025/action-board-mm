"use client";

import {
  type SurveyReminderKind,
  sendSlackReminderToUnanswered,
} from "@/app/(protected)/admin/_actions/slack-unanswered-reminder";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState, useTransition } from "react";
import { toast } from "sonner";

const MESSAGE_PLACEHOLDER =
  "アンケートへのご回答がまだの方は、お手すきの際にご協力をお願いします。（空欄のときはこの文面が使われます）";

type UnansweredSlackReminderProps = {
  kind: SurveyReminderKind;
  surveyId: string;
};

export function UnansweredSlackReminder({
  kind,
  surveyId,
}: UnansweredSlackReminderProps) {
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  const handleSend = () => {
    startTransition(async () => {
      const result = await sendSlackReminderToUnanswered({
        kind,
        surveyId,
        message,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      if (result.unmatchedNames.length > 0) {
        toast.success("Slack に送信しました", {
          description: `メンションに解決できなかった名前: ${result.unmatchedNames.join("、")}`,
        });
      } else {
        toast.success("Slack に送信しました");
      }
    });
  };

  return (
    <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
      <div className="space-y-2">
        <Label htmlFor={`slack-reminder-${surveyId}`}>
          Slack 通知の本文（任意）
        </Label>
        <Textarea
          id={`slack-reminder-${surveyId}`}
          placeholder={MESSAGE_PLACEHOLDER}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          disabled={pending}
          className="resize-y min-h-[80px]"
        />
      </div>
      <Button type="button" onClick={handleSend} disabled={pending}>
        {pending ? "送信中…" : "Slack に未回答者へ通知"}
      </Button>
    </div>
  );
}
