import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function DashboardSectionSkeleton() {
  return (
    <section className="animate-pulse bg-slate-50 py-12 md:py-16" aria-hidden>
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4">
        <div className="space-y-3 text-center">
          <div className="mx-auto h-9 max-w-md rounded-md bg-muted md:h-10" />
          <div className="mx-auto h-4 max-w-lg rounded bg-muted" />
          <div className="mx-auto h-9 max-w-[200px] rounded-lg bg-muted" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="h-28 rounded-lg bg-muted" />
          <div className="h-28 rounded-lg bg-muted" />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="bg-white">
            <CardHeader>
              <div className="h-6 w-48 rounded bg-muted" />
            </CardHeader>
            <CardContent>
              <div className="h-[280px] rounded-md bg-muted" />
            </CardContent>
          </Card>
          <Card className="bg-white">
            <CardHeader>
              <div className="h-6 w-40 rounded bg-muted" />
            </CardHeader>
            <CardContent>
              <div className="h-[280px] rounded-md bg-muted" />
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
