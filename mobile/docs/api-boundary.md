# Expo ネイティブ化時の API 境界（Server Actions → HTTP/RPC）

WebView では既存の Server Action をそのまま呼べるが、**ネイティブ UI から同一ロジックを使う**には、HTTP API・Supabase RPC・Edge Function など「Web 以外から呼べる境界」が必要になる。

以下は **エンドユーザー向けアプリ** で触れやすい処理を優先度付きで列挙する。管理画面専用の Actions は必要になったら同様に切り出す。

## 優先度 A（コア UX）

| 現在の実装 | 概要 |
|------------|------|
| [`app/missions/[id]/actions.ts`](../../app/missions/[id]/actions.ts) | `achieveMissionAction`、`cancelSubmissionAction`、ミッション達成・提出取消と XP 連携 |
| [`app/missions/[id]/quiz-actions.ts`](../../app/missions/[id]/quiz-actions.ts) | クイズ型ミッションの出題・採点・達成 |
| [`app/(protected)/user-missions/actions.ts`](../../app/(protected)/user-missions/actions.ts) | `createUserMissionAction`、`updateUserMissionAction`、`saveDraftUserMissionAction`、`publishDraftUserMissionAction`、`deleteDraftUserMissionAction`、`completeSharedMissionAction`、`toggleLikeAction` など |
| [`app/(protected)/settings/profile/actions.ts`](../../app/(protected)/settings/profile/actions.ts) | プロフィール・アバター更新（Storage 含む） |
| [`app/actions.ts`](../../app/actions.ts) | サインイン・サインアップ・`handleLineAuthAction` 等の認証系 |

## 優先度 B（アンケート・保護ルート内）

| 現在の実装 | 概要 |
|------------|------|
| [`app/(protected)/surveys/[id]/actions.ts`](../../app/(protected)/surveys/[id]/actions.ts) | eNPS 等の回答送信 |
| [`app/(protected)/surveys/award/[id]/actions.ts`](../../app/(protected)/surveys/award/[id]/actions.ts) | 表彰アンケート関連 |
| [`app/actions/level-up.ts`](../../app/actions/level-up.ts) | レベルアップ通知等 |
| [`app/actions/badge-notification.ts`](../../app/actions/badge-notification.ts) | バッジ通知 |

## 優先度 C（主に管理）

`app/(protected)/admin/**/actions.ts`（統計、ユーザー管理、グッジョブ matrix、アンケート編集、MVV バッジ、事業部、重要ミッション等）。社内向けネイティブが「管理者だけ」なら B と同列になる。

## 既に HTTP として存在する Route Handlers

ネイティブや外部バッチから **既に URL で呼べる** 例（用途はコード参照）。

| パス | ファイル |
|------|----------|
| `/api/auth/callback/line` | [`app/api/auth/callback/line/route.ts`](../../app/api/auth/callback/line/route.ts) |
| `/api/profile` | [`app/api/profile/route.ts`](../../app/api/profile/route.ts) |
| `/api/user-missions/toggle-like` | [`app/api/user-missions/toggle-like/route.ts`](../../app/api/user-missions/toggle-like/route.ts) |
| `/api/slack-notification` | [`app/api/slack-notification/route.ts`](../../app/api/slack-notification/route.ts) |
| `/api/slack/webhook` | [`app/api/slack/webhook/route.ts`](../../app/api/slack/webhook/route.ts) |
| `/api/slack/test-webhook` | [`app/api/slack/test-webhook/route.ts`](../../app/api/slack/test-webhook/route.ts) |
| `/api/batch/enps-survey` | [`app/api/batch/enps-survey/route.ts`](../../app/api/batch/enps-survey/route.ts) |
| `/api/batch/award-survey` | [`app/api/batch/award-survey/route.ts`](../../app/api/batch/award-survey/route.ts) |
| `/api/batch/backfill-missing-xp` | [`app/api/batch/backfill-missing-xp/route.ts`](../../app/api/batch/backfill-missing-xp/route.ts) |
| `/api/logs` | [`app/api/logs/route.ts`](../../app/api/logs/route.ts) |
| `/api/badges/notifications` | [`app/api/badges/notifications/route.ts`](../../app/api/badges/notifications/route.ts) |

## 切り出しの進め方（推奨）

1. **認証**: Supabase Auth をクライアントから直接使うか、既存 Cookie セッションと整合するトークン交換 API を定義する。
2. **ミッション達成・ユーザーグッジョブ**: ビジネスルールが [`achieveMissionAction`](../../app/missions/[id]/actions.ts) と [`user-missions/actions.ts`](../../app/(protected)/user-missions/actions.ts) に集中しているため、ここを **1 本の REST/JSON API に寄せる** とネイティブ実装が単純になる。
3. **検証**: 既存の Zod スキーマ（`lib/validation`）をサーバー側バリデーションの共有モジュールとして再利用できる。
