import { beforeAll, describe, expect, it } from "@jest/globals";
import { type SupabaseClient, createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

describe("Award Surveys RLS Policies", () => {
  let anonClient: SupabaseClient;
  let authenticatedClient: SupabaseClient;
  let serviceClient: SupabaseClient;
  let testSurveyId: string;
  let testQuestionId: string;
  let testUserSelectQuestionId: string;
  let testNomineeUserId: string;
  let testUserId: string;
  let testUserEmail: string;

  beforeAll(async () => {
    anonClient = createClient(supabaseUrl, supabaseAnonKey);
    serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey);

    testUserEmail = `test-award-${Date.now()}@example.com`;

    // テスト用のユーザーを作成
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

    // 認証済みクライアントを作成（anonClient で signIn すると匿名テストが壊れるため専用クライアントを使用）
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

    // テスト用のアンケートを作成
    const { data: survey, error: surveyError } = await serviceClient
      .from("award_surveys")
      .insert({
        title: "テスト表彰アンケート",
        description: "テスト用",
        year_month: "2099-01",
        period_number: 999,
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

    // テスト用の質問を作成
    const { data: question, error: questionError } = await serviceClient
      .from("award_questions")
      .insert({
        question_text: "テスト質問",
        question_type: "textarea",
        question_group: "passionate_execution",
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

    const { data: userSelectQuestion, error: userSelectQuestionError } =
      await serviceClient
        .from("award_questions")
        .insert({
          question_text: "テスト指名質問",
          question_type: "user_select",
          question_group: "supreme_relations",
          display_order: 2,
          is_required: true,
          is_active: true,
        })
        .select()
        .single();

    if (userSelectQuestionError || !userSelectQuestion) {
      throw new Error(
        `Failed to create user_select question: ${userSelectQuestionError?.message}`,
      );
    }

    testUserSelectQuestionId = userSelectQuestion.id;

    const nomineeEmail = `test-award-nominee-${Date.now()}@example.com`;
    const { data: nomineeAuth, error: nomineeAuthError } =
      await serviceClient.auth.admin.createUser({
        email: nomineeEmail,
        password: "test-password-123",
        email_confirm: true,
      });

    if (nomineeAuthError || !nomineeAuth.user) {
      throw new Error(
        `Failed to create nominee user: ${nomineeAuthError?.message}`,
      );
    }

    testNomineeUserId = nomineeAuth.user.id;
  });

  describe("award_surveys table", () => {
    it("should allow anonymous users to view active surveys", async () => {
      const { data, error } = await anonClient
        .from("award_surveys")
        .select("*")
        .eq("id", testSurveyId);

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.length).toBeGreaterThan(0);
    });

    it("should not allow anonymous users to create surveys", async () => {
      const { error } = await anonClient.from("award_surveys").insert({
        title: "不正アンケート",
        year_month: "2099-02",
        period_number: 1000,
        start_date: new Date().toISOString(),
        end_date: new Date().toISOString(),
      });

      expect(error).not.toBeNull();
    });

    it("should not allow authenticated users to create surveys", async () => {
      const { error } = await authenticatedClient.from("award_surveys").insert({
        title: "不正アンケート",
        year_month: "2099-03",
        period_number: 1001,
        start_date: new Date().toISOString(),
        end_date: new Date().toISOString(),
      });

      expect(error).not.toBeNull();
    });
  });

  describe("award_questions table", () => {
    it("should allow anonymous users to view active questions", async () => {
      const { data, error } = await anonClient
        .from("award_questions")
        .select("*")
        .eq("id", testQuestionId);

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.length).toBeGreaterThan(0);
    });

    it("should not allow anonymous users to create questions", async () => {
      const { error } = await anonClient.from("award_questions").insert({
        question_text: "不正質問",
        question_type: "textarea",
        question_group: "passionate_execution",
        display_order: 99,
      });

      expect(error).not.toBeNull();
    });
  });

  describe("award_responses table", () => {
    it("should allow authenticated users to create responses with nominee_user_id", async () => {
      const { error } = await authenticatedClient
        .from("award_responses")
        .insert({
          survey_id: testSurveyId,
          user_id: testUserId,
          question_id: testUserSelectQuestionId,
          nominee_user_id: testNomineeUserId,
        });

      expect(error).toBeNull();
    });

    it("should allow authenticated users to view nominee_user_id on their responses", async () => {
      const { data, error } = await authenticatedClient
        .from("award_responses")
        .select("nominee_user_id")
        .eq("survey_id", testSurveyId)
        .eq("user_id", testUserId)
        .eq("question_id", testUserSelectQuestionId)
        .maybeSingle();

      expect(error).toBeNull();
      expect(data?.nominee_user_id).toBe(testNomineeUserId);
    });

    it("should allow authenticated users to create their own responses", async () => {
      const { error } = await authenticatedClient
        .from("award_responses")
        .insert({
          survey_id: testSurveyId,
          user_id: testUserId,
          question_id: testQuestionId,
          text_value: "テスト回答",
        });

      expect(error).toBeNull();
    });

    it("should allow authenticated users to view their own responses", async () => {
      const { data, error } = await authenticatedClient
        .from("award_responses")
        .select("*")
        .eq("survey_id", testSurveyId)
        .eq("user_id", testUserId);

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.length).toBeGreaterThan(0);
    });

    it("should allow authenticated users to delete their own responses", async () => {
      const { error } = await authenticatedClient
        .from("award_responses")
        .delete()
        .eq("survey_id", testSurveyId)
        .eq("user_id", testUserId);

      expect(error).toBeNull();
    });

    it("should not allow anonymous users to create responses", async () => {
      const { error } = await anonClient.from("award_responses").insert({
        survey_id: testSurveyId,
        user_id: testUserId,
        question_id: testQuestionId,
        text_value: "不正回答",
      });

      expect(error).not.toBeNull();
    });
  });

  describe("award_late_submission_grants table", () => {
    it("should deny anonymous select on late submission grants", async () => {
      const { data, error } = await anonClient
        .from("award_late_submission_grants")
        .select("id")
        .limit(1);

      // ポリシーが無いため RLS で全行フィルタされ、エラーではなく空配列が返る
      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it("should deny authenticated insert on late submission grants", async () => {
      const { error } = await authenticatedClient
        .from("award_late_submission_grants")
        .insert({
          survey_id: testSurveyId,
          user_id: testUserId,
          token_hash: "a".repeat(64),
          expires_at: new Date(Date.now() + 86400000).toISOString(),
          created_by_user_id: testUserId,
        });

      expect(error).not.toBeNull();
    });
  });
});
