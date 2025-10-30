/**
 * Levenshtein距離による文字列類似度計算とあいまいマッチング
 */

/**
 * 2つの文字列間のLevenshtein距離を計算
 * @param str1 最初の文字列
 * @param str2 2番目の文字列
 * @returns 編集距離
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;

  // メモ化用の2次元配列
  const matrix: number[][] = [];

  // 初期化
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // 動的プログラミングで距離を計算
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // 削除
        matrix[i][j - 1] + 1, // 挿入
        matrix[i - 1][j - 1] + cost, // 置換
      );
    }
  }

  return matrix[len1][len2];
}

/**
 * 類似度スコアを計算（0-1の範囲、1が完全一致）
 * @param str1 最初の文字列
 * @param str2 2番目の文字列
 * @returns 類似度スコア
 */
export function similarity(str1: string, str2: string): number {
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 1.0;

  const distance = levenshteinDistance(str1, str2);
  return 1 - distance / maxLen;
}

/**
 * 候補リストから最も類似した文字列を検索
 * @param target 検索対象の文字列
 * @param candidates 候補文字列の配列
 * @param threshold 最小類似度スコア（デフォルト: 0.7）
 * @returns 最も類似した候補とその類似度、またはnull
 */
export function findBestMatch<T>(
  target: string,
  candidates: Array<{ text: string; data: T }>,
  threshold = 0.7,
): { text: string; data: T; similarity: number } | null {
  if (candidates.length === 0) return null;

  let bestMatch: { text: string; data: T; similarity: number } | null = null;
  let bestScore = -1;

  for (const candidate of candidates) {
    const score = similarity(
      target.toLowerCase(),
      candidate.text.toLowerCase(),
    );

    if (score > bestScore && score >= threshold) {
      bestScore = score;
      bestMatch = {
        text: candidate.text,
        data: candidate.data,
        similarity: score,
      };
    }
  }

  return bestMatch;
}
