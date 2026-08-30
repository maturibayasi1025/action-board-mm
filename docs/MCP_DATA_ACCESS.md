# 他AI向けデータアクセス MCP 実装プラン

メンバーが「他のAIにデータを食わせたいので DB を触らせてほしい」と依頼したときの答えは、**Supabase の接続情報や service_role を渡すことではない**。リモート MCP（必要なら同じロジックの REST）を作り、**許可した読み取りだけ**をツールとして公開する。

この文書は実装前の設計合意用。実装はフェーズ単位で PR を分ける。

---

## 1. 結論（先に読む）

| 判断 | 内容 |
|------|------|
| MCP でデータを取れるか | **取れる。** Cursor / Claude Desktop / 対応クライアントからツール呼び出しで取得できる |
| 生 SQL・DB 直結はするか | **しない。** `execute_sql` も service_role も渡さない |
| 最初に公開するもの | 画面でも見える公開データ（ミッション、ランキング、公開プロフィール、承認済みグッジョブ） |
| 制限付きで出す | Slack ID、eNPS / 表彰の**個別回答**（専用スコープ。`public` キーでは出さない） |
| 出さない | メール、生年月日、HubSpot ID、紹介コード、成果物・位置情報、任意 SQL |
| 置き場所 | データ取得ロジックは `lib/mcp/`。配信はまず Next.js `POST /api/mcp`（既存 Cloudflare Pages）。SDK が Edge で無理なら Worker に分離 |
| 認証 | `BATCH_ADMIN_KEY` は使わない。専用キー + スコープ（`public` / `analytics` / `survey_agg` / `slack_directory` / `survey_raw`） |

「MCP を作れば取り出せる」は正しい。ただし取り出せる範囲は**ツール定義とスコープ**で決まる。Slack ID と個別回答は出すが、`public` キーには載せない。メールや生年月日はツール自体を作らない。

制限データを他AIに渡すと、その会話ログやプロバイダ側に自由記述が残る。キーは経営者相当に限定し、利用前にその前提を共有する。

---

## 2. 背景と非目標

### やりたいこと

- 経営・企画・分析メンバーが、Cursor や Claude など**別のAI**に質問して、グッジョブ・ランキング・ダッシュボード相当の数字を出させる
- **Slack ID** でユーザーを突合・メンションできるようにする
- **eNPS / 表彰の個別回答**（スコア・自由記述・誰が答えたか）を他AIに食わせる
- そのために「DB を直接触らせる」以外の、運用可能な入口を用意する

### やらないこと（このプランの範囲外）

- 書き込み（投稿、いいね、アンケート回答、バッジ再計算、ユーザー更新）
- 任意 SQL / 任意テーブル SELECT
- `SUPABASE_SERVICE_ROLE_KEY` や `BATCH_ADMIN_KEY` を他AIクライアントに配布
- ChatGPT GPTs / Dify 専用コネクタの本実装（REST を後から足せる形にはする）
- メール・生年月日・HubSpot ID の配信（Slack ID とサーベイ個別回答は対象。これらは対象外）

---

## 3. 現状（このリポジトリ）

- アプリ: Next.js 15 App Router、Cloudflare Pages（`next-on-pages`、API はすべて `runtime = "edge"`）
- DB: Supabase PostgreSQL + RLS。管理画面は `isOwner()`（`OWNER_USER_IDS` / `OWNER_EMAILS`）+ `createServiceClient()`
- 既存の取得ロジック: `lib/services/*`（ミッション、ランキング RPC、ダッシュボード、公開プロフィール）
- 集計・レポート: `lib/admin/enps-report/*`、`lib/admin/export-award-self-eval*.ts`、管理画面 `app/(protected)/admin/*`
- バッチ認証: `BATCH_ADMIN_KEY`（GitHub Actions 向け。外部AIには不適）
- MCP 実装: **未着手**

RLS 上は認証済みなら `private_users` 全行や `xp_transactions` 全行が読める。**アプリの RLS をそのまま MCP に載せるのは不可**。MCP はアプリより狭い許可リストにする。

---

