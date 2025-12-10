/**
 * 日本時間（JST）の今日の0時0分をUTC時間で返す
 * UTC 15:00（前日）= JST 00:00（当日）
 *
 * @returns 日本時間の今日の0時0分に対応するUTC時間のDateオブジェクト
 */
export function getTodayStartJST(): Date {
  const now = new Date();
  const todayJST = new Date(now);
  todayJST.setUTCHours(15, 0, 0, 0);
  if (todayJST > now) {
    // まだ日本時間の0時になっていない場合は前日にする
    todayJST.setUTCDate(todayJST.getUTCDate() - 1);
  }
  return todayJST;
}
