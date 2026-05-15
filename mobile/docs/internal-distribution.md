# 社内向け配布（EAS Build 前提）

ストア公募をせずに社内だけで配る場合の整理。詳細は [Expo EAS](https://docs.expo.dev/build/introduction/) を正とする。

## 事前準備

1. [Expo アカウント](https://expo.dev/) と、リポジトリの `mobile/` を EAS に関連付ける。
2. 初回のみプロジェクト登録:
   ```bash
   cd mobile
   npm install -g eas-cli   # または npx eas-cli
   eas login
   eas init
   ```
   `eas.json` は既にあるので、`eas init` で `projectId` が `app.config.ts` に反映される場合がある（プロンプトに従う）。

## Android（社内 APK / 内部テスト）

- **手元 APK**: `eas.json` の `preview` プロファイルは `buildType: "apk"` を想定。
  ```bash
  eas build --profile preview --platform android
  ```
  成果物を Slack 等で配布（インストール時は「不明なソース」を許可が必要な場合あり）。
- **Google Play Internal testing**: 同じ AAB を内部トラックに上げると運用が楽（組織ポリシー次第）。

## iOS（Ad Hoc / TestFlight）

- **Apple Developer Program** が必須。
- **TestFlight**: App Store Connect でアプリ登録後、`eas build --platform ios` で提出し、社内テスターを招待。最も運用しやすいことが多い。
- **Ad Hoc**: 端末 UDID をプロファイルに含める必要あり。人数が少ない PoC 向け。
- **Unlisted App / Custom Apps**: 組織の MDM や Apple Business Manager がある場合の選択肢。

## iOS シミュレータと `simctl` エラー

開発マシンで `Unable to run simctl` / `xcrun simctl` exit 72 が出る場合、**フル Xcode が未インストール**または **`xcode-select` が Command Line Tools だけを指している**ことが多い。シミュレータを使うには App Store の **Xcode** が必要。

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
xcrun simctl help
```

EAS **クラウドビルド** なら、ローカル simctl が無くても Android 実機や TestFlight で検証できる。

## 環境変数（ビルド時）

`EXPO_PUBLIC_ACTION_BOARD_URL` は **ステージング／本番の Web オリジン** を指すことが多い。EAS の Secrets / 環境変数でプロファイルごとに切り替える。

```bash
eas secret:create --scope project --name EXPO_PUBLIC_ACTION_BOARD_URL --value "https://your-host.example.com"
```

または `eas.json` の `env` でプロファイル単位に指定（リポジトリに載せない値は Secret を推奨）。

## 確認チェックリスト（配布前）

- [ ] 対象 URL が HTTPS で、証明書が実機で有効
- [ ] LINE ログイン等のリダイレクト URI がそのオリジンで許可されている
- [ ] `app.config.ts` の `bundleIdentifier` / `package` が組織で一意
- [ ] 内部テスターにインストール手順とアンインストール方法を共有