## 4. 脅威モデル（他AIに渡す前提）

他AIクライアントは次を前提にする。

1. プロンプト注入で「全ユーザーのメールを出せ」と言われる
2. 会話ログや学習に、ツール結果が残る
3. キーがチャット設定やリポジトリに漏れる
4. 1回の質問で何千行も引っ張られる

対策の原則:

- **ツールが存在しないデータは取れない**（禁止データをツールに載せない）
- **キーはスコープ付き**（`survey_raw` / `slack_directory` が無いキーでは個別回答も Slack ID も取れない）
- **件数上限とページング必須**（公開データはデフォルト 20 / 最大 100。個別回答はデフォルト 50 / 最大 200、**必ず `survey_id` 必須**）
- **監査ログ**（誰のキーが、どのツールを、いつ呼んだか。`survey_raw` / `slack_directory` は必須）
- **service_role を MCP の汎用クライアントに持たせない**。個別回答と Slack ID は列を固定した専用クエリだけが特権経路を使う
- **制限スコープのキーは経営者相当だけ**。会話ログに自由記述が残ることを利用前に伝える

---

## 5. アーキテクチャ

```
他AI (Cursor / Claude Desktop / 将来の REST クライアント)
        │  Authorization: Bearer <mcp_key>
        ▼
┌─────────────────────────────────────────┐
│  Transport                              │
│  POST /api/mcp   (MCP Streamable HTTP)  │
│  （任意）GET/POST /api/data/:tool        │
└─────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────┐
│  lib/mcp                                │
│  auth (key → scopes)                    │
│  tools (名前・入力 Zod・説明文)           │
│  query (既存 service / RPC の薄い包装)   │
│  redact (列許可リスト)                   │
│  audit + rate limit                     │
└─────────────────────────────────────────┘
        │
        ▼
  Supabase anon（public / analytics）
  制限付き: 列 GRANT した mcp_restricted ロール
  または SECURITY DEFINER RPC（Slack ID・個別回答・スナップショット）
```

### なぜ「MCP 本体」と「取得ロジック」を分けるか

- MCP SDK やホスト（Pages vs Worker）が変わっても、ツールの中身を二重管理しない
- MCP 非対応のAIには、同じ query 関数を REST で出せる
- Jest で query / redact / auth を単体テストできる（プロトコル実装と分離）

### ホストの決め方

1. **第一候補**: `app/api/mcp/route.ts`（`runtime = "edge"`）。既存 Pages と同じデプロイ、シークレットは Cloudflare ダッシュボード
2. **フォールバック**: `@modelcontextprotocol/sdk` が Edge で動かない、または Streamable HTTP のストリームが `next-on-pages` で切れる場合 → Cloudflare Worker（Agents SDK の MCP）を別デプロイし、`lib/mcp` 相当を共有するか `/api/data` を呼ぶ
3. **stdio ローカル MCP は正式経路にしない**。メンバーPCに anon key や service_role を置く運用は、今回やりたい「他AIに食わせる」と衝突する

Phase 1 着手時に、Edge 上で MCP initialize → tools/list → 1 ツール呼び出し、までを先にスパイクする。

---

## 6. 認証とスコープ

`BATCH_ADMIN_KEY` の再利用はしない（バッチ書き込みAPIと権限が混ざる）。

### キー

環境変数 `MCP_API_KEYS`（JSON）。Cloudflare では Encrypt する。

```json
[
  {
    "id": "ops-public-2026",
    "secret": "...",
    "scopes": ["public"],
    "label": "企画向け公開データ"
  },
  {
    "id": "owner-analytics-2026",
    "secret": "...",
    "scopes": ["public", "analytics", "survey_agg"],
    "label": "経営者向け集計（個人回答なし）"
  },
  {
    "id": "owner-restricted-2026",
    "secret": "...",
    "scopes": [
      "public",
      "analytics",
      "survey_agg",
      "slack_directory",
      "survey_raw"
    ],
    "label": "経営者向け。Slack ID とサーベイ個別回答を含む"
  }
]
```

