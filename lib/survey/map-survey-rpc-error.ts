/** replace_*_responses RPC の Postgres 例外をユーザー向け文言に寄せる */
export function mapSurveyRpcErrorMessage(message: string): string {
  if (message.includes("not authenticated")) {
    return "ログインが必要です";
  }
  if (message.includes("survey not available")) {
    return "アンケートが見つかりません";
  }
  if (message.includes("no valid responses")) {
    return "回答に有効なデータがありません";
  }
  if (
    message.includes("invalid response") ||
    message.includes("invalid question")
  ) {
    return "送信データが不正です。やり直してください。";
  }
  return "回答の送信に失敗しました";
}
