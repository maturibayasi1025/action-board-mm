import type { Database } from "@/lib/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * PostgREST の既定上限（1 リクエスト最大 1000 行）を再現する最小限の Supabase クライアント。
 * `maxRows` で上限を変えられる（サーバ側の max_rows を既定より小さくした構成の再現）。
 * 超過分はエラーにせず静かに切り捨てる。order で決まらない並び（order なし、または同順位）は
 * リクエストごとに変わる（Postgres はその並びを保証しない）。
 */
export const POSTGREST_MAX_ROWS = 1000;

/**
 * `.in()` の値が多すぎると URL 長の上限を超えて失敗する。分割の有無をテストで判別できるよう、
 * 既定の分割サイズ（200）より大きく、テストデータの件数より小さい値で失敗させる。
 */
export const MAX_IN_VALUES = 500;

type Row = Record<string, unknown>;
type Filter = (row: Row) => boolean;
type OrderKey = { column: string; ascending: boolean; nullsFirst: boolean };

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0;
  return String(a) < String(b) ? -1 : 1;
}

const isNull = (v: unknown) => v === null || v === undefined;

export function createFakePostgrest(
  tables: Record<string, Row[]>,
  options?: { maxRows?: number },
) {
  const maxRows = options?.maxRows ?? POSTGREST_MAX_ROWS;
  let requestCount = 0;

  const from = (table: string) => {
    const source = tables[table];
    if (!source) {
      throw new Error(`unexpected table ${table}`);
    }

    const filters: Filter[] = [];
    const orders: OrderKey[] = [];
    let range: [number, number] | null = null;
    let headCount = false;
    let single: "single" | "maybeSingle" | null = null;
    let inTooLong = false;

    const execute = () => {
      requestCount += 1;
      if (inTooLong) {
        return { data: null, error: { message: "URI Too Long" }, count: null };
      }
      let rows = source.filter((row) => filters.every((f) => f(row)));
      const total = rows.length;
      if (headCount) {
        return { data: null, error: null, count: total };
      }
      // Postgres は ORDER BY で決まらない並び（order なし、または同順位）を保証しない
      if (rows.length > 0) {
        const shift = (requestCount * 7919) % rows.length;
        rows = [...rows.slice(shift), ...rows.slice(0, shift)];
      }
      if (orders.length > 0) {
        rows = rows.sort((a, b) => {
          for (const { column, ascending, nullsFirst } of orders) {
            const an = isNull(a[column]);
            const bn = isNull(b[column]);
            if (an || bn) {
              if (an && bn) continue;
              return an === nullsFirst ? -1 : 1;
            }
            const c = compare(a[column], b[column]);
            if (c !== 0) return ascending ? c : -c;
          }
          return 0;
        });
      }
      const [start, end] = range ?? [0, rows.length - 1];
      const page = rows
        .slice(start, end + 1)
        .slice(0, maxRows)
        .map((row) => ({ ...row }));
      if (single) {
        const first = page[0] ?? null;
        if (!first && single === "single") {
          return { data: null, error: { message: "not found" }, count: null };
        }
        return { data: first, error: null, count: null };
      }
      return { data: page, error: null, count: null };
    };

    const builder = {
      select: (_columns?: string, options?: { head?: boolean }) => {
        headCount = Boolean(options?.head);
        return builder;
      },
      eq: (column: string, value: unknown) => {
        filters.push((row) => row[column] === value);
        return builder;
      },
      is: (column: string, value: null) => {
        filters.push((row) => (row[column] ?? null) === value);
        return builder;
      },
      not: (column: string, _op: "is", value: null) => {
        filters.push((row) => (row[column] ?? null) !== value);
        return builder;
      },
      gte: (column: string, value: unknown) => {
        filters.push(
          (row) => !isNull(row[column]) && compare(row[column], value) >= 0,
        );
        return builder;
      },
      lte: (column: string, value: unknown) => {
        filters.push(
          (row) => !isNull(row[column]) && compare(row[column], value) <= 0,
        );
        return builder;
      },
      ilike: (column: string, pattern: string) => {
        const needle = pattern
          .replace(/^%|%$/g, "")
          .replace(/\\(.)/g, "$1")
          .toLowerCase();
        filters.push((row) =>
          String(row[column] ?? "")
            .toLowerCase()
            .includes(needle),
        );
        return builder;
      },
      in: (column: string, values: unknown[]) => {
        if (values.length > MAX_IN_VALUES) {
          inTooLong = true;
        }
        const set = new Set(values);
        filters.push((row) => set.has(row[column]));
        return builder;
      },
      order: (
        column: string,
        options?: { ascending?: boolean; nullsFirst?: boolean },
      ) => {
        const ascending = options?.ascending ?? true;
        // PostgREST と同じく、既定は昇順で NULLS LAST、降順で NULLS FIRST
        orders.push({
          column,
          ascending,
          nullsFirst: options?.nullsFirst ?? !ascending,
        });
        return builder;
      },
      range: (start: number, end: number) => {
        range = [start, end];
        return builder;
      },
      limit: (n: number) => {
        range = [0, n - 1];
        return builder;
      },
      single: () => {
        single = "single";
        return builder;
      },
      maybeSingle: () => {
        single = "maybeSingle";
        return builder;
      },
      // biome-ignore lint/suspicious/noThenProperty: Supabase のクエリビルダーと同じく await できるようにする
      then: <R>(
        resolve: (value: ReturnType<typeof execute>) => R,
        reject?: (reason: unknown) => R,
      ) => {
        try {
          return Promise.resolve(resolve(execute()));
        } catch (error) {
          if (reject) return Promise.resolve(reject(error));
          throw error;
        }
      },
    };
    return builder;
  };

  return { from } as unknown as SupabaseClient<Database>;
}

export function pad(n: number): string {
  return String(n).padStart(4, "0");
}
