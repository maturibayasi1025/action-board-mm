import { permanentRedirect } from "next/navigation";

export const runtime = "edge";

export default async function DashboardRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string | string[] }>;
}) {
  const params = await searchParams;
  const raw = params.period;
  const period = Array.isArray(raw) ? raw[0] : raw;
  const sp = new URLSearchParams();
  if (period) {
    sp.set("period", period);
  }
  const q = sp.toString();
  permanentRedirect(q ? `/?${q}` : "/");
}
