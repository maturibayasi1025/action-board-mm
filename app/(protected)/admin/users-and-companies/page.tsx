import {
  type UserWithCompanyRow,
  listUsersWithCompanies,
} from "@/app/(protected)/admin/users-and-companies/actions";
import { AdminDeleteUserButton } from "@/components/admin/admin-delete-user-button";
import { UsersAndCompaniesCsvDownload } from "@/components/admin/users-and-companies-csv-download";
import { createClient } from "@/lib/supabase/server";
import { isOwner } from "@/lib/utils/isOwner";
import Link from "next/link";
import { redirect } from "next/navigation";

export const runtime = "edge";

const UNSET_KEY = "__no_company__";

type CompanyGroup = {
  companyLabel: string;
  users: UserWithCompanyRow[];
};

function buildCompanyGroups(users: UserWithCompanyRow[]): CompanyGroup[] {
  const byKey = new Map<string, UserWithCompanyRow[]>();
  for (const u of users) {
    const key = u.companyName ?? UNSET_KEY;
    const list = byKey.get(key);
    if (list) {
      list.push(u);
    } else {
      byKey.set(key, [u]);
    }
  }
  for (const list of Array.from(byKey.values())) {
    list.sort((a, b) => a.name.localeCompare(b.name, "ja"));
  }
  const keys = Array.from(byKey.keys()).sort((a, b) => {
    if (a === UNSET_KEY) {
      return 1;
    }
    if (b === UNSET_KEY) {
      return -1;
    }
    return a.localeCompare(b, "ja");
  });
  return keys.map((key) => ({
    companyLabel: key === UNSET_KEY ? "（会社未設定）" : key,
    users: byKey.get(key) ?? [],
  }));
}

export default async function UsersAndCompaniesPage() {
  const owner = await isOwner();
  if (!owner) {
    redirect("/");
  }

  const supabase = await createClient();
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();
  const currentUserId = currentUser?.id ?? null;

  const result = await listUsersWithCompanies();
  if (!result.success) {
    return (
      <div className="container mx-auto py-8 px-4">
        <p className="text-destructive">{result.error}</p>
      </div>
    );
  }

  const { users } = result;
  const byCompany = buildCompanyGroups(users);

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">
              ユーザー一覧（会社・事業部）
            </h1>
            <p className="text-muted-foreground">
              登録ユーザーを会社ごとにまとめて表示します。プロフィールに事業部が未設定の場合は「（会社未設定）」に含まれます。CSVでは在籍中の登録者を会社・表示名順でダウンロードできます。各行からユーザーを削除できます（ソフト削除。グッジョブは残ります。経営者のみ。自分自身と経営者アカウントは削除できません）。
            </p>
          </div>
          <UsersAndCompaniesCsvDownload users={users} />
        </div>

        {byCompany.length > 1 && (
          <nav
            className="rounded-lg border border-border bg-muted/20 px-4 py-3"
            aria-label="会社へのジャンプ"
          >
            <p className="text-xs font-medium text-muted-foreground mb-2">
              会社にジャンプ
            </p>
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {byCompany.map((g, i) => (
                <li key={g.companyLabel}>
                  <a
                    className="text-primary hover:underline"
                    href={`#company-group-${i}`}
                  >
                    {g.companyLabel}（{g.users.length}）
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}

        <div className="space-y-10">
          {users.length === 0 ? (
            <p className="text-muted-foreground">
              ユーザーがまだ登録されていません。
            </p>
          ) : (
            byCompany.map((group, i) => (
              <section
                key={group.companyLabel}
                id={`company-group-${i}`}
                className="scroll-mt-4"
              >
                <h2 className="text-lg font-semibold border-b border-border pb-2 mb-3">
                  {group.companyLabel}
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    {group.users.length} 名
                  </span>
                </h2>
                <div className="rounded-lg border border-border overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left min-w-[480px]">
                      <thead className="bg-muted/50 border-b border-border">
                        <tr>
                          <th className="px-4 py-2 font-medium" scope="col">
                            表示名
                          </th>
                          <th className="px-4 py-2 font-medium" scope="col">
                            事業部
                          </th>
                          <th
                            className="px-4 py-2 font-medium w-[120px] text-right"
                            scope="col"
                          >
                            操作
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.users.map((u) => (
                          <tr
                            key={u.id}
                            className="border-b border-border last:border-0 hover:bg-muted/30"
                          >
                            <td className="px-4 py-2.5">
                              <Link
                                href={`/users/${u.id}`}
                                className="text-primary hover:underline font-medium"
                              >
                                {u.name}
                              </Link>
                            </td>
                            <td className="px-4 py-2.5 text-muted-foreground">
                              {u.businessUnitName ?? "—"}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <AdminDeleteUserButton
                                userId={u.id}
                                userName={u.name}
                                currentUserId={currentUserId}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            ))
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          全 {users.length} 名（公開プロフィール基準）・ 会社 {byCompany.length}{" "}
          区分
        </p>
      </div>
    </div>
  );
}
