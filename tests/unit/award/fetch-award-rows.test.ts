import { fetchAllAwardResponses } from "@/lib/award/fetch-award-rows";
import type { Database } from "@/lib/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

type AwardRow = {
  id: string;
  survey_id: string;
};

function createAwardClient(rows: AwardRow[]): SupabaseClient<Database> {
  const sorted = [...rows].sort((a, b) => a.id.localeCompare(b.id));

  return {
    from: (table: string) => {
      if (table !== "award_responses") {
        throw new Error(`unexpected table ${table}`);
      }
      const state: { eqId?: string; inIds?: string[] } = {};
      const chain = {
        select: () => chain,
        eq: (_column: string, value: string) => {
          state.eqId = value;
          return chain;
        },
        in: (_column: string, ids: string[]) => {
          state.inIds = ids;
          return chain;
        },
        order: () => chain,
        range: async (from: number, to: number) => {
          let filtered = sorted;
          if (state.eqId) {
            filtered = filtered.filter((row) => row.survey_id === state.eqId);
          }
          if (state.inIds) {
            filtered = filtered.filter((row) =>
              state.inIds?.includes(row.survey_id),
            );
          }
          return {
            data: filtered.slice(from, to + 1),
            error: null,
          };
        },
      };
      return chain;
    },
  } as unknown as SupabaseClient<Database>;
}

describe("fetchAllAwardResponses", () => {
  it("1000件を超える四半期回答をページングして全件返す", async () => {
    const rows: AwardRow[] = [
      ...Array.from({ length: 1000 }, (_, index) => ({
        id: `a${String(index).padStart(4, "0")}`,
        survey_id: "s6",
      })),
      ...Array.from({ length: 201 }, (_, index) => ({
        id: `b${String(index).padStart(4, "0")}`,
        survey_id: "s7",
      })),
    ];

    const fetched = await fetchAllAwardResponses<AwardRow>(
      createAwardClient(rows),
      ["s6", "s7"],
      "id, survey_id",
    );

    expect(fetched).toHaveLength(1201);
    expect(fetched.filter((row) => row.survey_id === "s6")).toHaveLength(1000);
    expect(fetched.filter((row) => row.survey_id === "s7")).toHaveLength(201);
  });
});