- 照合はタイミング安全な比較
- キーIDだけ監査ログに残す（secret は残さない）
- ローテーションは配列に新キーを足して旧キーを消す
- 1メンバー1キーを推奨（漏洩時に個別失効）

将来、管理画面で発行したくなったら `mcp_api_keys` テーブル（`key_hash`, `scopes`, `revoked_at`）に移す。最初は env で足りる。

### スコープ

| スコープ | 使えるデータ | 誰向け |
|----------|--------------|--------|
| `public` | ミッション、承認済みグッジョブ、公開プロフィール、レベル、バッジ、ランキング | 分析したいメンバー全般 |
| `analytics` | ダッシュボード RPC、日次サマリ、グッジョブ統計（管理画面 statistics 相当の公開集計） | 数字を見る人 |
| `survey_agg` | eNPS 月次スナップショット、表彰の**指名件数・設問メタ**（個人回答なし） | 集計だけでよい人 |
| `slack_directory` | `user_id` + 公開名 + `slack_user_id` の対応表 | 他AIから Slack メンションや突合をしたい人。経営者相当 |
| `survey_raw` | eNPS / 表彰の**個別回答**（スコア・自由記述・回答者ID・被指名者ID） | 生回答を他AIに食わせたい人。経営者相当。`isOwner` と同じ運用意識 |

スコープに無いツールは `tools/list` にも出さない（名前を知って呼んでも 403）。

`slack_directory` と `survey_raw` は分けて発行できる。両方欲しい人には restricted キーを1本渡す。`public` だけのキーにはどちらも付けない。

---

## 7. 公開してよいデータ / 禁止データ

### Phase 1（`public`）で出してよい

- `missions`（`is_hidden` はデフォルト除外。明示フラグは `analytics` 以上でも原則出さない）
- `mission_category` / リンク
- `achievements`（誰が何をいつ達成したか。成果物の中身は出さない）
- `public_user_profiles`（id, name, avatar, prefecture, 公開SNS, business_unit_id）
- `user_levels`（xp, level）
- `user_badges`
- 承認済み `user_missions`（本文・MVV・いいね数・称賛された**表示名**）
- 既存ランキング RPC / `user_ranking_view`
- 有効な `companies` / `business_units`（マスタ）

### Phase 2（`analytics`）

- `get_daily_user_mission_counts` / `get_daily_user_mission_likes_counts`
- `daily_action_summary` 等のサマリテーブル
- 管理画面 statistics のグッジョブ集計（件数。個人のメールは含まない）

### Phase 3（`survey_agg`）

- `enps_surveys` / `enps_questions` / `award_surveys` / `award_questions`（定義）
- `enps_monthly_snapshots`（凍結済み集計）
- 表彰の指名**件数**・設問別トップ（管理画面の quarterly ranking 相当。氏名は公開プロフィール名まで）

### Phase 3 制限付き（`slack_directory` / `survey_raw`）— 要望により出す

管理画面の owner が service role で見ている範囲に寄せる。`private_users` の行そのものは返さない。

**Slack ID（`slack_directory`）**

- 返す列だけ: `user_id`, `name`（`public_user_profiles`）, `slack_user_id`
- `slack_user_id` が null の行はデフォルト除外（`include_missing: true` で含めてよい）
- 生年月日・HubSpot ID・メールは結合しない

**個別回答（`survey_raw`）**

- `enps_responses`: `id`, `survey_id`, `question_id`, `user_id`, `score_value`, `text_value`, `is_late_submission`, `created_at`
- `award_responses`: 上記に加え `nominee_user_id`
- 設問文・公開名は JOIN してよい（AI が読みやすいようにする）
- `slack_user_id` を回答行に付けるのは、同じキーが `slack_directory` も持つときだけ
- **`survey_id` 必須**。全期間一括ダンプのツールは作らない

アプリの RLS では個別回答は本人のみ。MCP から全員分を読むには、後述の特権読み取り経路が必要。

### ツールに載せない（ハード禁止）

