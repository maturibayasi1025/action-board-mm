import { isOwner } from "@/lib/utils/isOwner";
import { redirect } from "next/navigation";
import { AssessmentTable } from "./_components/assessment-table";

export const runtime = "edge";

export default async function AssessmentExportPage() {
  const owner = await isOwner();
  if (!owner) {
    redirect("/");
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">査定データエクスポート</h1>
          <p className="text-muted-foreground">
            メンバーごとのアクティビティ（グッジョブ投稿数、称賛数、いいね数など）を期間で絞り込み、CSVでダウンロードできます。
          </p>
        </div>

        <AssessmentTable />
      </div>
    </div>
  );
}
