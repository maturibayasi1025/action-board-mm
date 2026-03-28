/** Server Action から返す（本番でもクライアントにそのまま渡せる）送信結果 */
export type SurveySubmitActionResult =
  | { ok: true; submittedByUserId: string }
  | { ok: false; message: string };
