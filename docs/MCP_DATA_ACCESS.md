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
| 後回し | eNPS / 表彰の**個別回答**、メール、生年月日、Slack ID、紹介コード |
| 置き場所 | データ取得ロジックは `lib/mcp/`。配信はまず Next.js `POST /api/mcp`（既存 Cloudflare Pages）。SDK が Edge で無理なら Worker に分離 |
| 認証 | `BATCH_ADMIN_KEY` は使わない。専用キー + スコープ（`public` / `analytics` / `survey_agg`） |

「MCP を作れば取り出せる」は正しい。ただし取り出せる範囲は**ツール定義とスコープ**で決まる。範囲を決めずにキーだけ配ると、他AI経由の情報漏洩になる。

---

## 2. 背景と非目標

### やりたいこと

- 経営・企画・分析メンバーが、Cursor や Claude など**別のAI**に質問して、グッジョブ・ランキング・ダッシュボード相当の数字を出させる
- そのために「DB を直接触らせる」以外の、運用可能な入口を用意する

### やらないこと（このプランの範囲外）

- 書き込み（投稿、いいね、アンケート回答、バッジ再計算、ユーザー更新）
- 任意 SQL / 任意テーブル SELECT
- `SUPABASE_SERVICE_ROLE_KEY` や `BATCH_ADMIN_KEY` を他AIクライアントに配布
- ChatGPT GPTs / Dify 専用コネクタの本実装（REST を後から足せる形にはする）
- eNPS・表彰の**個人が特定できる生回答**の配信

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
- **キーはスコープ付き**（survey 用キーが無いと集計も取れない）
- **件数上限とページング必須**（デフォルト 20、最大 100）
- **監査ログ**（誰のキーが、どのツールを、いつ呼んだか）
- **service_role を MCP プロセスに持たせない**（少なくとも Phase 1–2）

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
  Supabase anon（公開データ）
  または専用 read-only role + SECURITY DEFINER ビュー
  （survey_agg のみ、後から read-only ロール）
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
    "label": "経営者向け集計"
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
| `survey_agg` | eNPS 月次スナップショット、表彰の**指名件数・設問メタ**（個人回答なし） | 経営者相当。`isOwner` と同じ運用意識 |

スコープに無いツールは `tools/list` にも出さない（名前を知って呼んでも 403）。

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

### Phase 3（`survey_agg`）のみ

- `enps_surveys` / `enps_questions` / `award_surveys` / `award_questions`（定義）
- `enps_monthly_snapshots`（凍結済み集計）
- 表彰の指名**件数**・設問別トップ（管理画面の quarterly ranking 相当。氏名は公開プロフィール名まで）

### ツールに載せない（ハード禁止）

| 対象 | 理由 |
|------|------|
| `enps_responses` / `award_responses` の生行 | 個人のスコア・自由記述 |
| `enps_report_ai_summaries.payload` | 原文コメントが入り得る |
| `private_users` の DOB / slack_user_id / hubspot_contact_id | PII・外部ID |
| `auth.users` / `get_user_by_email` | メール |
| `user_referral` | 紹介コード悪用 |
| `xp_transactions` の全件ダンプ | 過剰。レベルとランキングで足りる |
| `mission_artifacts` / 位置情報 | 本人以外は RLS でも見えない成果物 |
| `*_late_submission_grants` | 回答バイパス |
| `slack_notifications.payload` | 投稿内容の複製 |
| 任意 SQL、書き込み RPC（`replace_enps_responses` 等） | 権限逸脱 |

`private_users` は「名前解決」にも使わない。表示名は `public_user_profiles.name` のみ。

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

Phase 3 で初めて、スナップショット読み取り用の **SELECT 専用 DB ロール**（または SECURITY DEFINER ビュー + GRANT）を足す。アプリの service_role を MCP にコピーしない。

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
    surveys.ts         # Phase 3
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

- [ ] 禁止データリストに抜けが無いか（特にサーベイ）
- [ ] `survey_agg` を経営者以外に渡すか
- [ ] キー運用（env 配列で開始でよいか）

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

### Phase 3 — サーベイ集計

- DB: `mcp_readonly` ロール、または `enps_monthly_snapshots` 等への SECURITY DEFINER ビュー
- `survey_agg` ツール
- 個別回答を返す経路がテストで存在しないことを明示

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
| 単体 | スコープ外ツールは 403。redact が email / date_of_birth / slack_user_id を落とす。limit が 100 で頭打ち |
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
| `MCP_READONLY_DB_URL` または同等 | Phase 3 | 集計ビュー専用。service_role の代用にしない |
| `MCP_RATE_LIMIT_PER_MINUTE` | Phase 2 | デフォルト 60 |

`SUPABASE_SERVICE_ROLE_KEY` を MCP ルートから import しない（lint / review で見る）。

---

## 14. レビューで見るポイント

1. 新しいツールは禁止リストに触れていないか
2. `status: all` や pending グッジョブを公開していないか
3. サービス関数の service_role 経路をそのまま呼んでいないか
4. ツール説明が「何でも聞ける」になっていないか
5. キーがドキュメント例で実値になっていないか

---

## 15. 推奨する最初の実装 PR の大きさ

Phase 1 を1本の実装 PR にする。

- 含む: `lib/mcp`（public ツール一式）、`app/api/mcp/route.ts`、env、単体テスト、クライアント手順
- 含まない: survey、REST、キー管理 UI、Worker 分離、レート制限の本格基盤

スパイクで Edge 不可なら、同じ PR 内で Worker に切り替え、Pages の `/api/mcp` は 501 + 移行先 URL にする。
