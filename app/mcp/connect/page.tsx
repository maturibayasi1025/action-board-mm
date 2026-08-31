import { McpTokenCopy } from "@/app/mcp/connect/McpTokenCopy";
import {
  MCP_ACCESS_TOKEN_TTL_SECONDS,
  MCP_ISSUED_COOKIE,
} from "@/lib/mcp/oauth";
import { CONNECT_ERROR_MESSAGES } from "@/lib/mcp/oauth-http";
import { cookies } from "next/headers";
import Image from "next/image";
import Link from "next/link";

export const runtime = "edge";

export default async function McpConnectPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const token = cookieStore.get(MCP_ISSUED_COOKIE)?.value ?? null;
  const error = params.error
    ? (CONNECT_ERROR_MESSAGES[params.error] ??
      "ログインに失敗しました。もう一度試してください。")
    : null;

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-xl flex-col items-center gap-6 px-4 py-12">
      <Image
        src="/img/MMHD_symbol.png"
        alt="Maison Marc"
        width={114}
        height={96}
      />
      <h1 className="text-2xl font-medium">Action Board MCP 接続</h1>
      <p className="text-center text-sm text-muted-foreground">
        maisonmarc.com の Google アカウントでログインしてください。
        許可された人だけが、他のAIから公開データを読めます。
      </p>

      {error ? (
        <p className="w-full rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {token && params.ok === "1" ? (
        <IssuedTokenPanel token={token} />
      ) : (
        <a
          href="/api/mcp/oauth/authorize?mode=connect"
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Google でログイン
        </a>
      )}

      <p className="text-center text-xs text-muted-foreground">
        有効期限は {MCP_ACCESS_TOKEN_TTL_SECONDS / 3600}{" "}
        時間です。期限が切れたら このページで再ログインしてください。
      </p>
      <Link href="/sign-in" className="text-xs text-primary underline">
        アプリのログインへ戻る
      </Link>
    </main>
  );
}

function IssuedTokenPanel({ token }: { token: string }) {
  return (
    <section className="flex w-full flex-col gap-3">
      <p className="text-sm">
        ログインできました。次のトークンを Cursor の MCP 設定に貼ってください。
      </p>
      <textarea
        readOnly
        className="min-h-32 w-full rounded-md border bg-muted p-3 font-mono text-xs"
        value={token}
      />
      <McpTokenCopy token={token} />
      <pre className="overflow-x-auto rounded-md border bg-muted p-3 text-xs">
        {`{
  "mcpServers": {
    "action-board": {
      "url": "https://mm-actionboard.jp/api/mcp",
      "headers": {
        "Authorization": "Bearer <上のトークン>"
      }
    }
  }
}`}
      </pre>
    </section>
  );
}
