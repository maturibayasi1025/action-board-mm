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
import { inviteUser } from "@/lib/actions/admin/users-and-companies";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

type Props = {
  companies: { id: string; name: string }[];
  units: { id: string; company_id: string; name: string }[];
};

export function AdminInviteUserForm({ companies, units }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [businessUnitId, setBusinessUnitId] = useState("__none");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await inviteUser({
        email,
        businessUnitId: businessUnitId === "__none" ? null : businessUnitId,
      });
      if (result.success) {
        toast.success("招待メールを送信しました");
        setEmail("");
        setBusinessUnitId("__none");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>ユーザーを招待</CardTitle>
        <CardDescription>
          招待メールを送ります。相手がリンクを開いてパスワードを設定すると登録が完了します。事業部は任意です。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-email">メールアドレス</Label>
            <Input
              id="invite-email"
              type="email"
              name="email"
              required
              autoComplete="off"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isPending}
            />
          </div>
          {units.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="invite-business-unit">所属事業部（任意）</Label>
              <Select
                value={businessUnitId}
                onValueChange={setBusinessUnitId}
                disabled={isPending}
              >
                <SelectTrigger id="invite-business-unit">
                  <SelectValue placeholder="未設定" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">未設定</SelectItem>
                  {companies.map((company) => {
                    const companyUnits = units.filter(
                      (u) => u.company_id === company.id,
                    );
                    if (companyUnits.length === 0) return null;
                    return (
                      <SelectGroup key={company.id}>
                        <SelectLabel>{company.name}</SelectLabel>
                        {companyUnits.map((unit) => (
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
          )}
          <Button type="submit" disabled={isPending || !email}>
            {isPending ? "送信中…" : "招待メールを送信"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
