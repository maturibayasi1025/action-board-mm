"use client";

import type { UserWithCompanyRow } from "@/app/(protected)/admin/users-and-companies/actions";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

const UNSET_KEY = "__no_company__";
const UNSET_LABEL = "（会社未設定）";

function escapeCsvCell(value: string): string {
  if (value.includes(",") || value.includes("\n") || value.includes('"')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function companyLabelForExport(companyName: string | null): string {
  return companyName ?? UNSET_LABEL;
}

function sortUsersForCsv(users: UserWithCompanyRow[]): UserWithCompanyRow[] {
  return [...users].sort((a, b) => {
    const ca = a.companyName ?? UNSET_KEY;
    const cb = b.companyName ?? UNSET_KEY;
    if (ca !== cb) {
      if (ca === UNSET_KEY) {
        return 1;
      }
      if (cb === UNSET_KEY) {
        return -1;
      }
      return ca.localeCompare(cb, "ja");
    }
    return a.name.localeCompare(b.name, "ja");
  });
}

function buildCsvContent(users: UserWithCompanyRow[]): string {
  const headers = ["ユーザーID", "表示名", "会社", "事業部"];
  const sorted = sortUsersForCsv(users);
  const dataLines = sorted.map((u) =>
    [
      escapeCsvCell(u.id),
      escapeCsvCell(u.name),
      escapeCsvCell(companyLabelForExport(u.companyName)),
      escapeCsvCell(u.businessUnitName ?? ""),
    ].join(","),
  );
  return [headers.join(","), ...dataLines].join("\n");
}

function yyyymmddForFilename(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

type Props = {
  users: UserWithCompanyRow[];
};

export function UsersAndCompaniesCsvDownload({ users }: Props) {
  if (users.length === 0) {
    return null;
  }

  const handleDownload = () => {
    const csvContent = buildCsvContent(users);
    const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
    const blob = new Blob([bom, csvContent], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ユーザー一覧_会社事業部_${yyyymmddForFilename()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleDownload}
      className="shrink-0"
    >
      <Download className="h-4 w-4 mr-1.5" />
      CSVダウンロード
    </Button>
  );
}
