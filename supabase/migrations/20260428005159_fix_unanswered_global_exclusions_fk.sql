-- 未回答者一覧の母集団は private_users なので、除外テーブルの参照先も揃える。
-- これにより private_users に存在するが auth.users に存在しないユーザーも対象外にできる。

ALTER TABLE public.unanswered_survey_global_exclusions
  DROP CONSTRAINT IF EXISTS unanswered_survey_global_exclusions_user_id_fkey;

DELETE FROM public.unanswered_survey_global_exclusions exclusion
WHERE NOT EXISTS (
  SELECT 1
  FROM public.private_users private_user
  WHERE private_user.id = exclusion.user_id
);

ALTER TABLE public.unanswered_survey_global_exclusions
  ADD CONSTRAINT unanswered_survey_global_exclusions_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES public.private_users (id)
  ON DELETE CASCADE;
