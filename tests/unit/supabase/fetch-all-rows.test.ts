import { DEFAULT_PAGE_SIZE, fetchAllRows } from "@/lib/supabase/fetch-all-rows";

describe("fetchAllRows 1000件超の回帰", () => {
  it("PostgREST 既定の 1000 行上限を跨いで全件を連結する", async () => {
    const total = Array.from({ length: 2501 }, (_, index) => ({ id: index }));
    const calls: [number, number][] = [];

    const rows = await fetchAllRows<{ id: number }>((from, to) => {
      calls.push([from, to]);
      return Promise.resolve({
        data: total.slice(from, to + 1),
        error: null,
      });
    });

    expect(DEFAULT_PAGE_SIZE).toBe(1000);
    expect(rows).toHaveLength(2501);
    expect(rows[0].id).toBe(0);
    expect(rows[2500].id).toBe(2500);
    expect(calls).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it("先頭1000件だけ返す実装だと超過分が静かに欠ける", async () => {
    const total = Array.from({ length: 1201 }, (_, index) => ({ id: index }));
    const firstPage = total.slice(0, DEFAULT_PAGE_SIZE);
    expect(firstPage).toHaveLength(1000);
    expect(firstPage.length).toBeLessThan(total.length);

    const paged = await fetchAllRows<{ id: number }>((from, to) =>
      Promise.resolve({
        data: total.slice(from, to + 1),
        error: null,
      }),
    );
    expect(paged).toHaveLength(1201);
  });
});
