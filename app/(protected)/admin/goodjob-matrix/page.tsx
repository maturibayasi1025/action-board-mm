import { isOwner } from "@/lib/utils/isOwner";
import { redirect } from "next/navigation";
import { MatrixTable } from "./_components/matrix-table";

export const runtime = "edge";

export default async function GoodjobMatrixPage() {
  // 経営者権限チェック
  const owner = await isOwner();
  if (!owner) {
    redirect("/");
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">グッジョブマトリクス表</h1>
          <p className="text-muted-foreground">
            メンバーごとのグッジョブ受領状況をバリュー別に可視化します。
            期間を選択して、各メンバーがどのバリューでグッジョブをもらったかを確認できます。
          </p>
        </div>

        <MatrixTable />
      </div>
    </div>
  );
}
