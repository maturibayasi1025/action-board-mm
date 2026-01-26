-- xp_transactionsテーブルにユニーク制約を追加
-- 同一ユーザーが同一ソース（source_type, source_id）から重複してXPを得ることを防止
-- source_idがNULLの場合は制約の対象外（BONUSやPENALTYなど、source_idを持たないXP付与を許可）
-- テーブルが存在する場合のみ実行（テーブル作成前に実行される可能性があるため）

DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'xp_transactions') THEN
    -- 既存の重複データを削除（同一user_id, source_type, source_idの組み合わせで最も古いレコードを残す）
    DELETE FROM xp_transactions
    WHERE id IN (
      SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                 PARTITION BY user_id, source_type, source_id
                 ORDER BY created_at ASC, id ASC
               ) as rn
        FROM xp_transactions
        WHERE source_id IS NOT NULL
      ) duplicates
      WHERE rn > 1
    );

    -- 部分ユニークインデックスを使用（source_idがNULLでない場合のみユニーク制約を適用）
    -- user_idを含めることで、異なるユーザーは同じソースからXPを得られるが、
    -- 同じユーザーが同じソースから重複してXPを得ることを防止
    CREATE UNIQUE INDEX IF NOT EXISTS unique_user_source_xp_transaction
    ON xp_transactions(user_id, source_type, source_id)
    WHERE source_id IS NOT NULL;

    COMMENT ON INDEX unique_user_source_xp_transaction IS '同一ユーザーが同一ソース（source_type, source_id）から重複してXPを得ることを防止。source_idがNULLの場合は制約の対象外。異なるユーザーは同じソースからXPを得られる。';
  END IF;
END $$;
