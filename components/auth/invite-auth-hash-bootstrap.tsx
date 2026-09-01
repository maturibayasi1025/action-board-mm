"use client";

import { parseAuthCallbackTokens } from "@/lib/auth/parse-auth-hash-tokens";
import { recoverInviteSessionFromLocation } from "@/lib/auth/recover-invite-session";
import { INVITE_SET_PASSWORD_PATH } from "@/lib/utils/invite-auth-user";
import { type ReactNode, useEffect, useState } from "react";

type Props = {
  children: ReactNode;
};

const RECOVERY_TIMEOUT_MS = 8000;

export function InviteAuthHashBootstrap({ children }: Props) {
  const [status, setStatus] = useState<"checking" | "ready">("checking");

  useEffect(() => {
    const tokens = parseAuthCallbackTokens(
      window.location.hash,
      window.location.search,
    );
    if (!tokens) {
      setStatus("ready");
      return;
    }

    let cancelled = false;

    const timeoutId = window.setTimeout(() => {
      if (!cancelled) {
        setStatus("ready");
      }
    }, RECOVERY_TIMEOUT_MS);

    void recoverInviteSessionFromLocation()
      .then((result) => {
        if (cancelled) {
          return;
        }
        if (result === "recovered") {
          window.location.replace(INVITE_SET_PASSWORD_PATH);
          return;
        }
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) {
          setStatus("ready");
        }
      });

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, []);

  if (status === "checking") {
    return (
      <p className="text-sm text-muted-foreground text-center min-w-72">
        招待を確認しています…
      </p>
    );
  }

  return children;
}
