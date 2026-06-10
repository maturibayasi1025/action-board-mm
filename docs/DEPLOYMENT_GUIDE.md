# Supabase テストユーザー デプロイメントガイド

## 概要
このガイドは、ローカル環境で作成したテストユーザーをWeb上のSupabaseに適用する方法を説明します。

## 変更内容
- 最初の3ユーザーを削除
- 10名の新規テストユーザーを追加（maisonmarc.comドメイン）
- 各ユーザーに固有のパスワードを設定

## デプロイ方法

### 方法1: Supabase CLIを使用（推奨）

```bash
# 1. 本番環境にリンク（初回のみ）
supabase link --project-ref <your-project-ref>

# 2. マイグレーションをプッシュ
supabase db push

# 3. 確認
supabase db remote list
```

### 方法2: Supabase Dashboard SQLエディタを使用

1. [Supabase Dashboard](https://app.supabase.com) にログイン
2. プロジェクトを選択
3. 左メニューから「SQL Editor」を選択
4. `manual_update_users.sql`の内容をコピー＆ペースト
5. 「Run」をクリック

### 方法3: GitHub Actionsを使用（CI/CD）

既存のGitHub Actionsワークフローがある場合、プッシュ時に自動的にマイグレーションが適用されます。

## 注意事項

### 実行前の確認事項
- [ ] バックアップを取得済み
- [ ] ステージング環境でテスト済み
- [ ] 既存ユーザーへの影響を確認済み

### 既存データの確認
```sql
-- 既存ユーザーを確認
SELECT email, created_at FROM auth.users
WHERE email LIKE '%@example.com' OR email LIKE '%@maisonmarc.com'
ORDER BY created_at DESC;

-- 関連データを確認
SELECT COUNT(*) FROM achievements WHERE user_id IN (
  '622d6984-2f8a-41df-9ac3-cd4dcceb8d19',
  '2c23c05b-8e25-4d0d-9e68-d3be74e4ae8f',
  'f47ac10b-58cc-4372-a567-0e02b2c3d479'
);
```

## ユーザー情報

### 作成されるユーザー一覧

| Email | Name | Password | X Username |
|-------|------|----------|------------|
| hakura@maisonmarc.com | 葉倉歩 | Hakura$Secure2024 | hakura_ayumu |
| s.igari@maisonmarc.com | 猪狩俊 | IgariShun%Pass123 | igari_shun |
| y.yanase@maisonmarc.com | 柳瀬裕也 | Yanase&Yuya2024 | yanase_yuya |
| f.furuno@maisonmarc.com | 古野良太 | FurunoRyota*456 | furuno_ryota |
| k.itaka@maisonmarc.com | 位高光一 | ItakaKouichi#789 | itaka_kouichi |
| y.yamada@maisonmarc.com | 山田一貴 | YamadaKazu@2024 | yamada_kazutaka |
| y.yamaguchi@maisonmarc.com | 山口裕二 | YamaguchiYuji!321 | yamaguchi_yuji |
| s.kojima@maisonmarc.com | 小嶋翔太 | KojimaShota$567 | kojima_shota |
| y.baba@maisonmarc.com | 馬場雄大 | BabaYuudai#890 | baba_yuudai |
| t.sekiguchi@maisonmarc.com | 関口貴大 | SekiguchiTaka%2024 | sekiguchi_takahiro |

## トラブルシューティング

### エラー: 外部キー制約違反
関連テーブルにデータが残っている場合、削除時にエラーが発生します。
```sql
-- 関連データを先に削除
DELETE FROM xp_transactions WHERE user_id = '<user-id>';
DELETE FROM user_levels WHERE user_id = '<user-id>';
DELETE FROM achievements WHERE user_id = '<user-id>';
```

### エラー: ユーザーが既に存在
```sql
-- 既存ユーザーのパスワードのみ更新
UPDATE auth.users
SET encrypted_password = crypt('新しいパスワード', gen_salt('bf'))
WHERE email = 'ユーザーのメール';
```

## ロールバック方法

問題が発生した場合:
1. Supabase Dashboardの「Database」→「Backups」から復元
2. または、事前にエクスポートしたデータを使用して手動で復元

## 確認手順

デプロイ後の確認:
```sql
-- ユーザーが正しく作成されたか確認
SELECT
  au.email,
  pu.name,
  ul.level,
  ul.xp
FROM auth.users au
LEFT JOIN private_users pu ON au.id = pu.id
LEFT JOIN user_levels ul ON au.id = ul.user_id
WHERE au.email LIKE '%@maisonmarc.com'
ORDER BY au.created_at DESC;
```

## サポート

問題が発生した場合は、以下を確認してください:
- Supabaseのログ（Dashboard → Logs）
- エラーメッセージの詳細
- 実行したSQLクエリ