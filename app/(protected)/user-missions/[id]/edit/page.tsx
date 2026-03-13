import { CreateMissionForm } from "@/components/user-mission/create-mission-form";
import { EditApprovedMissionForm } from "@/components/user-mission/edit-approved-mission-form";
import { createClient } from "@/lib/supabase/server";
import type { MvvItem } from "@/lib/types/user-missions";
import { notFound, redirect } from "next/navigation";

export const runtime = "edge";

async function getMissionForEdit(id: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const { data, error } = await supabase
    .from("user_missions")
    .select(`
      *,
      user_mission_mvv_items (
        mvv_type
      ),
      user_mission_praised_users (
        praised_user_id
      ),
      user_mission_praised_external_users (
        praised_person_name
      )
    `)
    .eq("id", id)
    .single();

  if (error || !data) {
    return null;
  }

  // 作成者チェック
  if (data.created_by !== user.id) {
    return null;
  }

  // 下書きまたは公開済みのみ編集可能
  if (data.status !== "pending" && data.status !== "approved") {
    return null;
  }

  return {
    id: data.id,
    status: data.status as "pending" | "approved",
    title: data.title,
    content: data.content,
    imagePaths: ((data as unknown as { image_paths?: string[] }).image_paths ||
      []) as string[],
    praisedUserIds:
      data.user_mission_praised_users?.map(
        (p: { praised_user_id: string }) => p.praised_user_id,
      ) || [],
    praisedExternalUserNames:
      data.user_mission_praised_external_users?.map(
        (p: { praised_person_name: string }) => p.praised_person_name,
      ) || [],
    mvvItems: {
      passionateExecution:
        data.user_mission_mvv_items?.some(
          (item: MvvItem) => item.mvv_type === "passionate_execution",
        ) || false,
      supremeRelationships:
        data.user_mission_mvv_items?.some(
          (item: MvvItem) => item.mvv_type === "supreme_relationships",
        ) || false,
      happinessCirculation:
        data.user_mission_mvv_items?.some(
          (item: MvvItem) => item.mvv_type === "happiness_circulation",
        ) || false,
    },
  };
}

export default async function EditDraftPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const mission = await getMissionForEdit(id);

  if (!mission) {
    notFound();
  }

  const isDraft = mission.status === "pending";

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">グッジョブを編集</h1>
        <p className="text-muted-foreground mt-2">
          {isDraft
            ? "下書きを編集して、準備ができたら公開できます。"
            : "公開済みグッジョブの誤字脱字を修正できます。"}
        </p>
      </div>

      {isDraft ? (
        <CreateMissionForm
          draftId={mission.id}
          initialData={{
            title: mission.title,
            content: mission.content,
            praisedUserIds: mission.praisedUserIds,
            praisedExternalUserNames: mission.praisedExternalUserNames,
            imagePaths: mission.imagePaths,
            mvvItems: mission.mvvItems,
          }}
        />
      ) : (
        <EditApprovedMissionForm
          missionId={mission.id}
          initialData={{
            title: mission.title,
            content: mission.content,
          }}
        />
      )}
    </div>
  );
}
