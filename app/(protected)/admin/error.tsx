"use client";

import { Button } from "@/components/ui/button";
import logger from "@/lib/logger";
import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";

// 例外の内容やスタックには取得クエリの詳細が含まれうるので、画面には出さずログにだけ残す
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    logger.log(error, { type: "admin-error", digest: error.digest });
  }, [error]);

  // サーバーで描画した部分の失敗は、refresh で取り直さないと同じ結果を再表示するだけになる
  const retry = () => {
    startTransition(() => {
      router.refresh();
      reset();
    });
  };

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-16 text-center">
      <h2 className="text-lg font-bold">データの取得に失敗しました</h2>
      <p className="text-sm text-muted-foreground">
        時間をおいて、もう一度お試しください。
      </p>
      <Button type="button" onClick={retry} disabled={isPending}>
        再試行
      </Button>
    </div>
  );
}
