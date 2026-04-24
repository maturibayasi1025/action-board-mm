"use client";

import { adminDeleteUser } from "@/app/(protected)/admin/users-and-companies/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

type Props = {
  userId: string;
  userName: string;
  currentUserId: string | null;
};

export function AdminDeleteUserButton({
  userId,
  userName,
  currentUserId,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (currentUserId !== null && userId === currentUserId) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  function confirmDelete() {
    startTransition(async () => {
      const result = await adminDeleteUser(userId);
      if (result.success) {
        toast.success("ユーザーを削除しました");
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
        variant="destructive"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={isPending}
      >
        削除
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ユーザーを削除しますか？</DialogTitle>
            <DialogDescription>
              「{userName}
              」の認証アカウントとプロフィールを削除します。グッジョブ等の紐づくデータはデータベースの定義に従って消える場合があります。取り消しはできません。
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
              variant="destructive"
              onClick={confirmDelete}
              disabled={isPending}
            >
              {isPending ? "削除中…" : "削除する"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
