"use client";

import { useEffect } from "react";
import { toast } from "sonner";

/**
 * Service Worker を登録する。描画はしない（SentryInitializer と同じパターン）。
 *
 * - 本番ビルドのみ登録（dev は HMR 事故防止のためスキップ）。
 * - 新バージョン検知時は sonner トーストで再読み込みを促し、ユーザー操作で切り替える
 *   （SW 側で skipWaiting を自動実行しないため、セッション中の突然のリロードを防ぐ）。
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    let reloading = false;
    const hadController = !!navigator.serviceWorker.controller;
    let firstControllerChangeHandled = false;

    // 新 SW が有効化されたらページをリロードして反映
    const onControllerChange = () => {
      if (reloading) return;
      // 初回登録時（コントローラーがなかった場合）は claim によるコントロール取得なのでリロード不要
      // 更新時（既存コントローラーからの切替）のみリロード
      if (!hadController && !firstControllerChangeHandled) {
        firstControllerChangeHandled = true;
        return;
      }
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      onControllerChange,
    );

    const promptUpdate = (worker: ServiceWorker) => {
      toast("新しいバージョンがあります", {
        id: "sw-update",
        description: "再読み込みすると最新の状態になります。",
        duration: Number.POSITIVE_INFINITY,
        action: {
          label: "再読み込み",
          onClick: () => worker.postMessage({ type: "SKIP_WAITING" }),
        },
      });
    };

    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((registration) => {
        // 既に待機中の SW がいれば即案内
        if (registration.waiting && navigator.serviceWorker.controller) {
          promptUpdate(registration.waiting);
        }

        // 既にインストール中の SW がいれば statechange を監視
        if (registration.installing) {
          const installing = registration.installing;
          installing.addEventListener("statechange", () => {
            if (
              installing.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              promptUpdate(installing);
            }
          });
        }

        // 以降の更新を検知
        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (
              installing.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              promptUpdate(installing);
            }
          });
        });
      })
      .catch(() => {
        /* 登録失敗は致命的ではないので握りつぶす */
      });

    return () => {
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange,
      );
    };
  }, []);

  return null;
}
