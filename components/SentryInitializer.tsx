"use client";

import { useSentry } from "@/lib/sentry/client";

export function SentryInitializer() {
  useSentry();
  return null; // このコンポーネントは何も描画しない
}
