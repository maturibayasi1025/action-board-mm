import { Card } from "@/components/ui/card";
import { dateTimeFormatter } from "@/lib/formatter";
import { fetchAllRows } from "@/lib/supabase/fetch-all-rows";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/types/supabase";

export default async function Events() {
  const supabase = await createClient();

  const events = await fetchAllRows<Tables<"events">>((from, to) =>
    supabase
      .from("events")
      .select()
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, to),
  ).catch((error) => {
    console.error("イベントの取得エラー:", error);
    return [];
  });

  return (
    <div className="flex flex-col px-5 py-6 gap-2">
      <h2 className="text-lg font-bold">今後のイベント</h2>

      {events.map((event) => (
        <Card key={event.id} className="flex flex-col p-4">
          <div className="flex flex-col gap-1">
            <p>{dateTimeFormatter(new Date(event.starts_at))}</p>
            <p>{event.title}</p>
            <a href={event.url}>リンク</a>
          </div>
        </Card>
      ))}
    </div>
  );
}
