/*
 * MAISON MARC アクションボード — Service Worker (Phase 1: インストール可能化)
 *
 * 方針:
 *  - ビルドパイプラインに介入しない手書き静的 SW（public/sw.js）。
 *  - 認証/動的処理は一切キャッシュしない（Supabase / Server Action / API / OAuth をバイパス）。
 *  - navigation は network-first（middleware の認証リダイレクトを常に通す）。失敗時のみ offline.html。
 *  - 静的アセット（_next/static, icons, img）は cache-first（stale-while-revalidate）。
 *
 * キャッシュを破棄したいときは CACHE_VERSION を上げる。
 */

const CACHE_VERSION = "v1";
const STATIC_CACHE = `mm-static-${CACHE_VERSION}`;
const OFFLINE_URL = "/offline.html";

// install 時に確実に持っておきたいもの（オフライン fallback と主要アイコン）
const PRECACHE_URLS = [
  OFFLINE_URL,
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch(() => {
        /* プリキャッシュ失敗は致命的ではないので握りつぶす */
      }),
  );
  // skipWaiting() はここでは呼ばない。
  // 突然のコントローラ切替でセッション中ページが壊れるのを避け、更新はユーザー操作で行う。
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // 旧バージョンのキャッシュを掃除
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("mm-static-") && key !== STATIC_CACHE)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

// 更新フロー: クライアントからの SKIP_WAITING で待機中 SW を有効化
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/img/")
  );
}

// cache-first + 裏で更新（stale-while-revalidate）
async function staleWhileRevalidate(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response?.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => undefined);
  return cached || (await network) || fetch(request);
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // 1) キャッシュ厳禁（バイパス＝ブラウザ既定の取得に任せる）
  if (request.method !== "GET") return; // Server Action POST 等
  if (url.origin !== self.location.origin) return; // Supabase 含む他オリジン
  if (url.pathname.startsWith("/api/")) return; // API Route
  if (url.pathname.startsWith("/auth/")) return; // OAuth コールバック等

  // 2) navigation = network-first（認証/リダイレクトを常に通す）+ オフライン fallback
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(STATIC_CACHE);
        const offline = await cache.match(OFFLINE_URL);
        return (
          offline ||
          new Response("オフラインです", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          })
        );
      }),
    );
    return;
  }

  // 3) 静的アセット = cache-first（SWR）
  if (isStaticAsset(url)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // 4) それ以外はネットワーク優先（キャッシュしない）
});
