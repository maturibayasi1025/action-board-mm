import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { type SupabaseClient, createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

/**
 * レポート用テーブルはポリシーを持たない（サービスロール専用）。
 * 集計済みの組織横断データなので、一般ユーザーに読ませない前提を固定する。
 */
describe("eNPS Report Snapshots RLS Policies", () => {
  let anonClient: SupabaseClient;
  let authenticatedClient: SupabaseClient;
  let serviceClient: SupabaseClient;
  let testSurveyId: string;
  let testQuestionId: string;
  let testUserId: string;

  beforeAll(async () => {
    anonClient = createClient(supabaseUrl, supabaseAnonKey);
    serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey);

    const testUserEmail = `test-enps-report-${Date.now()}@example.com`;
    const { data: authData, error: authError } =
      await serviceClient.auth.admin.createUser({
        email: testUserEmail,
        password: "test-password-123",
        email_confirm: true,
      });

    if (authError || !authData.user) {
      throw new Error(`Failed to create test user: ${authError?.message}`);
    }
    testUserId = authData.user.id;

    const signInClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: signInData } = await signInClient.auth.signInWithPassword({
      email: testUserEmail,
      password: "test-password-123",
    });

    authenticatedClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${signInData?.session?.access_token || ""}`,
        },
      },
    });

    const { data: survey, error: surveyError } = await serviceClient
      .from("enps_surveys")
      .insert({
        title: "レポートテスト用アンケート",
        year_month: "2026-97",
        start_date: new Date().toISOString(),
        end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        is_active: true,
      })
      .select()
      .single();

    if (surveyError || !survey) {
      throw new Error(`Failed to create test survey: ${surveyError?.message}`);
    }
    testSurveyId = survey.id;

    const { data: question, error: questionError } = await serviceClient
      .from("enps_questions")
      .insert({
        question_text: "レポートテスト用質問",
        question_type: "score_0_10",
        display_order: 1,
        is_required: true,
        is_active: true,
      })
      .select()
      .single();

    if (questionError || !question) {
      throw new Error(
        `Failed to create test question: ${questionError?.message}`,
      );
    }
    testQuestionId = question.id;

    const { error: snapshotError } = await serviceClient
      .from("enps_monthly_snapshots")
      .insert({
        survey_id: testSurveyId,
        question_id: testQuestionId,
        scope: "company",
        company_name: "テスト会社",
        business_unit_name: "",
        target_count: 10,
        respondent_count: 8,
        promoters: 4,
        passives: 2,
        detractors: 2,
        nps_respondent_base: 25,
        nps_imputed_base: 0,
      });

    if (snapshotError) {
      throw new Error(
        `Failed to create test snapshot: ${snapshotError.message}`,
      );
    }

    const { error: aiError } = await serviceClient
      .from("enps_report_ai_summaries")
      .insert({
        survey_id: testSurveyId,
        company_name: "テスト会社",
        model: "test-model",
        payload: { overview: "テスト" },
        input_response_count: 10,
      });

    if (aiError) {
      throw new Error(`Failed to create test ai summary: ${aiError.message}`);
    }
  });

  afterAll(async () => {
    await serviceClient
      .from("enps_report_ai_summaries")
      .delete()
      .eq("survey_id", testSurveyId);
    await serviceClient
      .from("enps_monthly_snapshots")
      .delete()
      .eq("survey_id", testSurveyId);
    await serviceClient.from("enps_surveys").delete().eq("id", testSurveyId);
    await serviceClient
      .from("enps_questions")
      .delete()
      .eq("id", testQuestionId);
    await serviceClient.auth.admin.deleteUser(testUserId);
  });

  describe("enps_monthly_snapshots table", () => {
    it("should deny anonymous select", async () => {
      const { data, error } = await anonClient
        .from("enps_monthly_snapshots")
        .select("id")
        .eq("survey_id", testSurveyId);

      // ポリシーが無いため RLS で全行フィルタされ、エラーではなく空配列が返る
      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it("should deny authenticated select", async () => {
      const { data, error } = await authenticatedClient
        .from("enps_monthly_snapshots")
        .select("id")
        .eq("survey_id", testSurveyId);

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it("should deny authenticated insert", async () => {
      const { error } = await authenticatedClient
        .from("enps_monthly_snapshots")
        .insert({
          survey_id: testSurveyId,
          question_id: testQuestionId,
          scope: "company",
          company_name: "不正な会社",
          business_unit_name: "",
          target_count: 1,
          respondent_count: 1,
          promoters: 1,
          passives: 0,
          detractors: 0,
          nps_respondent_base: 100,
          nps_imputed_base: 100,
        });

      expect(error).not.toBeNull();
    });

    it("should allow service role to read snapshots", async () => {
      const { data, error } = await serviceClient
        .from("enps_monthly_snapshots")
        .select("company_name, nps_respondent_base")
        .eq("survey_id", testSurveyId);

      expect(error).toBeNull();
      expect(data?.length).toBe(1);
      expect(data?.[0]?.nps_respondent_base).toBe(25);
    });

    it("should reject a group scope row that carries a company name", async () => {
      const { error } = await serviceClient
        .from("enps_monthly_snapshots")
        .insert({
          survey_id: testSurveyId,
          question_id: testQuestionId,
          scope: "group",
          company_name: "会社名があってはいけない",
          business_unit_name: "",
          target_count: 1,
          respondent_count: 1,
          promoters: 1,
          passives: 0,
          detractors: 0,
          nps_respondent_base: 100,
          nps_imputed_base: 100,
        });

      expect(error).not.toBeNull();
    });

    it("should reject duplicated rows for the same bucket", async () => {
      const { error } = await serviceClient
        .from("enps_monthly_snapshots")
        .insert({
          survey_id: testSurveyId,
          question_id: testQuestionId,
          scope: "company",
          company_name: "テスト会社",
          business_unit_name: "",
          target_count: 10,
          respondent_count: 8,
          promoters: 4,
          passives: 2,
          detractors: 2,
          nps_respondent_base: 25,
          nps_imputed_base: 0,
        });

      expect(error).not.toBeNull();
      expect(error?.code).toBe("23505"); // unique_violation
    });
  });

  describe("enps_report_ai_summaries table", () => {
    it("should deny anonymous select", async () => {
      const { data, error } = await anonClient
        .from("enps_report_ai_summaries")
        .select("id")
        .eq("survey_id", testSurveyId);

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it("should deny authenticated select", async () => {
      const { data, error } = await authenticatedClient
        .from("enps_report_ai_summaries")
        .select("id")
        .eq("survey_id", testSurveyId);

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it("should deny authenticated insert", async () => {
      const { error } = await authenticatedClient
        .from("enps_report_ai_summaries")
        .insert({
          survey_id: testSurveyId,
          company_name: "不正な会社",
          model: "test",
          payload: {},
          input_response_count: 1,
        });

      expect(error).not.toBeNull();
    });

    it("should allow service role to read ai summaries", async () => {
      const { data, error } = await serviceClient
        .from("enps_report_ai_summaries")
        .select("company_name, input_response_count")
        .eq("survey_id", testSurveyId);

      expect(error).toBeNull();
      expect(data?.length).toBe(1);
      expect(data?.[0]?.input_response_count).toBe(10);
    });
  });
});
