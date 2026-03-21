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

  return (
    <>
      <Card className="mb-6 border-primary/20 bg-muted/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" onClick={() => setDialogOpen(true)}>
            グッジョブの達成を記録する
          </Button>
        </CardContent>
      </Card>

      <SurveyPostMissionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mission={linkedPostMission.mission}
        authUser={authUser}
      />
    </>
  );
}
