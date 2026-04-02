import { listCompaniesAndUnits } from "@/app/(protected)/admin/business-units/actions";
import { UserBusinessUnitsAssign } from "@/components/admin/user-business-units-assign";
import { isOwner } from "@/lib/utils/isOwner";
import { redirect } from "next/navigation";

export const runtime = "edge";

export default async function UserBusinessUnitsPage() {
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
          <h1 className="text-3xl font-bold mb-2">ユーザー事業部の割り当て</h1>
          <p className="text-muted-foreground">
            ユーザーを検索し、所属事業部を設定します（経営者のみ）。
          </p>
        </div>
        <UserBusinessUnitsAssign
          companies={result.companies}
          units={result.units}
        />
      </div>
    </div>
  );
}
