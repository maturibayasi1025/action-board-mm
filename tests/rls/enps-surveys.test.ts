import { beforeAll, describe, expect, it } from "@jest/globals";
import { type SupabaseClient, createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

describe("eNPS Surveys RLS Policies", () => {
  let anonClient: SupabaseClient;
  let authenticatedClient: SupabaseClient;
  let serviceClient: SupabaseClient;
  let testSurveyId: string;
  let testQuestionId: string;
  let testUserId: string;

  beforeAll(async () => {
    anonClient = createClient(supabaseUrl, supabaseAnonKey);
    serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey);

    // テスト用のユーザーを作成
    const { data: authData, error: authError } =
      await serviceClient.auth.admin.createUser({
        email: `test-enps-${Date.now()}@example.com`,
        password: "test-password-123",
        email_confirm: true,
      });

    if (authError || !authData.user) {
      throw new Error(`Failed to create test user: ${authError?.message}`);
    }

    testUserId = authData.user.id;

    // 認証済みクライアントを作成
    const { data: signInData } = await anonClient.auth.signInWithPassword({
      email: `test-enps-${Date.now()}@example.com`,
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
      .from("enps_surveys")
      .insert({
        title: "テストアンケート",
        description: "テスト用",
        year_month: "2026-99",
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
      .from("enps_questions")
      .insert({
        question_text: "テスト質問",
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
  });

  describe("enps_surveys table", () => {
    it("should allow anonymous users to view active surveys", async () => {
      const { data, error } = await anonClient
        .from("enps_surveys")
        .select("*")
        .eq("id", testSurveyId);

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.length).toBeGreaterThan(0);
    });

    it("should not allow anonymous users to create surveys", async () => {
      const { error } = await anonClient.from("enps_surveys").insert({
        title: "不正なアンケート",
        year_month: "2026-98",
        start_date: new Date().toISOString(),
        end_date: new Date().toISOString(),
      });

      expect(error).not.toBeNull();
      expect(error?.code).toBe("42501"); // insufficient_privilege
    });

    it("should not allow anonymous users to update surveys", async () => {
      const { error } = await anonClient
        .from("enps_surveys")
        .update({ title: "更新されたタイトル" })
        .eq("id", testSurveyId);

      expect(error).not.toBeNull();
      expect(error?.code).toBe("42501");
    });
  });

  describe("enps_questions table", () => {
    it("should allow anonymous users to view active questions", async () => {
      const { data, error } = await anonClient
        .from("enps_questions")
        .select("*")
        .eq("id", testQuestionId);

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.length).toBeGreaterThan(0);
    });

    it("should not allow anonymous users to create questions", async () => {
      const { error } = await anonClient.from("enps_questions").insert({
        question_text: "不正な質問",
        question_type: "score_0_10",
        display_order: 999,
      });

      expect(error).not.toBeNull();
      expect(error?.code).toBe("42501");
    });
  });

  describe("enps_responses table", () => {
    it("should allow authenticated users to create their own responses", async () => {
      const { data, error } = await authenticatedClient
        .from("enps_responses")
        .insert({
          survey_id: testSurveyId,
          question_id: testQuestionId,
          user_id: testUserId,
          score_value: 8,
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.score_value).toBe(8);

      // クリーンアップ
      await serviceClient.from("enps_responses").delete().eq("id", data.id);
    });

    it("should allow authenticated users to view their own responses", async () => {
      // まず回答を作成
      const { data: response } = await serviceClient
        .from("enps_responses")
        .insert({
          survey_id: testSurveyId,
          question_id: testQuestionId,
          user_id: testUserId,
          score_value: 9,
        })
        .select()
        .single();

      if (!response) {
        throw new Error("Failed to create test response");
      }

      // 自分の回答を取得
      const { data, error } = await authenticatedClient
        .from("enps_responses")
        .select("*")
        .eq("id", response.id);

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.length).toBe(1);
      expect(data?.[0]?.user_id).toBe(testUserId);

      // クリーンアップ
      await serviceClient.from("enps_responses").delete().eq("id", response.id);
    });

    it("should not allow authenticated users to view other users' responses", async () => {
      // 別ユーザーの回答を作成
      const { data: otherUser } = await serviceClient.auth.admin.createUser({
        email: `other-user-${Date.now()}@example.com`,
        password: "test-password-123",
        email_confirm: true,
      });

      if (!otherUser.user) {
        throw new Error("Failed to create other user");
      }

      const { data: otherResponse } = await serviceClient
        .from("enps_responses")
        .insert({
          survey_id: testSurveyId,
          question_id: testQuestionId,
          user_id: otherUser.user.id,
          score_value: 5,
        })
        .select()
        .single();

      if (!otherResponse) {
        throw new Error("Failed to create other user's response");
      }

      // 自分のクライアントから別ユーザーの回答を取得しようとする
      const { data, error } = await authenticatedClient
        .from("enps_responses")
        .select("*")
        .eq("id", otherResponse.id);

      // RLSにより、別ユーザーの回答は取得できない
      expect(data).toBeDefined();
      expect(data?.length).toBe(0);

      // クリーンアップ
      await serviceClient
        .from("enps_responses")
        .delete()
        .eq("id", otherResponse.id);
      await serviceClient.auth.admin.deleteUser(otherUser.user.id);
    });

    it("should not allow anonymous users to create responses", async () => {
      const { error } = await anonClient.from("enps_responses").insert({
        survey_id: testSurveyId,
        question_id: testQuestionId,
        user_id: testUserId,
        score_value: 7,
      });

      expect(error).not.toBeNull();
      expect(error?.code).toBe("42501");
    });

    it("should allow authenticated users to delete their own responses", async () => {
      const { data: created, error: insertErr } = await serviceClient
        .from("enps_responses")
        .insert({
          survey_id: testSurveyId,
          question_id: testQuestionId,
          user_id: testUserId,
          score_value: 6,
        })
        .select()
        .single();

      if (insertErr || !created) {
        throw new Error(
          `Failed to create test response for delete: ${insertErr?.message}`,
        );
      }

      const { error: deleteError } = await authenticatedClient
        .from("enps_responses")
        .delete()
        .eq("id", created.id);

      expect(deleteError).toBeNull();

      const { data: remaining } = await serviceClient
        .from("enps_responses")
        .select("id")
        .eq("id", created.id);

      expect(remaining?.length ?? 0).toBe(0);
    });

    it("should not allow authenticated users to delete other users' responses", async () => {
      const { data: otherUser } = await serviceClient.auth.admin.createUser({
        email: `other-delete-${Date.now()}@example.com`,
        password: "test-password-123",
        email_confirm: true,
      });

      if (!otherUser.user) {
        throw new Error("Failed to create other user");
      }

      const { data: otherResponse } = await serviceClient
        .from("enps_responses")
        .insert({
          survey_id: testSurveyId,
          question_id: testQuestionId,
          user_id: otherUser.user.id,
          score_value: 4,
        })
        .select()
        .single();

      if (!otherResponse) {
        throw new Error("Failed to create other user's response");
      }

      const { error } = await authenticatedClient
        .from("enps_responses")
        .delete()
        .eq("id", otherResponse.id);

      expect(error).not.toBeNull();
      expect(error?.code).toBe("42501");

      await serviceClient
        .from("enps_responses")
        .delete()
        .eq("id", otherResponse.id);
      await serviceClient.auth.admin.deleteUser(otherUser.user.id);
    });
  });

  describe("enps_late_submission_grants table", () => {
    it("should deny anonymous select on late submission grants", async () => {
      const { error } = await anonClient
        .from("enps_late_submission_grants")
        .select("id")
        .limit(1);

      expect(error).not.toBeNull();
    });

    it("should deny authenticated insert on late submission grants", async () => {
      const { error } = await authenticatedClient
        .from("enps_late_submission_grants")
        .insert({
          survey_id: testSurveyId,
          user_id: testUserId,
          token_hash: "b".repeat(64),
          expires_at: new Date(Date.now() + 86400000).toISOString(),
          created_by_user_id: testUserId,
        });

      expect(error).not.toBeNull();
    });
  });
});
