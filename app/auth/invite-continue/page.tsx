"use client";

import { recoverInviteSessionFromLocation } from "@/lib/auth/recover-invite-session";
import { INVITE_SET_PASSWORD_PATH } from "@/lib/utils/invite-auth-user";
import Image from "next/image";
import { useEffect } from "react";

export const runtime = "edge";

export default function InviteContinuePage() {
  useEffect(() => {
    let cancelled = false;

    const timeoutId = window.setTimeout(() => {
      if (!cancelled) {
        window.location.replace(INVITE_SET_PASSWORD_PATH);
      }
    }, 8000);

    void recoverInviteSessionFromLocation()
      .catch(() => undefined)
      .then(() => {
        if (!cancelled) {
          window.location.replace(INVITE_SET_PASSWORD_PATH);
        }
      });

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, []);

  return (
    <div className="flex-1 flex flex-col min-w-72 items-center">
      <div className="flex justify-center items-center m-4">
        <Image
          src="/img/MMHD_symbol.png"
          alt="MMHD_symbol"
          width={114}
          height={96}
        />
      </div>
      <p className="text-sm text-muted-foreground text-center min-w-72">
        招待を確認しています…
      </p>
    </div>
  );
}
