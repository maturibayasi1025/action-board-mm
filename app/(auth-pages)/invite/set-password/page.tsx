import { FormMessage } from "@/components/form-message";
import { createClient } from "@/lib/supabase/server";
import Image from "next/image";
import Link from "next/link";
import InviteSetPasswordForm from "./InviteSetPasswordForm";

export const runtime = "edge";

export default async function InviteSetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex-1 flex flex-col min-w-72">
      <div className="flex justify-center items-center m-4">
        <Image
          src="/img/MMHD_symbol.png"
          alt="MMHD_symbol"
          width={114}
          height={96}
        />
      </div>
      <div className="flex justify-center">
        {user ? (
          <InviteSetPasswordForm />
        ) : (
          <div className="flex flex-col items-center gap-4 min-w-72 max-w-72">
            <h1 className="text-2xl font-medium text-center">
              招待リンクが無効です
            </h1>
            <FormMessage
              message={{
                error:
                  "招待リンクの有効期限が切れているか、すでに使用されています。経営者に再送を依頼してください。",
              }}
            />
            <Link className="text-primary underline" href="/sign-in">
              ログイン画面へ
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
