import { INVITE_CONTINUE_PATH } from "@/lib/auth/invite-callback-rewrite";

export const INVITE_HASH_BOOTSTRAP_SCRIPT_PATH = "/invite-hash-bootstrap.js";

export function inviteContinueDestination(
  search: string,
  hash: string,
): string {
  return `${INVITE_CONTINUE_PATH}${search}${hash}`;
}

export function inviteHashFallbackHtml(): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>招待を確認しています</title>
<script src="${INVITE_HASH_BOOTSTRAP_SCRIPT_PATH}" defer></script>
</head>
<body>
<p>招待を確認しています…</p>
</body>
</html>`;
}
