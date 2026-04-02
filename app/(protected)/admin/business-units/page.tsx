import { listCompaniesAndUnits } from "@/app/(protected)/admin/business-units/actions";
import { BusinessUnitsAdmin } from "@/components/admin/business-units-admin";
import { isOwner } from "@/lib/utils/isOwner";
import { redirect } from "next/navigation";

export default async function BusinessUnitsAdminPage() {
  const owner = await isOwner();
  if (!owner) {
    redirect("/");
  }

  const result = await listCompaniesAndUnits();
  if (!result.success) {
    return (
      <div className="container mx-auto py-8 px-4">
        <p className="text-destructive">{result.error}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">会社・事業部マスタ</h1>
          <p className="text-muted-foreground">
            会社と事業部を登録します。ユーザーはプロフィールで所属事業部を選択できます。
          </p>
        </div>
        <BusinessUnitsAdmin companies={result.companies} units={result.units} />
      </div>
    </div>
  );
}
