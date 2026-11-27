import type { Database } from "@/lib/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * PostgREST の既定上限（1 リクエスト最大 1000 行）を再現する最小限の Supabase クライアント。
 * 超過分はエラーにせず静かに切り捨てる。order が無いリクエストは毎回並びが変わる
 * （Postgres は ORDER BY なしの並びを保証しない）。
 */
export const POSTGREST_MAX_ROWS = 1000;

type Row = Record<string, unknown>;
type Filter = (row: Row) => boolean;
type OrderKey = { column: string; ascending: boolean };

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  return String(a) < String(b) ? -1 : 1;
}

export function createFakePostgrest(tables: Record<string, Row[]>) {
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

    const execute = () => {
      requestCount += 1;
      let rows = source.filter((row) => filters.every((f) => f(row)));
      const total = rows.length;
      if (headCount) {
        return { data: null, error: null, count: total };
      }
      if (orders.length > 0) {
        rows = [...rows].sort((a, b) => {
          for (const { column, ascending } of orders) {
            const c = compare(a[column], b[column]);
            if (c !== 0) return ascending ? c : -c;
          }
          return 0;
        });
      } else if (rows.length > 0) {
        const shift = (requestCount * 7919) % rows.length;
        rows = [...rows.slice(shift), ...rows.slice(0, shift)];
      }
      const [start, end] = range ?? [0, rows.length - 1];
      const page = rows
        .slice(start, end + 1)
        .slice(0, POSTGREST_MAX_ROWS)
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
      in: (column: string, values: unknown[]) => {
        const set = new Set(values);
        filters.push((row) => set.has(row[column]));
        return builder;
      },
      order: (column: string, options?: { ascending?: boolean }) => {
        orders.push({ column, ascending: options?.ascending ?? true });
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