| 対象 | 理由 |
|------|------|
| `enps_report_ai_summaries.payload` | 原文が再掲され得る。個別回答ツールで足りる |
| `private_users` の `date_of_birth` / `hubspot_contact_id` | Slack ID 以外の PII は出さない |
| `private_users` の `SELECT *` | 列を固定した対応表だけ使う |
| `auth.users` / `get_user_by_email` | メール |
| `user_referral` | 紹介コード悪用 |
| `xp_transactions` の全件ダンプ | 過剰。レベルとランキングで足りる |
| `mission_artifacts` / 位置情報 | 本人以外は RLS でも見えない成果物 |
| `*_late_submission_grants` | 回答バイパス |
| `slack_notifications.payload` | 投稿内容の複製。Slack ID とは別物 |
| 任意 SQL、書き込み RPC（`replace_enps_responses` 等） | 権限逸脱 |

表示名の解決は `public_user_profiles.name` のみ。`private_users` は `id` と `slack_user_id` 以外触らない。

---

## 8. ツールカタログ（実装時の名前はこれを正とする）

各ツール共通:

- 入力は Zod。日付は ISO 8601。期間は既存の `daily` / `all` または `from`+`to`
- `limit` デフォルト 20、最大 100。`offset` または `cursor`
- 戻りは JSON テキスト。列は allowlist で削る
- 説明文は「何が取れるか / 取れないか」を短く書く（AI が勝手に禁止データを要求しにくくする）

### `public`

| ツール | 既存の再利用 | 入力 |
|--------|--------------|------|
| `list_missions` | `lib/services/missions.ts` + `missions` テーブル | `featured?`, `important?`, `category_slug?`, `limit`, `offset` |
| `get_mission` | 同上 | `id` または `slug` |
| `list_mission_categories` | `mission_category` | なし |
| `list_achievements` | `achievements` | `user_id?`, `mission_id?`, `from?`, `to?`, `limit` |
| `get_public_profile` | `lib/services/users.ts` の公開側 | `user_id` |
| `search_public_profiles` | `public_user_profiles` | `query`（名前部分一致）、`business_unit_id?`, `limit` |
| `get_user_level` | `user_levels`（service client は使わない） | `user_id` |
| `list_user_badges` | `lib/services/badges.ts` の読み取り部分を anon 向けに切り出し | `user_id` |
| `list_user_missions` | `getUserMissionsServer`（`status` は `approved` 固定） | `created_by?`, `praised_for_user_id?`, `limit` |
| `get_xp_ranking` | `getRanking` | `period` (`all` \| `daily`), `limit` |
| `get_mission_ranking` | `lib/services/missionsRanking.ts` | 期間、`limit` |
| `get_likes_ranking` | `lib/services/likesRanking.ts` | 期間、`limit` |
| `get_prefecture_ranking` | `lib/services/prefecturesRanking.ts` | 期間、`limit` |
| `list_business_units` | `companies` / `business_units`（active のみ） | `company_id?` |

### `analytics`

| ツール | 既存の再利用 | 入力 |
|--------|--------------|------|
| `get_dashboard_counts` | `lib/services/dashboard.ts` | `period` (`weekly` \| `monthly`) |
| `get_goodjob_statistics` | `admin/statistics` の集計のうち個人非特定部分 | `preset` (`last30d` \| `thisMonth`) |
| `get_registration_metrics` | `lib/services/metrics.ts` の登録・達成件数 | なし |

### `survey_agg`（Phase 3）

| ツール | 既存の再利用 | 入力 |
|--------|--------------|------|
| `list_enps_surveys` | `enps_surveys` | 年? |
| `get_enps_monthly_snapshots` | `enps_monthly_snapshots` | `year_month?`, `group?` |
| `get_award_nomination_ranking` | `quarterly-ranking-model.ts` | `survey_id` または四半期 |

### `slack_directory`（Phase 3）

| ツール | 既存の再利用 | 入力 |
|--------|--------------|------|
| `list_slack_directory` | `private_users.slack_user_id` + `public_user_profiles` | `user_id?`, `query?`（名前）, `include_missing?`, `limit`, `offset` |
| `get_slack_user_id` | 同上 | `user_id` |

### `survey_raw`（Phase 3）

