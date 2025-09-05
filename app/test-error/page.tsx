"use client";

import { captureError, testSentry } from "@/lib/sentry/client";
import { useState } from "react";

export const runtime = "edge";

export default function TestErrorPage() {
  const [errorType, setErrorType] = useState<string>("");

  const triggerError = (type: string) => {
    setErrorType(type);

    try {
      switch (type) {
        case "sync":
          // 同期エラー
          throw new Error(`Test sync error: ${new Date().toISOString()}`);

        case "async":
          // 非同期エラー
          setTimeout(() => {
            try {
              throw new Error(`Test async error: ${new Date().toISOString()}`);
            } catch (error) {
              captureError(error as Error, { type: "async", test: true });
            }
          }, 100);
          return; // throwしないでreturnする

        case "promise":
          // Promiseリジェクション
          Promise.reject(
            new Error(`Test promise rejection: ${new Date().toISOString()}`),
          ).catch((error) => {
            captureError(error, { type: "promise", test: true });
          });
          return;

        case "reference":
          // 参照エラー
          // @ts-ignore
          undefinedFunction();
          break;

        case "type":
          // 型エラー
          // @ts-ignore
          null.toString();
          break;

        case "sentry-test":
          // Sentryテスト専用
          testSentry();
          return;

        default:
          console.log("Unknown error type");
          return;
      }
    } catch (error) {
      // エラーをSentryに送信
      captureError(error as Error, { type, test: true });
      // 開発環境ではコンソールにも表示
      console.error(`[${type} Error]`, error);
    }
  };

  const testLogger = async () => {
    // カスタムロガーのテスト
    const response = await fetch("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        message: "Test error from test-error page",
        level: "error",
        environment: process.env.NODE_ENV,
        context: {
          page: "/test-error",
          userAgent: navigator.userAgent,
        },
      }),
    });

    const result = await response.json();
    alert(`Logger test result: ${JSON.stringify(result)}`);
  };

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">エラーテストページ</h1>

        <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-8">
          <p className="font-bold">⚠️ 注意</p>
          <p>
            このページは開発・テスト用です。本番環境では使用しないでください。
          </p>
        </div>

        <div className="space-y-6">
          {/* Sentryテストセクション */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">
              🔴 Sentryエラーテスト
            </h2>
            <p className="text-gray-600 mb-4">
              以下のボタンをクリックすると、意図的にエラーを発生させます。
              Sentryが正しく設定されていれば、エラーがキャプチャされます。
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => triggerError("sentry-test")}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-bold"
              >
                🎯 Sentryテスト
              </button>
              <button
                type="button"
                onClick={() => triggerError("sync")}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                同期エラー
              </button>
              <button
                type="button"
                onClick={() => triggerError("async")}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                非同期エラー
              </button>
              <button
                type="button"
                onClick={() => triggerError("promise")}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                Promiseエラー
              </button>
              <button
                type="button"
                onClick={() => triggerError("reference")}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                参照エラー
              </button>
              <button
                type="button"
                onClick={() => triggerError("type")}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                型エラー
              </button>
            </div>
          </div>

          {/* カスタムロガーテストセクション */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">
              📝 カスタムロガーテスト
            </h2>
            <p className="text-gray-600 mb-4">
              カスタムエラーロギングシステムをテストします。
            </p>
            <button
              type="button"
              onClick={testLogger}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              ロガーAPIテスト
            </button>
          </div>

          {/* 設定状態表示 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">⚙️ 現在の設定</h2>
            <dl className="space-y-2">
              <div>
                <dt className="font-semibold">環境:</dt>
                <dd className="text-gray-600">{process.env.NODE_ENV}</dd>
              </div>
              <div>
                <dt className="font-semibold">Sentry DSN:</dt>
                <dd className="text-gray-600">
                  {process.env.NEXT_PUBLIC_SENTRY_DSN ? "設定済み" : "未設定"}
                </dd>
              </div>
              <div>
                <dt className="font-semibold">Sentry無効化フラグ:</dt>
                <dd className="text-gray-600">
                  {process.env.NEXT_PUBLIC_DISABLE_SENTRY === "true"
                    ? "無効"
                    : "有効"}
                </dd>
              </div>
            </dl>
          </div>

          {/* 確認手順 */}
          <div className="bg-blue-50 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">✅ 確認手順</h2>
            <ol className="list-decimal list-inside space-y-2 text-gray-700">
              <li>.env.localにSentry DSNを設定</li>
              <li>開発サーバーを再起動（npm run dev）</li>
              <li>上記のエラーボタンをクリック</li>
              <li>ブラウザコンソールでエラーを確認</li>
              <li>Sentryダッシュボードでエラーが記録されているか確認</li>
            </ol>
          </div>
        </div>

        {/* 最後にトリガーしたエラータイプ */}
        {errorType && (
          <div className="mt-6 p-4 bg-gray-100 rounded">
            <p className="text-sm text-gray-600">
              最後にトリガーしたエラー: <strong>{errorType}</strong>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
