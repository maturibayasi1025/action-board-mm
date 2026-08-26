"use client";

import { submitOfficeCheckinAction } from "@/app/(protected)/office-check/actions";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

type Props = {
  isPresent: boolean;
};

export function OfficeCheckinButton({ isPresent }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function handleCheckin() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const result = await submitOfficeCheckinAction();
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("入室を記録し、Slackへ通知しました");
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("入室の記録に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  if (isPresent) {
    return <p className="text-sm text-muted-foreground">いま在室中です。</p>;
  }

  return (
    <Button type="button" onClick={handleCheckin} disabled={submitting}>
      {submitting ? "記録中..." : "入室する"}
    </Button>
  );
}