管理画面の `getAwardSurveyResponses` / `lib/admin/enps-report/data-access.ts` と同じ列に寄せる。

| ツール | 既存の再利用 | 入力 |
|--------|--------------|------|
| `list_enps_responses` | `enps_responses` + 設問文 | **`survey_id` 必須**, `question_id?`, `user_id?`, `limit`, `offset` |
| `list_award_responses` | `getAwardSurveyResponses` 相当 | **`survey_id` 必須**, `question_id?`, `user_id?`, `nominee_user_id?`, `limit`, `offset` |
| `get_enps_response` | 同上 | `id` |
| `get_award_response` | 同上 | `id` |

書き込み RPC（`replace_enps_responses` / `replace_award_responses`）は登録しない。

---

## 9. ディレクトリ案

```
lib/mcp/
  auth.ts              # Bearer → key id + scopes
  scopes.ts            # Scope 型とツール対応表
  redact.ts            # テーブルごとの列 allowlist
  pagination.ts        # limit/offset クランプ
  audit.ts             # 構造化ログ（key_id, tool, latency, row_count）
  rate-limit.ts        # キー単位の簡易制限
  client.ts            # supabase-js（cookie なし、anon）
  tools/
    missions.ts
    profiles.ts
    rankings.ts
    user-missions.ts
    analytics.ts
    surveys.ts         # Phase 3 survey_agg
    slack-directory.ts # Phase 3 slack_directory
    survey-responses.ts # Phase 3 survey_raw
  privileged-client.ts # 列固定クエリ専用。汎用 from() を晒さない
  server.ts            # ツール登録（SDK 非依存の dispatch でも可）
app/api/mcp/route.ts   # Streamable HTTP
app/api/data/[tool]/route.ts   # 任意。同じ dispatch
tests/unit/mcp/
  auth.test.ts
  redact.test.ts
  pagination.test.ts
  tools/*.test.ts      # supabase モック
docs/MCP_CLIENT_SETUP.md       # 実装後。Cursor の mcp.json 例
```

`lib/services/*` が `"server-only"` で cookie クライアントに依存している箇所は、**MCP 用に cookie なしクライアントへ切り出した関数を呼ぶ**。サービス実装をコピーせず、クエリ部分を共有する。

---

## 10. 実装フェーズ

### Phase 0 — 合意（この文書）

- [x] Slack ID と eNPS / 表彰の個別回答は出す（`slack_directory` / `survey_raw`。公開キーには付けない）
- [ ] 制限キーを経営者以外に渡すか
- [ ] キー運用（env 配列で開始でよいか）
- [ ] 他AIの会話ログに自由記述が残ってよいことの確認

### Phase 1 — 公開データ MCP（最初の実装 PR）

1. Edge で MCP Streamable HTTP が動くかスパイク（initialize / tools/list / tools/call）
2. `lib/mcp` の auth / redact / pagination / audit
3. `public` ツールを既存サービスから接続
4. `MCP_API_KEYS` を `lib/env.ts` と `.env.example`、`docs/CLOUDFLARE_ENV_SETUP.md` に追加
5. 単体テスト + 手動: Cursor から `list_missions` / `get_xp_ranking`
6. クライアント手順（`docs/MCP_CLIENT_SETUP.md`）

完了条件: キー無しは 401。`public` キーでミッションとランキングが取れる。禁止テーブルを叩くツールが存在しない。

### Phase 2 — 分析

- `analytics` ツール
- キー単位レート制限（例: 60 req / 分）
- レスポンスサイズ上限（例: 200KB）

### Phase 3 — サーベイ集計 + 制限データ（Slack ID / 個別回答）

特権読み取り（どれか1つ。上から推奨）:

1. Postgres ロール `mcp_restricted` + **列レベル GRANT**
   - `private_users`: `id`, `slack_user_id` のみ
   - `enps_responses` / `award_responses`: 全列 SELECT
   - `enps_monthly_snapshots` 等の集計表
2. SECURITY DEFINER RPC（`mcp_list_enps_responses` 等）。返す列を SQL 側で固定
3. 実装を急ぐ場合のみ、`createServiceClient()` を `privileged-client.ts` の **3関数以内** に閉じる。`.from("private_users").select("*")` は禁止。MCP ルートや public ツールから service_role を import しない

