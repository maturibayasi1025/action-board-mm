"use client";

import { useState } from "react";

export function McpTokenCopy({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className="inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm"
      onClick={async () => {
        await navigator.clipboard.writeText(token);
        setCopied(true);
      }}
    >
      {copied ? "コピーしました" : "トークンをコピー"}
    </button>
  );
}
