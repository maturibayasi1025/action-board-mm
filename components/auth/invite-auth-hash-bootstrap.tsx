"use client";

import { parseAuthHashTokens } from "@/lib/auth/parse-auth-hash-tokens";
import { createClient } from "@/lib/supabase/client";
import { INVITE_SET_PASSWORD_PATH } from "@/lib/utils/invite-auth-user";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";

type Props = {
  children: ReactNode;
};

const RECOVERY_TIMEOUT_MS = 8000;

export function InviteAuthHashBootstrap({ children }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<"checking" | "ready">("checking");

  useEffect(() => {
    let cancelled = false;

    const timeoutId = window.setTimeout(() => {
      if (!cancelled) {
        setStatus("ready");
      }
    }, RECOVERY_TIMEOUT_MS);

    async function recoverSession() {
      const tokens = parseAuthHashTokens(window.location.hash);
      if (!tokens) {
        setStatus("ready");
        return;
      }

      const supabase = createClient();
      await supabase.auth.signOut();
      const { error } = await supabase.auth.setSession(tokens);
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}`,
      );
      if (cancelled) {
        return;
      }
      if (error) {
        setStatus("ready");
        return;
      }
      router.replace(INVITE_SET_PASSWORD_PATH);
      router.refresh();
      setStatus("ready");
    }

    void recoverSession().catch(() => {
      if (!cancelled) {
        setStatus("ready");
      }
    });

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [router]);

  if (status === "checking") {
    return (
      <p className="text-sm text-muted-foreground text-center min-w-72">
        招待を確認しています…
      </p>
    );
  }

  return children;
}
