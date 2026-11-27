import { Card, CardContent } from "@/components/ui/card";

/** 本人の既存回答が取れなかったとき、回答フォームの代わりに出す */
export function ResponsesLoadError({ title }: { title: string }) {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">{title}</h1>
        <Card>
          <CardContent className="pt-6">
            <p role="alert" className="text-center text-muted-foreground">
              回答の取得に失敗しました。時間をおいて、ページを再読み込みしてください。
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
