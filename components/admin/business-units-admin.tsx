"use client";

import {
  type BusinessUnitRow,
  type CompanyRow,
  createBusinessUnit,
  createCompany,
  updateBusinessUnit,
  updateCompany,
} from "@/app/(protected)/admin/business-units/actions";
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
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

type Props = {
  companies: CompanyRow[];
  units: BusinessUnitRow[];
};

export function BusinessUnitsAdmin({ companies, units }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newCompanySlug, setNewCompanySlug] = useState("");
  const [newCompanyOrder, setNewCompanyOrder] = useState(0);
  const [newCompanyActive, setNewCompanyActive] = useState(true);

  function unitsForCompany(companyId: string) {
    return units.filter((u) => u.company_id === companyId);
  }

  async function handleCreateCompany(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("name", newCompanyName);
    fd.set("slug", newCompanySlug);
    fd.set("display_order", String(newCompanyOrder));
    if (newCompanyActive) fd.set("is_active", "on");
    startTransition(async () => {
      const r = await createCompany(fd);
      if (r.success) {
        toast.success("会社を登録しました");
        setNewCompanyName("");
        setNewCompanySlug("");
        setNewCompanyOrder(0);
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  async function submitUpdateCompany(company: CompanyRow, e: React.FormEvent) {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const fd = new FormData(form);
    startTransition(async () => {
      const r = await updateCompany(company.id, fd);
      if (r.success) {
        toast.success("会社を更新しました");
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  async function handleCreateUnit(companyId: string, e: React.FormEvent) {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const fd = new FormData(form);
    fd.set("company_id", companyId);
    startTransition(async () => {
      const r = await createBusinessUnit(fd);
      if (r.success) {
        toast.success("事業部を登録しました");
        form.reset();
        const active = form.querySelector<HTMLInputElement>(
          'input[name="is_active"]',
        );
        if (active) active.checked = true;
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  async function submitUpdateUnit(unit: BusinessUnitRow, e: React.FormEvent) {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const fd = new FormData(form);
    startTransition(async () => {
      const r = await updateBusinessUnit(unit.id, fd);
      if (r.success) {
        toast.success("事業部を更新しました");
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>会社を追加</CardTitle>
          <CardDescription>新しい会社をマスタに登録します。</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateCompany} className="space-y-4 max-w-md">
            <div className="space-y-2">
              <Label htmlFor="new-company-name">会社名</Label>
              <Input
                id="new-company-name"
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
                required
                placeholder="例: enginepot"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-company-slug">slug（任意）</Label>
              <Input
                id="new-company-slug"
                value={newCompanySlug}
                onChange={(e) => setNewCompanySlug(e.target.value)}
                placeholder="例: enginepot"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-company-order">表示順</Label>
              <Input
                id="new-company-order"
                type="number"
                value={newCompanyOrder}
                onChange={(e) => setNewCompanyOrder(Number(e.target.value))}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="new-company-active"
                checked={newCompanyActive}
                onChange={(e) => setNewCompanyActive(e.target.checked)}
                className="h-4 w-4"
              />
              <Label htmlFor="new-company-active">有効</Label>
            </div>
            <Button type="submit" disabled={isPending}>
              会社を登録
            </Button>
          </form>
        </CardContent>
      </Card>

      {companies.map((company) => (
        <Card key={company.id}>
          <CardHeader>
            <CardTitle>{company.name}</CardTitle>
            <CardDescription>
              ID: {company.id}
              {company.is_active ? "" : "（無効）"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form
              onSubmit={(e) => submitUpdateCompany(company, e)}
              className="grid gap-4 md:grid-cols-2 max-w-2xl border rounded-lg p-4"
            >
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor={`name-${company.id}`}>会社名</Label>
                <Input
                  id={`name-${company.id}`}
                  name="name"
                  defaultValue={company.name}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`slug-${company.id}`}>slug</Label>
                <Input
                  id={`slug-${company.id}`}
                  name="slug"
                  defaultValue={company.slug ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`order-${company.id}`}>表示順</Label>
                <Input
                  id={`order-${company.id}`}
                  name="display_order"
                  type="number"
                  defaultValue={company.display_order}
                />
              </div>
              <div className="flex items-center gap-2 md:col-span-2">
                <input
                  type="checkbox"
                  name="is_active"
                  value="on"
                  id={`active-${company.id}`}
                  defaultChecked={company.is_active}
                  className="h-4 w-4"
                />
                <Label htmlFor={`active-${company.id}`}>有効</Label>
              </div>
              <Button
                type="submit"
                disabled={isPending}
                className="md:col-span-2 w-fit"
              >
                会社を保存
              </Button>
            </form>

            <div>
              <h4 className="font-medium mb-2">事業部を追加</h4>
              <form
                onSubmit={(e) => handleCreateUnit(company.id, e)}
                className="flex flex-wrap gap-2 items-end max-w-xl"
              >
                <input type="hidden" name="company_id" value={company.id} />
                <div className="space-y-1">
                  <Label htmlFor={`unit-name-${company.id}`}>事業部名</Label>
                  <Input
                    id={`unit-name-${company.id}`}
                    name="name"
                    required
                    placeholder="例: epSES"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`unit-order-${company.id}`}>表示順</Label>
                  <Input
                    id={`unit-order-${company.id}`}
                    name="display_order"
                    type="number"
                    defaultValue={0}
                  />
                </div>
                <div className="flex items-center gap-2 pb-2">
                  <input
                    type="checkbox"
                    name="is_active"
                    value="on"
                    id={`unit-new-active-${company.id}`}
                    defaultChecked
                    className="h-4 w-4"
                  />
                  <Label htmlFor={`unit-new-active-${company.id}`}>有効</Label>
                </div>
                <Button type="submit" size="sm" disabled={isPending}>
                  追加
                </Button>
              </form>
            </div>

            <div className="space-y-4">
              <h4 className="font-medium">登録済み事業部</h4>
              {unitsForCompany(company.id).length === 0 ? (
                <p className="text-sm text-muted-foreground">まだありません</p>
              ) : (
                unitsForCompany(company.id).map((unit) => (
                  <form
                    key={unit.id}
                    onSubmit={(e) => submitUpdateUnit(unit, e)}
                    className="flex flex-wrap gap-2 items-end border rounded p-3"
                  >
                    <div className="space-y-1">
                      <Label htmlFor={`u-name-${unit.id}`}>name</Label>
                      <Input
                        id={`u-name-${unit.id}`}
                        name="name"
                        defaultValue={unit.name}
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`u-order-${unit.id}`}>表示順</Label>
                      <Input
                        id={`u-order-${unit.id}`}
                        name="display_order"
                        type="number"
                        defaultValue={unit.display_order}
                      />
                    </div>
                    <div className="flex items-center gap-2 pb-2">
                      <input
                        type="checkbox"
                        name="is_active"
                        value="on"
                        id={`u-active-${unit.id}`}
                        defaultChecked={unit.is_active}
                        className="h-4 w-4"
                      />
                      <Label htmlFor={`u-active-${unit.id}`}>有効</Label>
                    </div>
                    <Button
                      type="submit"
                      size="sm"
                      variant="secondary"
                      disabled={isPending}
                    >
                      保存
                    </Button>
                  </form>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
