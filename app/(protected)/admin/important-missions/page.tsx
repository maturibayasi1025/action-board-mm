import { ImportantMissionForm } from "@/components/admin/important-mission-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isOwner } from "@/lib/utils/isOwner";
import { redirect } from "next/navigation";
import { getImportantMissions } from "./actions";

export const runtime = "edge";

export default async function ImportantMissionsAdminPage() {
  // 経営者権限チェック
  const owner = await isOwner();
  if (!owner) {
    redirect("/");
  }

  // 共有グッジョブ一覧を取得
  const missionsResult = await getImportantMissions();
  const importantMissions =
    missionsResult.success && missionsResult.data ? missionsResult.data : [];

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">共有グッジョブ管理</h1>
          <p className="text-muted-foreground">
            共有グッジョブを設定・管理します。期間設定により、特定の期間のみ表示することもできます。
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>共有グッジョブを設定</CardTitle>
            <CardDescription>
              既存のグッジョブを共有グッジョブとして設定するか、新規グッジョブを作成して共有グッジョブとして設定できます
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ImportantMissionForm />
          </CardContent>
        </Card>

        {importantMissions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>現在の共有グッジョブ一覧</CardTitle>
              <CardDescription>
                現在設定されている共有グッジョブの一覧です
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {importantMissions.map((mission) => (
                  <div
                    key={mission.id}
                    className="border rounded-lg p-4 space-y-2"
                  >
                    <h3 className="font-semibold text-lg">{mission.title}</h3>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>
                        設定日時:{" "}
                        {new Date(mission.created_at).toLocaleString("ja-JP")}
                      </p>
                      {mission.important_display_start_date && (
                        <p>
                          表示開始:{" "}
                          {new Date(
                            mission.important_display_start_date,
                          ).toLocaleString("ja-JP")}
                        </p>
                      )}
                      {mission.important_display_end_date && (
                        <p>
                          表示終了:{" "}
                          {new Date(
                            mission.important_display_end_date,
                          ).toLocaleString("ja-JP")}
                        </p>
                      )}
                      {!mission.important_display_start_date &&
                        !mission.important_display_end_date && (
                          <p className="text-green-600">常に表示</p>
                        )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
