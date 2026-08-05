# GitHub Actions Secrets 設定ガイド

このドキュメントでは、GitHub Actions のワークフローを動作させるために必要な **Repository Secrets** の設定方法を説明します。

## 設定手順

1. GitHub リポジトリのページを開く
2. **Settings** → **Secrets and variables** → **Actions** を選択
3. **New repository secret** をクリック
4. 各 Secrets の **Name** と **Value** を入力して保存

> **ヒント**: 組織のリポジトリの場合、**Settings** へのアクセス権限が必要です。権限がない場合は組織の管理者に依頼してください。

## 必要な Secrets 一覧

### サーベイ生成ワークフロー（eNPS / Award）

`generate-enps-survey.yml` と `generate-award-survey.yml` で使用されます。
毎月25日 日本時間10:00 にスケジュール実行、または手動実行が可能です。

| Secret 名 | 説明 | 取得元 |
|-----------|------|--------|
| `SUPABASE_URL` | Supabase プロジェクトURL | [Supabase Dashboard](https://app.supabase.com) → Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase サービスロールキー | Supabase Dashboard → Settings → API → service_role secret |
| `BATCH_ADMIN_KEY` | バッチAPI認証キー | デプロイ環境（Vercel/Cloudflare等）の `BATCH_ADMIN_KEY` と同じ値 |
| `NEXT_PUBLIC_APP_ORIGIN` | デプロイ済みアプリのURL | 例: `https://your-app.vercel.app` または本番ドメイン |
| `SLACK_WEBHOOK_URL_ENPS` | eNPS サーベイ通知用 Webhook（任意） | 対象チャンネル用に [Incoming Webhooks](https://api.slack.com/messaging/webhooks) で作成 |
| `SLACK_WEBHOOK_URL_AWARD` | 表彰サーベイ通知用 Webhook（任意） | 対象チャンネル用に同上 |
| `SLACK_WEBHOOK_URL` | 上記が未設定のときのフォールバック / グッジョブ等の他通知 | Incoming Webhooks で作成 |

> **注意**: ワークフローはリポジトリ上で `npm run generate-enps-survey` / `generate-award-survey` を実行し、`npm run` のプロセスに上記 Secrets を渡します。Slack 通知はその実行時に送信されます。**デプロイ環境**（Vercel / Cloudflare 等）に管理画面の未回答リマインドやバッチ API 用の同じ変数を設定してください。`SLACK_WEBHOOK_URL_ENPS` / `SLACK_WEBHOOK_URL_AWARD` が未設定の場合は `SLACK_WEBHOOK_URL` にフォールバックします。

### eNPS レポート生成ワークフロー

`build-enps-report.yml` で使用されます。
毎月1日 日本時間9:00 にスケジュール実行され、前月末で締め切ったアンケートの集計を確定します。手動実行では対象年月の指定や再計算もできます。

Supabase の 2 つは他のワークフローと同じ Secrets を参照するため、**すでに設定済みであれば追加作業はありません**。

| Secret 名 | 説明 | 取得元 |
|-----------|------|--------|
| `SUPABASE_URL` | Supabase プロジェクトURL | サーベイ生成ワークフローと共通 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase サービスロールキー | 同上 |
| `ENPS_REPORT_AI_API_KEY` | 自由記述のAI分析に使うAPIキー（任意） | 利用する LLM プロバイダの管理画面 |

`ENPS_REPORT_AI_API_KEY` が未設定の場合、集計スナップショットの生成だけが行われ、AI 分析はスキップされます（ワークフローは成功扱いのまま進みます）。

モデルとエンドポイントは秘匿情報ではないため、Secrets ではなく **Variables** タブ（**Settings** → **Secrets and variables** → **Actions** → **Variables**）で設定します。どちらも未設定なら既定値が使われます。

| Variable 名 | 説明 | 既定値 |
|-------------|------|--------|
| `ENPS_REPORT_AI_MODEL` | 使用するモデル名 | `gpt-4o-mini` |
| `ENPS_REPORT_AI_BASE_URL` | OpenAI 互換エンドポイント | `https://api.openai.com/v1` |
| `ENPS_REPORT_AI_TEMPERATURE` | 出力のばらつき（任意） | 未指定（モデルの既定値に任せる） |

#### 使用できるモデル

`POST {BASE_URL}/chat/completions` を呼び、`response_format: { type: "json_object" }`（JSON モード）を指定します。**この2つに対応していれば、どのモデル・どのプロバイダでも使えます。**

- **OpenAI**: GPT-4o 系、GPT-5 系のいずれも利用できます。要約タスクなので `gpt-4o-mini` 相当で十分ですが、記述量が多く精度を上げたい場合は上位モデルに変更できます
- **Azure OpenAI**: `ENPS_REPORT_AI_BASE_URL` にデプロイのエンドポイントを指定します（認証ヘッダの形式が異なる場合は要調整）
- **その他**: OpenRouter などの OpenAI 互換ゲートウェイ、または vLLM / Ollama などの自ホスト環境も、JSON モードに対応していれば利用できます

> **補足**: `ENPS_REPORT_AI_TEMPERATURE` は既定では送信しません。GPT-5 系や o 系の推論モデルは既定値以外の temperature を受け付けず、指定すると 400 エラーになるためです。出力を安定させたい場合のみ、対応モデル（GPT-4o 系など）で `0.2` などを設定してください。

> **注意**: AI 分析には自由記述の本文が外部の API に送信されます。氏名やユーザーIDは送らず、自由記述が5件未満の会社は生成自体を行いませんが、利用するプロバイダのデータ取り扱いポリシーは事前にご確認ください。自社の要件に合わない場合は `ENPS_REPORT_AI_BASE_URL` で別のエンドポイントに向けるか、キーを設定せず集計のみで運用できます。

### バッジ計算ワークフロー（本番）

`calculate-badges-production.yml` で使用されます。
毎日 日本時間 0:05 にスケジュール実行、または手動実行が可能です。

| Secret 名 | 説明 | 取得元 |
|-----------|------|--------|
| `SUPABASE_URL` | Supabase プロジェクトURL（本番） | Supabase Dashboard → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase サービスロールキー（本番） | 同上 |

### バッジ計算ワークフロー（ステージング）

`calculate-badges-staging.yml` で使用されます。
環境 `staging` の Secrets を使用します。

| Secret 名 | 説明 | 取得元 |
|-----------|------|--------|
| `STAGING_SUPABASE_URL` | Supabase URL（ステージング） | ステージング用 Supabase プロジェクト |
| `STAGING_SUPABASE_SERVICE_ROLE_KEY` | サービスロールキー（ステージング） | 同上 |

> **注意**: ステージング環境の Secrets は **Environments** で `staging` を作成し、その環境に紐づけて設定することもできます。その場合、Repository レベルか Environment レベルのどちらかで一貫して設定してください。

## eNPS 会社別レポートの初回セットアップ

レポート画面は保存済みのスナップショットだけを表示します。導入直後は空なので、以下の手順で作成してください。

### 1. マイグレーションを本番 Supabase に適用する

マイグレーションの適用は自動化されていないため、手動で実行します。

```bash
supabase link --project-ref <your-project-ref>   # 初回のみ
supabase db push
```

`enps_monthly_snapshots` と `enps_report_ai_summaries` の 2 テーブルが作成されます。

### 2. スナップショットを作成する

**Actions** → 左メニューの `Build Monthly eNPS Report` → **Run workflow** から実行します。入力は次のとおりです。

| 入力 | 用途 |
|------|------|
| `year_month` | 特定の月だけを作り直したいときに `2026-07` のように指定。空なら締切済みで最新の1件 |
| `all` | **初回セットアップ用**。過去の全アンケートをまとめて作成する |
| `force` | 既に作成済みのスナップショットを再計算して上書きする |
| `skip_ai` | 自由記述のAI分析を行わない（集計だけを素早く作りたいとき） |

初回は `all` にチェックを入れて実行すると、過去の全月ぶんが一度に作成されます。以降は毎月1日に自動で前月分が確定するため、通常は操作不要です。

> **注意**: `all` での過去分の作成は、**当時の所属ではなく現在の所属**で集計されます。異動があった社員の回答は現在の会社・事業部に計上されるため、過去月の内訳は当時のレポートと一致しません。この先の月は締切時点の所属で凍結されるので、この影響を受けるのは初回に遡って作成した分だけです。

ローカルから実行する場合は、本番の `NEXT_PUBLIC_SUPABASE_URL` と `SUPABASE_SERVICE_ROLE_KEY` を `.env.local` に設定して次を実行します。

```bash
npm run build-enps-report              # 締切済みで最新の1件
npm run build-enps-report -- --all     # 過去分をまとめて
npm run build-enps-report -- --year-month 2026-07 --force
```

## 設定後の確認

1. **手動実行でテスト**
   - **Actions** タブ → 対象ワークフローを選択 → **Run workflow** から手動実行
   - 例: `Generate Monthly eNPS Survey` または `Generate Monthly Award Survey`

2. **ログでエラー確認**
   - 実行後にログを開き、Secrets の未設定や認証エラーが出ていないか確認

3. **Slack 通知の確認**
   - サーベイ生成が成功した場合、設定した Slack チャンネルに通知が届くことを確認

## トラブルシューティング

### 403 Forbidden が返る
- `BATCH_ADMIN_KEY` がデプロイ環境の値と一致しているか確認
- `NEXT_PUBLIC_APP_ORIGIN` が正しい URL か確認（末尾の `/` は不要）

### Slack に通知が届かない
- **デプロイ環境**（Vercel / Cloudflare 等）に、サーベイ種別用の `SLACK_WEBHOOK_URL_ENPS` / `SLACK_WEBHOOK_URL_AWARD`、またはフォールバックの `SLACK_WEBHOOK_URL` が設定されているか確認
- GitHub Actions 側でも同じ名前の Secrets が必要（ワークフローが参照する変数と一致させる）
- Webhook URL が `https://hooks.slack.com/services/...` 形式か確認

### ステージング用 Secrets が反映されない
- `staging` 環境が **Settings** → **Environments** で作成されているか確認
- Environment に紐づけた Secrets は、その環境がジョブで指定されている場合にのみ使用されます

### eNPS 会社別レポートに何も表示されない
レポートは保存済みのスナップショットだけを表示するため、初回は手動での作成が必要です。下記の「初回セットアップ」を参照してください。

### AI 分析の欄が空のまま
- `ENPS_REPORT_AI_API_KEY` が設定されているか確認（未設定ならログに「AI分析はスキップします」と出ます）
- 対象会社の自由記述が5件未満の場合、個人が特定されうるため意図的に生成していません
