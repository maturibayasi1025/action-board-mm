"use client";

import type { InvitationRow } from "@/app/(protected)/admin/users-and-companies/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  cancelInvitation,
  resendInvitation,
} from "@/lib/actions/admin/users-and-companies";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

type Props = {
  invitations: InvitationRow[];
};

export function AdminPendingInvitations({ invitations }: Props) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(
    invitationId: string,
    action: typeof resendInvitation | typeof cancelInvitation,
    successMessage: string,
  ) {
    setPendingId(invitationId);
    startTransition(async () => {
      const result = await action(invitationId);
      setPendingId(null);
      if (result.success) {
        toast.success(successMessage);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>未完了の招待</CardTitle>
        <CardDescription>
          まだパスワード設定が終わっていない招待です。再送または取消ができます。
        </CardDescription>
      </CardHeader>
      <CardContent>
        {invitations.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            未完了の招待はありません。
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm text-left min-w-[480px]">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-4 py-2 font-medium" scope="col">
                    メールアドレス
                  </th>
                  <th className="px-4 py-2 font-medium" scope="col">
                    事業部
                  </th>
                  <th className="px-4 py-2 font-medium" scope="col">
                    送信日時
                  </th>
                  <th
                    className="px-4 py-2 font-medium w-[200px] text-right"
                    scope="col"
                  >
                    操作
                  </th>
                </tr>
              </thead>
              <tbody>
                {invitations.map((invitation) => (
                  <tr
                    key={invitation.id}
                    className="border-b border-border last:border-0"
                  >
                    <td className="px-4 py-2.5">{invitation.email}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {invitation.businessUnitName
                        ? invitation.companyName
                          ? `${invitation.companyName} / ${invitation.businessUnitName}`
                          : invitation.businessUnitName
                        : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {new Date(invitation.createdAt).toLocaleString("ja-JP")}
                    </td>
                    <td className="px-4 py-2.5 text-right space-x-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isPending && pendingId === invitation.id}
                        onClick={() =>
                          run(
                            invitation.id,
                            resendInvitation,
                            "招待メールを再送しました",
                          )
                        }
                      >
                        再送
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isPending && pendingId === invitation.id}
                        onClick={() =>
                          run(
                            invitation.id,
                            cancelInvitation,
                            "招待を取り消しました",
                          )
                        }
                      >
                        取消
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
