-- postcodeカラムを完全に削除
-- このカラムは不要と判断され、アプリケーションコードでも使用されていない
ALTER TABLE private_users DROP COLUMN IF EXISTS postcode;

