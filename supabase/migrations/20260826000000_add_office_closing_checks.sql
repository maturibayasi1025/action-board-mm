-- オフィス各階の最終チェック（最終退室報告）

CREATE TABLE public.office_floors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.office_floors IS '最終チェック対象のフロアマスタ。行の追加・無効化で階を増減できる。';
COMMENT ON COLUMN public.office_floors.name IS '表示名（例: 3F）';
COMMENT ON COLUMN public.office_floors.slug IS '識別子（例: 3f）';
COMMENT ON COLUMN public.office_floors.display_order IS '表示順（昇順）';
COMMENT ON COLUMN public.office_floors.is_active IS 'false の階は新規報告のチェック対象から外す';

CREATE INDEX office_floors_active_order_idx
  ON public.office_floors (is_active, display_order, name);

CREATE TABLE public.office_closing_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  left_at TIMESTAMPTZ NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.office_closing_reports IS '最終退室時の各階チェック報告';
COMMENT ON COLUMN public.office_closing_reports.left_at IS '退室時間（JST で入力し UTC で保存）';
COMMENT ON COLUMN public.office_closing_reports.note IS '備考（任意）';

CREATE INDEX office_closing_reports_left_at_idx
  ON public.office_closing_reports (left_at DESC);
CREATE INDEX office_closing_reports_user_id_idx
  ON public.office_closing_reports (user_id);

CREATE TABLE public.office_closing_report_floors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.office_closing_reports (id) ON DELETE CASCADE,
  floor_id UUID NOT NULL REFERENCES public.office_floors (id) ON DELETE RESTRICT,
  checked BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (report_id, floor_id)
);

COMMENT ON TABLE public.office_closing_report_floors IS '最終退室報告の階ごとのチェック結果';
COMMENT ON COLUMN public.office_closing_report_floors.checked IS 'その階の最終チェック完了';

CREATE INDEX office_closing_report_floors_report_id_idx
  ON public.office_closing_report_floors (report_id);

ALTER TABLE public.office_floors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_closing_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_closing_report_floors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_can_read_office_floors"
  ON public.office_floors
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "authenticated_can_read_office_closing_reports"
  ON public.office_closing_reports
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "authenticated_can_insert_own_office_closing_reports"
  ON public.office_closing_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "authenticated_can_delete_own_office_closing_reports"
  ON public.office_closing_reports
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "authenticated_can_read_office_closing_report_floors"
  ON public.office_closing_report_floors
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "authenticated_can_insert_own_office_closing_report_floors"
  ON public.office_closing_report_floors
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.office_closing_reports r
      WHERE r.id = report_id
        AND r.user_id = auth.uid()
    )
  );

-- 本社オフィス（第一清水ビル）の利用階。増減はマスタ行の追加・無効化で行う。
INSERT INTO public.office_floors (name, slug, display_order)
VALUES
  ('3F', '3f', 10),
  ('4F', '4f', 20);
