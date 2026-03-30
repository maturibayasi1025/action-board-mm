import {
  validateAwardResponses,
  validateEnpsResponses,
} from "@/lib/survey/validate-survey-responses";

describe("validateEnpsResponses", () => {
  const baseQuestions = [
    {
      id: "q1",
      question_type: "score_0_10" as const,
      is_required: true,
      is_active: true,
      parent_question_id: null,
    },
    {
      id: "q2",
      question_type: "text" as const,
      is_required: true,
      is_active: true,
      parent_question_id: "q1",
    },
  ];

  it("rejects when required root score is missing", () => {
    const r = validateEnpsResponses(baseQuestions, [
      { question_id: "q1", score_value: null, text_value: null },
      { question_id: "q2", score_value: null, text_value: "reason" },
    ]);
    expect(r.ok).toBe(false);
  });

  it("accepts when parent score and child text are present", () => {
    const r = validateEnpsResponses(baseQuestions, [
      { question_id: "q1", score_value: 8, text_value: null },
      { question_id: "q2", score_value: null, text_value: "reason" },
    ]);
    expect(r.ok).toBe(true);
  });
});

describe("validateAwardResponses", () => {
  it("rejects when required question has empty text", () => {
    const r = validateAwardResponses(
      [
        { id: "a1", is_required: true, is_active: true },
        { id: "a2", is_required: false, is_active: true },
      ],
      [{ question_id: "a1", text_value: "   " }],
    );
    expect(r.ok).toBe(false);
  });

  it("accepts when all required have text", () => {
    const r = validateAwardResponses(
      [{ id: "a1", is_required: true, is_active: true }],
      [{ question_id: "a1", text_value: "ok" }],
    );
    expect(r.ok).toBe(true);
  });
});
