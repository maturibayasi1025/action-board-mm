"use client";

import NextError from "next/error";
import { useEffect } from "react";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    // エラーの詳細情報を複数の方法で出力
    console.group("🚨 Global Error Debugging");

    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    console.error("Error digest:", error.digest);
    console.error("Error stack:", error.stack);
    console.error("Error cause:", error.cause);

    // エラーオブジェクト全体をJSON化して出力
    try {
      const errorInfo = JSON.stringify(
        error,
        Object.getOwnPropertyNames(error),
        2,
      );
      console.error("Error as JSON:", errorInfo);
    } catch (jsonError) {
      console.error("JSON serialization failed:", jsonError);
      console.error("Raw error object:", error);
    }

    // エラーのすべてのプロパティを列挙
    console.error("Error properties:", Object.getOwnPropertyNames(error));
    console.error("Error keys:", Object.keys(error));

    // プロトタイプチェーンも確認
    console.error("Error prototype:", Object.getPrototypeOf(error));

    // 可能な限り詳細な情報を取得
    console.error("Error toString:", error.toString());
    console.error("Error valueOf:", error.valueOf());

    // Error.cause が存在する場合は詳細を調査
    if (error.cause) {
      const cause = error.cause as Error | Record<string, unknown> | unknown;
      console.error("Error cause details:", {
        causeName:
          typeof cause === "object" && cause !== null && "name" in cause
            ? cause.name
            : undefined,
        causeMessage:
          typeof cause === "object" && cause !== null && "message" in cause
            ? cause.message
            : undefined,
        causeStack:
          typeof cause === "object" && cause !== null && "stack" in cause
            ? cause.stack
            : undefined,
        causeToString: String(error.cause),
      });

      // さらに詳細な原因情報
      try {
        console.error(
          "Error cause as JSON:",
          JSON.stringify(
            error.cause,
            Object.getOwnPropertyNames(error.cause),
            2,
          ),
        );
      } catch {
        console.error("Error cause (raw):", error.cause);
      }
    }

    console.groupEnd();
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
