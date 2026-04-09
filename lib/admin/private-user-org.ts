/**
 * private_users のネスト取得（business_units → companies）から
 * 会社名・事業部名を取り出す。PostgREST の単一/配列の揺れを吸収する。
 */

export type PrivateUserOrgRow = {
  id: string;
  name: string;
  business_units:
    | {
        name: string;
        companies?: { name: string } | { name: string }[] | null | undefined;
      }
    | {
        name: string;
        companies?: { name: string } | { name: string }[] | null | undefined;
      }[]
    | null;
};

export function companyAndBusinessUnitFromPrivateUserRow(
  row: PrivateUserOrgRow,
): { company_name: string; business_unit_name: string } {
  const raw = row.business_units;
  const bu = Array.isArray(raw) ? raw[0] : raw;
  if (!bu) {
    return { company_name: "", business_unit_name: "" };
  }
  const co = bu.companies;
  const company = Array.isArray(co) ? co[0] : co;
  return {
    company_name: company?.name?.trim() ?? "",
    business_unit_name: bu.name?.trim() ?? "",
  };
}