アプリ側の追加:

- `slack_directory` / `survey_raw` ツール
- 制限ツールはレートを落とす（例: 20 req / 分）
- 監査ログに `survey_id` と件数を残す
- テスト: `public` キーでは 403。redact が `date_of_birth` / email / `hubspot_contact_id` を落とす。`slack_user_id` は `slack_directory` のときだけ残る

### Phase 4 — 運用強化

- キーを DB 管理 + 失効 UI（owner のみ）
- 監査をテーブル保存（`mcp_audit_logs`）
- REST `/api/data`（MCP 非対応クライアント向け）
- 必要なら Worker 分離

---

## 11. クライアント接続（実装後のイメージ）

Cursor（リモート MCP）:

```json
{
  "mcpServers": {
    "action-board": {
      "url": "https://mm-actionboard.jp/api/mcp",
      "headers": {
        "Authorization": "Bearer <発行されたキー>"
      }
    }
  }
}
```

Claude Desktop も、Streamable HTTP 対応版であれば同じ URL + Bearer。stdio 用ラッパは公式経路にしない。

キーはチャットや Git に置かない。各自のローカル MCP 設定またはチームのシークレットマネージャに置く。

---

## 12. テスト方針

| 層 | 内容 |
|----|------|
| 単体 | スコープ外ツールは 403。redact が email / date_of_birth / hubspot_contact_id を落とす。`slack_user_id` は `slack_directory` 以外で落とす。`survey_raw` は `survey_id` 無しで Zod エラー。limit が上限で頭打ち |
| 契約 | 各ツールの入力 Zod と戻り JSON のスナップショット |
| 手動 | Cursor から「今月のXPランキング上位を教えて」→ `get_xp_ranking` だけが呼ばれる |
| 回帰 | 禁止テーブル名が `lib/mcp/tools` に現れないこと（grep テスト可） |

RLS テスト（`tests/rls`）は既存のアプリ契約。MCP はそれより狭いので、RLS が緩いことを「出してよい」根拠にしない。

---

## 13. 環境変数

| 変数 | 必須 | 用途 |
|------|------|------|
| `MCP_API_KEYS` | Phase 1 から | JSON 配列（id, secret, scopes, label） |
| `NEXT_PUBLIC_SUPABASE_URL` | 既存 | クエリ先 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Phase 1–2 | cookie なしクライアント |
| `MCP_READONLY_DB_URL` または同等 | Phase 3 推奨 | `mcp_restricted` ロールの接続。列 GRANT 済み |
| `MCP_RATE_LIMIT_PER_MINUTE` | Phase 2 | デフォルト 60（制限ツールは別途低く） |

`SUPABASE_SERVICE_ROLE_KEY` を `app/api/mcp` や public ツールから import しない。暫定で使う場合は `lib/mcp/privileged-client.ts` のみ（lint / review で見る）。

---

## 14. レビューで見るポイント

1. 新しいツールは禁止リスト（メール、DOB、HubSpot、紹介コード、成果物、任意SQL）に触れていないか
2. `survey_raw` / `slack_directory` が `public` キーで呼べないか
3. 個別回答ツールが `survey_id` 無しで全件引けないか
4. `private_users` を `SELECT *` していないか
5. `status: all` や pending グッジョブを公開していないか
6. キーがドキュメント例で実値になっていないか

---

## 15. 推奨する最初の実装 PR の大きさ

Phase 1 を1本の実装 PR にする。

- 含む: `lib/mcp`（public ツール一式）、`app/api/mcp/route.ts`、env、単体テスト、クライアント手順
- 含まない: Slack ID、個別回答、REST、キー管理 UI、Worker 分離、レート制限の本格基盤

Slack ID と個別回答は Phase 3 の別 PR。公開MCPが動いてから、特権経路と監査を足す。

スパイクで Edge 不可なら、同じ PR 内で Worker に切り替え、Pages の `/api/mcp` は 501 + 移行先 URL にする。
