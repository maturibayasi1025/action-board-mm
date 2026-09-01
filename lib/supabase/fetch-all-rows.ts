/**
 * PostgREST の行上限を跨いで全件取得するためのヘルパ。
 *
 * Supabase は 1 リクエストで返す行数に上限（既定 1000 行）があり、超過分はエラーにならず
 * 静かに切り捨てられる。集計クエリでこれを踏むと欠損したまま正しく見える数値が出てしまうため、
 * 全件走査が前提のクエリは必ずこの関数を通す。
 *
 * 呼び出し側は `.range` の前に一意キー（通常は `id`）で `order` すること。
 * 並びが安定しないと、ページを跨いで行の欠落と重複が起きる。
 */

export const DEFAULT_PAGE_SIZE = 1000;

type PageResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

export async function fetchAllRows<T>(
  fetchPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
  options?: { pageSize?: number },
): Promise<T[]> {
  const pageSize = options?.pageSize ?? DEFAULT_PAGE_SIZE;
  if (pageSize <= 0) {
    throw new Error("pageSize は 1 以上である必要があります");
  }

  const all: T[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) {
      throw new Error(error.message);
    }
    const page = data ?? [];
    all.push(...page);

    if (page.length < pageSize) {
      return all;
    }
    from += pageSize;
  }
}

/**
 * `.in()` に渡す ID の数が多いと URL 長の上限を超えるため、分割して実行する。
 */
export const DEFAULT_IN_CHUNK_SIZE = 200;

export async function fetchByIdChunks<T>(
  ids: string[],
  fetchChunk: (chunk: string[]) => PromiseLike<PageResult<T>>,
  options?: { chunkSize?: number },
): Promise<T[]> {
  const chunkSize = options?.chunkSize ?? DEFAULT_IN_CHUNK_SIZE;
  if (chunkSize <= 0) {
    throw new Error("chunkSize は 1 以上である必要があります");
  }

  const all: T[] = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const { data, error } = await fetchChunk(chunk);
    if (error) {
      throw new Error(error.message);
    }
    all.push(...(data ?? []));
  }
  return all;
}
