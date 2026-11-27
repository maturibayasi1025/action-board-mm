"use client";

import logger from "@/lib/logger";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset?: () => void;
}) {
  useEffect(() => {
    // カスタムロガーでエラーを記録
    logger.log(error, {
      type: "global-error",
      digest: error.digest,
      cause: error.cause,
    });

    // 開発環境では詳細なデバッグ情報も出力
    if (process.env.NODE_ENV === "development") {
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
    }
  }, [error]);

  return (
    <html lang="ja">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
          color: "#374151",
        }}
      >
        <main style={{ textAlign: "center", padding: "24px" }}>
          <h1 style={{ fontSize: "24px", color: "#111827" }}>
            エラーが発生しました
          </h1>
          <p>申し訳ありません。時間をおいてもう一度お試しください。</p>
          {error.digest && (
            <p style={{ fontSize: "12px", color: "#6b7280" }}>
              エラーID: {error.digest}
            </p>
          )}
          {reset && (
            <button
              type="button"
              onClick={reset}
              style={{
                marginTop: "16px",
                padding: "8px 16px",
                backgroundColor: "#2563eb",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
              }}
            >
              もう一度試す
            </button>
          )}
        </main>
      </body>
    </html>
  );
}
