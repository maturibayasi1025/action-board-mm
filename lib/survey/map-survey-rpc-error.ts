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
  if (message.includes("invalid late grant")) {
    return "期限後回答のリンクが無効か、期限切れです。管理者に再発行を依頼してください。";
  }
  if (message.includes("invalid grant parameters")) {
    return "期限後回答のパラメータが不正です。";
  }
  if (message.includes("late grant not allowed: already responded")) {
    return "すでに回答があるため、期限後回答は利用できません。";
  }
  if (message.includes("survey not available for late")) {
    return "このアンケートは期限後回答の対象外です（終了前、または無効です）。";
  }
  if (message.includes("cannot nominate yourself")) {
    return "自分自身を指名することはできません";
  }
  if (message.includes("invalid response for question type")) {
    return "回答形式が正しくありません。やり直してください。";
  }
  return "回答の送信に失敗しました";
}
