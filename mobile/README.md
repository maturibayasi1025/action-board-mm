# Action Board — Expo WebView（Phase 1）

既存の Next.js アクションボードを `react-native-webview` で表示する社内向け PoC です。

## ドキュメント

| 文書 | 内容 |
|------|------|
| [docs/phase1-verification.md](docs/phase1-verification.md) | 実機・シミュレータ用の確認チェックリスト |
| [docs/webview-risks.md](docs/webview-risks.md) | 画像・位置情報・LINE・外部リンク・セッションの検証観点 |
| [docs/api-boundary.md](docs/api-boundary.md) | ネイティブ化時に HTTP/RPC へ切り出す Server Action / 既存 API 一覧 |
| [docs/internal-distribution.md](docs/internal-distribution.md) | EAS Build による社内配布（APK / TestFlight・simctl 注意） |

## 前提

- Node.js / npm
- [Expo CLI](https://docs.expo.dev/get-started/installation/)（`npx expo` で可）
- iOS シミュレータまたは Android エミュレータ、および実機での動作確認用

## 設定

1. 環境変数を設定する（プロジェクトルートは `mobile/`）。

   ```bash
   cp .env.example .env
   ```

   `EXPO_PUBLIC_ACTION_BOARD_URL` に、表示したいアクションボードのオリジンを書く（末尾スラッシュなし推奨）。

2. ローカル Next.js（`npm run dev` が `:3000`）を WebView から開く場合:

   - **iOS シミュレータ**: `http://localhost:3000` で可
   - **Android エミュレータ**: `http://10.0.2.2:3000`
   - **実機**: PC の LAN IP（例: `http://192.168.x.x:3000`）

## 起動

```bash
cd mobile
npm install
npx expo start
```

あとは Expo Go またはエミュレータで接続。本番に近い検証（ファイル入力・OAuth など）は EAS でのプレビュービルドを推奨。手順は [internal-distribution.md](docs/internal-distribution.md) を参照。

## Phase 1 で確認すべきこと

詳細は [webview-risks.md](docs/webview-risks.md) と [phase1-verification.md](docs/phase1-verification.md) に集約した。

- ログイン（メール・LINE 等）とセッション維持
- ミッション閲覧・提出（画像・位置情報を含む）
- 外部ブラウザ遷移や OAuth コールバック
- Android 戻るボタンと WebView の履歴

問題が出た箇所は Web 本体側の調整または Phase 2 以降のネイティブ化対象として切り出す（[api-boundary.md](docs/api-boundary.md)）。
