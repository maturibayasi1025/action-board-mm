# WebView モバイル検証 — リスクと観点

Expo WebView 内で既存 Next.js アプリを動かすとき、ブラウザと差が出やすい箇所の整理。実機・ステージング URL での確認結果を `phase1-verification.md` に追記する。

## 1. 画像投稿

**Web 側**: ファイル入力、`FileReader` プレビュー、Supabase Storage `upload`。例: `components/user-mission/image-uploader.tsx`。

**WebView での論点**

- OS の写真ピッカー／カメラ連携は WKWebView / Android WebView の実装依存。Expo Go とスタンドアロンビルドで挙動差が出ることがある。
- アップロードサイズ制限・MIME 検証は Web と同じだが、通信失敗時のエラーメッセージだけでは原因の切り分けが難しい場合がある。

**確認**: 画像付きミッション／ユーザーグッジョブで選択〜アップロード〜表示まで通す。

## 2. 位置情報

**Web 側**: `navigator.geolocation`。例: `components/mission/GeolocationInput.tsx`。

**WebView での論点**

- 初回は OS の位置情報許可ダイアログ。WebView からの要求として正しく出るか、拒否時の文言がユーザーに伝わるかを確認。
- 高精度・タイムアウト設定はブラウザ実装依存なりうる。

**確認**: 位置情報付き成果物タイプで取得〜送信まで通す。

## 3. LINE ログイン

**Web 側**: `access.line.me` へのリダイレクト、`localStorage` で state、`/api/auth/callback/line` 経由で `/auth/line-callback`。例: `lib/auth/line-auth.ts`、`app/auth/line-callback/page.tsx`。

**WebView での論点**

- OAuth は外部ドメイン遷移が多い。同一 WebView 内で完結するか、別ウィンドウが開いてコールバックが失敗するかを要確認。
- `setSupportMultipleWindows={false}` のまま別ターゲットで開くケースがあると詰まる可能性がある（必要なら `onOpenWindow` や方針変更を Phase 2 で検討）。
- LINE チャンネルのコールバック URL は **HTTPS の固定オリジン** が前提のことが多い。開発用 `http://` の LAN IP ではコールバックが合わず失敗しうる。

**確認**: ステージング／本番オリジンで LINE ログイン〜マイページ到達まで。失敗時は Safari/Chrome との比較で切り分ける。

## 4. 外部リンク・OAuth・別タブ

**Web 側**: `window.open`、`target=_blank`、SNS 共有など。

**WebView での論点**

- 社内 PoC では同一 WebView で追従できるようにしているが、銀行アプリ同様「外側ブラウザで開く」方がよいリンクもある。
- メール認証の「リンクをタップ」がメールアプリから OS ブラウザで開く場合、WebView 内セッションと別になる点に注意。

**確認**: ミッション内の外部リンク、パスワードリセットメールの流れなど、利用手順に沿って試す。

## 5. セッション維持（Cookie / ストレージ）

**Web 側**: `@supabase/ssr` と Cookie、クライアントでは `localStorage`（LINE 等）。

**WebView での論点**

- `domStorageEnabled`、`sharedCookiesEnabled`（iOS）、`thirdPartyCookiesEnabled`（Android）を有効化済み（`App.tsx`）。サードパーティ Cookie 制限は今後の OS ポリシーで変わりうる。
- アプリプロセスキル後の復帰、長時間バックグラウンド後のリフレッシュトークン更新は実機で確認する価値がある。

**確認**: ログイン後にアプリ終了→再起動、翌日再開など、運用に近いシナリオがあれば実施。

## 6. その他

- **キーボード**: フォーム入力でレイアウトが隠れないか（長文・ファイル入力付近）。
- **ファイルダウンロード / CSV**: `WebView` 単体ではダウンロード挙動がブラウザと異なることがある。管理画面を開く場合は要確認。
