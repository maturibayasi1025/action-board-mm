"use client";

import { parseAuthHashTokens } from "@/lib/auth/parse-auth-hash-tokens";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";

type Props = {
  children: ReactNode;
};

export function InviteAuthHashBootstrap({ children }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<"checking" | "ready">("checking");

  useEffect(() => {
    const tokens = parseAuthHashTokens(window.location.hash);
    if (!tokens) {
      setStatus("ready");
      return;
    }

    const supabase = createClient();
    void supabase.auth
      .signOut({ scope: "local" })
      .then(() => supabase.auth.setSession(tokens))
      .then(({ error }) => {
        const url = new URL(window.location.href);
        url.hash = "";
        window.history.replaceState(null, "", `${url.pathname}${url.search}`);
        if (!error) {
          router.refresh();
        }
        setStatus("ready");
      })
      .catch(() => {
        setStatus("ready");
      });
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
