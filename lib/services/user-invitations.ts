import "server-only";

import { createServiceClient } from "@/lib/supabase/server";
import { normalizeInviteEmail } from "@/lib/utils/invite-auth-user";

export type PendingInvitation = {
  id: string;
  email: string;
  business_unit_id: string | null;
  auth_user_id: string | null;
};

export async function findPendingInvitation(input: {
  authUserId?: string | null;
  email?: string | null;
}): Promise<PendingInvitation | null> {
  const supabase = await createServiceClient();

  if (input.authUserId) {
    const { data } = await supabase
      .from("user_invitations")
      .select("id, email, business_unit_id, auth_user_id")
      .eq("status", "pending")
      .eq("auth_user_id", input.authUserId)
      .maybeSingle();
    if (data) {
      return data;
    }
  }

  if (input.email) {
    const { data } = await supabase
      .from("user_invitations")
      .select("id, email, business_unit_id, auth_user_id")
      .eq("status", "pending")
      .eq("email", normalizeInviteEmail(input.email))
      .maybeSingle();
    return data ?? null;
  }

  return null;
}
