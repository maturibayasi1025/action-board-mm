import { MvvBadgeForm } from "@/components/admin/mvv-badge-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isOwner } from "@/lib/utils/isOwner";
import { redirect } from "next/navigation";

export const runtime = "edge";

export default async function MvvBadgesAdminPage() {
  // 経営者権限チェック
  const owner = await isOwner();
  if (!owner) {
    redirect("/");
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">MVVバッジ管理</h1>
          <p className="text-muted-foreground">
            三つのバリュー（「夢中になってやり切る」「至高な人間関係」「幸せの循環」）に基づくバッジを手動で付与・管理します。
            3ヶ月ごと（四半期）にバッジを付与する人が増えていく仕組みをサポートしています。
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>MVVバッジの付与</CardTitle>
            <CardDescription>
              ユーザーを検索して、三つのバリューそれぞれに対してバッジを付与できます。
              四半期ごとにバッジを管理できます。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MvvBadgeForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
