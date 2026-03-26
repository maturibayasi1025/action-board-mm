"use client";

import {
  addGlobalUnansweredExclusion,
  removeGlobalUnansweredExclusion,
} from "@/app/(protected)/admin/_actions/unanswered-global-exclusions";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

type UnansweredExclusionPanelProps = {
  unansweredUsers: { id: string; name: string }[];
  excludedGlobalUsers: { id: string; name: string }[];
};

export function UnansweredExclusionPanel({
  unansweredUsers,
  excludedGlobalUsers,
}: UnansweredExclusionPanelProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const handleExclude = (userId: string) => {
    startTransition(async () => {
      const result = await addGlobalUnansweredExclusion(userId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("未回答催促の対象外にしました");
      router.refresh();
    });
  };

  const handleRemove = (userId: string) => {
    startTransition(async () => {
      const result = await removeGlobalUnansweredExclusion(userId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("対象外を解除しました");
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      {unansweredUsers.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-2 gap-y-3">
          {unansweredUsers.map((user) => (
            <div
              key={user.id}
              className="flex items-start justify-between gap-2 text-sm min-w-0"
            >
              <span className="truncate pt-0.5">{user.name}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="shrink-0 h-7 px-2 text-xs"
                disabled={pending}
                onClick={() => handleExclude(user.id)}
              >
                対象外
              </Button>
            </div>
          ))}
        </div>
      )}
      {excludedGlobalUsers.length > 0 && (
        <details className="rounded-lg border bg-muted/20 p-3">
          <summary className="cursor-pointer text-sm font-medium">
            催促対象外（全アンケート共通）{excludedGlobalUsers.length}名
          </summary>
          <p className="mt-2 text-xs text-muted-foreground mb-2">
            解除すると未回答一覧に再び表示されます。回答の可否や集計には影響しません。
          </p>
          <ul className="grid grid-cols-2 md:grid-cols-4 gap-x-2 gap-y-3 list-none p-0 m-0">
            {excludedGlobalUsers.map((u) => (
              <li
                key={u.id}
                className="flex items-start justify-between gap-2 text-sm min-w-0"
              >
                <span className="truncate pt-0.5">{u.name}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 h-7 px-2 text-xs"
                  disabled={pending}
                  onClick={() => handleRemove(u.id)}
                >
                  解除
                </Button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
