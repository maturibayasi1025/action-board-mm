-- 途中退室と在室把握のため、退室種別と入室記録を追加する

ALTER TABLE public.office_closing_reports
  ADD COLUMN leave_kind TEXT NOT NULL DEFAULT 'final';

ALTER TABLE public.office_closing_reports
  ADD CONSTRAINT office_closing_reports_leave_kind_check
  CHECK (leave_kind IN ('midday', 'final'));

COMMENT ON COLUMN public.office_closing_reports.leave_kind IS 'midday: 途中退室 / final: 最終退室（各階チェックあり）';

CREATE TABLE public.office_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.office_checkins IS 'オフィス入室記録。当日の入室と退室から在室者を算出する';
COMMENT ON COLUMN public.office_checkins.checked_in_at IS '入室時間';

CREATE INDEX office_checkins_checked_in_at_idx
  ON public.office_checkins (checked_in_at DESC);
CREATE INDEX office_checkins_user_id_idx
  ON public.office_checkins (user_id);

ALTER TABLE public.office_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_can_read_office_checkins"
  ON public.office_checkins
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "authenticated_can_insert_own_office_checkins"
  ON public.office_checkins
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "authenticated_can_delete_own_office_checkins"
  ON public.office_checkins
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
