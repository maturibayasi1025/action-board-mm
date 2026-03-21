"use client";

import type { LinkedPostMissionContext } from "@/app/(protected)/surveys/_lib/linked-post-mission.types";
import { SurveyPostMissionDialog } from "@/components/survey/SurveyPostMissionDialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { User } from "@supabase/supabase-js";
import { useState } from "react";

type Props = {
  title: string;
  description: string;
  linkedPostMission: LinkedPostMissionContext;
  authUser: User;
};

export function SurveyLinkedGoodjobCta({
  title,
  description,
  linkedPostMission,
  authUser,
}: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const alreadyDone = linkedPostMission.alreadyRecordedInActiveSurveyPeriod;

  return (
    <>
      <Card className="mb-6 border-primary/20 bg-muted/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button
            type="button"
            disabled={alreadyDone}
            onClick={() => setDialogOpen(true)}
          >
            {alreadyDone
              ? "この受付期間は記録済みです"
              : "グッジョブの達成を記録する"}
          </Button>
          {alreadyDone && (
            <p className="text-sm text-muted-foreground">
              次の受付が始まるまで、再度の記録はできません。
            </p>
          )}
        </CardContent>
      </Card>

      <SurveyPostMissionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mission={linkedPostMission.mission}
        authUser={authUser}
        alreadyRecordedInActiveSurveyPeriod={
          linkedPostMission.alreadyRecordedInActiveSurveyPeriod
        }
      />
    </>
  );
}
