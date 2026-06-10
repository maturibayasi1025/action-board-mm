"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  BusinessUnitRow,
  CompanyRow,
} from "@/lib/actions/admin/business-units";
import {
  type SearchUserResult,
  searchUsers,
} from "@/lib/actions/admin/mvv-badges";
import {
  getUserBusinessUnit,
  updateUserBusinessUnit,
} from "@/lib/actions/admin/user-business-units";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

type Props = {
  companies: CompanyRow[];
  units: BusinessUnitRow[];
};

export function UserBusinessUnitsAssign({ companies, units }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUserResult[]>([]);
  const [selectedUser, setSelectedUser] = useState<SearchUserResult | null>(
    null,
  );
  const [unitId, setUnitId] = useState<string>("");

  function unitsForCompany(companyId: string) {
    return units.filter((u) => u.company_id === companyId);
  }

  async function handleSearch() {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const result = await searchUsers(searchQuery.trim());
    if (result.success) {
      setSearchResults(result.data);
      if (result.data.length === 0) {
        toast.info("該当するユーザーが見つかりませんでした");
      }
    } else {
      toast.error(result.error);
    }
  }

  async function pickUser(u: SearchUserResult) {
    setSelectedUser(u);
    setUnitId("");
    const cur = await getUserBusinessUnit(u.id);
    if (cur.success && cur.businessUnitId) {
      setUnitId(cur.businessUnitId);
    } else {
      setUnitId("__none");
    }
  }

  async function handleSave() {
    if (!selectedUser) return;
    startTransition(async () => {
      const r = await updateUserBusinessUnit(
        selectedUser.id,
        unitId === "" || unitId === "__none" ? null : unitId,
      );
      if (r.success) {
        toast.success("所属事業部を更新しました");
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>ユーザーの事業部を設定</CardTitle>
        <CardDescription>
          ユーザーを検索し、所属事業部を選択して保存します。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-wrap gap-2 items-end max-w-xl">
          <div className="space-y-1 flex-1 min-w-[200px]">
            <Label htmlFor="user-search">名前またはメール</Label>
            <Input
              id="user-search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleSearch();
                }
              }}
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => void handleSearch()}
          >
            検索
          </Button>
        </div>

        {searchResults.length > 0 && (
          <ul className="border rounded-md divide-y max-w-xl">
            {searchResults.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 hover:bg-muted text-sm"
                  onClick={() => pickUser(u)}
                >
                  {u.name}
                  {u.email ? ` (${u.email})` : ""}
                </button>
              </li>
            ))}
          </ul>
        )}

        {selectedUser && (
          <div className="space-y-4 max-w-xl border rounded-lg p-4">
            <p className="font-medium">
              選択中: {selectedUser.name}
              {selectedUser.email ? ` (${selectedUser.email})` : ""}
            </p>
            <div className="space-y-2">
              <Label>所属事業部</Label>
              <Select value={unitId} onValueChange={setUnitId}>
                <SelectTrigger>
                  <SelectValue placeholder="未設定（クリアする場合は「未設定」）" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">未設定</SelectItem>
                  {companies
                    .filter((c) => c.is_active)
                    .map((company) => {
                      const activeUnits = unitsForCompany(company.id).filter(
                        (u) => u.is_active,
                      );
                      if (activeUnits.length === 0) return null;
                      return (
                        <SelectGroup key={company.id}>
                          <SelectLabel>{company.name}</SelectLabel>
                          {activeUnits.map((unit) => (
                            <SelectItem key={unit.id} value={unit.id}>
                              {unit.name}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      );
                    })}
                </SelectContent>
              </Select>
            </div>
            <Button type="button" onClick={handleSave} disabled={isPending}>
              保存
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
