-- xp_transactionsテーブルにユニーク制約を追加
-- 同一ソース（source_type, source_id）からの重複XP付与を防止
-- source_idがNULLの場合は制約の対象外（BONUSやPENALTYなど、source_idを持たないXP付与を許可）
-- テーブルが存在する場合のみ実行（テーブル作成前に実行される可能性があるため）

DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'xp_transactions') THEN
    -- 部分ユニークインデックスを使用（source_idがNULLでない場合のみユニーク制約を適用）
    CREATE UNIQUE INDEX IF NOT EXISTS unique_source_xp_transaction
    ON xp_transactions(source_type, source_id)
    WHERE source_id IS NOT NULL;

    COMMENT ON INDEX unique_source_xp_transaction IS '同一ソース（source_type, source_id）からの重複XP付与を防止。source_idがNULLの場合は制約の対象外。';
  END IF;
END $$;
