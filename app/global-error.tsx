"use client";

import NextError from "next/error";
import { useEffect } from "react";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    // エラーの詳細情報をコンソールに出力
    console.error("Global error details:", {
      name: error.name,
      message: error.message,
      stack: error.stack,
      digest: error.digest,
      cause: error.cause,
    });

    // エラーオブジェクト全体も出力
    console.error("Full error object:", error);
  }, [error]);

  return (
    <html lang="ja">
      <body>
        <div style={{ padding: "20px", fontFamily: "monospace" }}>
          <h1>アプリケーションエラーが発生しました</h1>
          <p>詳細情報：</p>
          <ul>
            <li>Error Name: {error.name}</li>
            <li>Error Message: {error.message}</li>
            {error.digest && <li>Error Digest: {error.digest}</li>}
          </ul>
          <details>
            <summary>スタックトレース</summary>
            <pre style={{ whiteSpace: "pre-wrap", fontSize: "12px" }}>
              {error.stack}
            </pre>
          </details>
          <hr />
          <div style={{ marginTop: "20px" }}>
            <h2>デバッグ情報</h2>
            <p>
              この情報をブラウザのコンソールでも確認できます（F12キーを押してConsoleタブを開いてください）
            </p>
          </div>
        </div>
      </body>
    </html>
  );
}
