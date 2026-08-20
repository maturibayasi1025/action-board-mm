"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  adminSuspendUser,
  adminUnsuspendUser,
} from "@/lib/actions/admin/users-and-companies";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

type Props = {
  userId: string;
  userName: string;
  currentUserId: string | null;
  isSuspended: boolean;
};

export function AdminSuspendUserButton({
  userId,
  userName,
  currentUserId,
  isSuspended,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (currentUserId !== null && userId === currentUserId) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  function confirm() {
    startTransition(async () => {
      const result = isSuspended
        ? await adminUnsuspendUser(userId)
        : await adminSuspendUser(userId);
      if (result.success) {
        toast.success(
          isSuspended ? "ユーザーを再開しました" : "ユーザーを停止しました",
        );
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        variant={isSuspended ? "outline" : "secondary"}
        size="sm"
        onClick={() => setOpen(true)}
        disabled={isPending}
      >
        {isSuspended ? "再開" : "停止"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isSuspended
                ? "ユーザーを再開しますか？"
                : "ユーザーを停止しますか？"}
            </DialogTitle>
            <DialogDescription>
              {isSuspended
                ? `「${userName}」の停止を解除します。公開面と集計に再び表示されます。`
                : `「${userName}」を停止します。ログインできなくなり、ランキングや集計からも除外されます。XPや達成データは残ります。`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              キャンセル
            </Button>
            <Button
              type="button"
              variant={isSuspended ? "default" : "destructive"}
              onClick={confirm}
              disabled={isPending}
            >
              {isPending
                ? isSuspended
                  ? "再開中…"
                  : "停止中…"
                : isSuspended
                  ? "再開する"
                  : "停止する"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
