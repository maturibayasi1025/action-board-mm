"use client";

import { Share, X } from "lucide-react";
import { useEffect, useState } from "react";

const DISMISS_KEY = "pwa-a2hs-dismissed";

// beforeinstallprompt は標準 TS lib に無いため最小定義
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * ホーム画面への追加を促すバナー。
 *
 * - iOS Safari: 自動プロンプトが無いため「共有 → ホーム画面に追加」を手動案内。
 * - Android (Chrome 等): beforeinstallprompt を捕捉し、ワンタップでインストール。
 * - 既にインストール済み（standalone 起動）/ 一度閉じた場合は表示しない。
 *
 * Expo WebView を PWA で置き換える方針上、iOS の追加導線は採用率に直結するため Phase 1 に含める。
 */
export function AddToHomeScreenGuide() {
  const [mode, setMode] = useState<"ios" | "android" | null>(null);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // 既にインストール済み（standalone）なら出さない
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (isStandalone) return;

    // 一度閉じていれば出さない
    try {
      if (localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      /* localStorage 不可環境は無視 */
    }

    const ua = navigator.userAgent;
    const isIOS =
      /iPad|iPhone|iPod/.test(ua) ||
      (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
    // 実 Safari のみ（CriOS 等の別ブラウザ・アプリ内 WebView を除外）
    const isSafari =
      /Safari/.test(ua) &&
      /Version\//.test(ua) &&
      !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);

    if (isIOS && isSafari) {
      setMode("ios");
      return;
    }

    // Android (Chrome 等): インストール可能になったら捕捉
    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setMode("android");
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    };
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* noop */
    }
    setMode(null);
  };

  const install = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setMode(null);
  };

  if (!mode) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      <div className="mx-auto flex max-w-md items-center gap-3 rounded-xl border border-border bg-background p-3 shadow-lg">
        <img
          src="/icons/icon-192.png"
          alt=""
          className="h-10 w-10 flex-shrink-0 rounded-lg"
        />
        <div className="min-w-0 flex-1">
          {mode === "ios" ? (
            <p className="text-sm leading-5 text-foreground">
              ホーム画面に追加するとアプリのように使えます。
              <br />
              <span className="inline-flex items-center gap-1 text-foreground/80">
                共有
                <Share className="inline h-4 w-4" aria-hidden />
                から「ホーム画面に追加」を選んでください。
              </span>
            </p>
          ) : (
            <p className="text-sm leading-5 text-foreground">
              ホーム画面に追加するとアプリのように使えます。
            </p>
          )}
        </div>
        {mode === "android" && (
          <button
            type="button"
            onClick={install}
            className="flex-shrink-0 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
          >
            追加
          </button>
        )}
        <button
          type="button"
          onClick={dismiss}
          aria-label="閉じる"
          className="flex-shrink-0 rounded-full p-1.5 text-foreground/60 hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
