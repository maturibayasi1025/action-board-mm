import { CreateMissionForm } from "@/components/user-mission/create-mission-form";
import { createClient } from "@/lib/supabase/server";
import type { MvvItem } from "@/lib/types/user-missions";
import { notFound, redirect } from "next/navigation";

export const runtime = "edge";

async function getDraftById(id: string) {
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

  // 下書き（pending）のみ編集可能
  if (data.status !== "pending") {
    return null;
  }

  return {
    id: data.id,
    title: data.title,
    content: data.content,
    praisedUserIds:
      data.user_mission_praised_users?.map(
        (p: { praised_user_id: string }) => p.praised_user_id,
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
  const draft = await getDraftById(id);

  if (!draft) {
    notFound();
  }

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">グッジョブを編集</h1>
        <p className="text-muted-foreground mt-2">
          下書きを編集して、準備ができたら公開できます。
        </p>
      </div>

      <CreateMissionForm
        draftId={draft.id}
        initialData={{
          title: draft.title,
          content: draft.content,
          praisedUserIds: draft.praisedUserIds,
          mvvItems: draft.mvvItems,
        }}
      />
    </div>
  );
}
