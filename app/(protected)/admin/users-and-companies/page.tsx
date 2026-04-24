import { listUsersWithCompanies } from "@/app/(protected)/admin/users-and-companies/actions";
import { isOwner } from "@/lib/utils/isOwner";
import Link from "next/link";
import { redirect } from "next/navigation";

export const runtime = "edge";

export default async function UsersAndCompaniesPage() {
  const owner = await isOwner();
  if (!owner) {
    redirect("/");
  }

  const result = await listUsersWithCompanies();
  if (!result.success) {
    return (
      <div className="container mx-auto py-8 px-4">
        <p className="text-destructive">{result.error}</p>
      </div>
    );
  }

  const { users } = result;

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">
            ユーザー一覧（会社・事業部）
          </h1>
          <p className="text-muted-foreground">
            登録ユーザーの表示名と、プロフィールに紐づいている会社・事業部を一覧します（経営者のみ）。
          </p>
        </div>

        <div className="rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left min-w-[640px]">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-4 py-3 font-medium" scope="col">
                    表示名
                  </th>
                  <th className="px-4 py-3 font-medium" scope="col">
                    会社
                  </th>
                  <th className="px-4 py-3 font-medium" scope="col">
                    事業部
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-muted-foreground" colSpan={3}>
                      ユーザーがまだ登録されていません。
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr
                      key={u.id}
                      className="border-b border-border last:border-0 hover:bg-muted/30"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/users/${u.id}`}
                          className="text-primary hover:underline font-medium"
                        >
                          {u.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {u.companyName ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {u.businessUnitName ?? "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          全 {users.length} 名（公開プロフィール基準）
        </p>
      </div>
    </div>
  );
}
