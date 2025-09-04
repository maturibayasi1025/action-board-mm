#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

console.log("Edge Runtime設定を削除中...");

// 特定のファイルリストから削除
const targetFiles = [
  "app/page.tsx",
  "app/not-found.tsx",
  "app/privacy/page.tsx",
  "app/terms/page.tsx",
  "app/missions/[id]/page.tsx",
  "app/ranking/page.tsx",
  "app/ranking/ranking-mission/page.tsx",
  "app/ranking/ranking-prefecture/page.tsx",
  "app/map/poster/page.tsx",
  "app/map/poster/[prefecture]/page.tsx",
  "app/map/posting/page.tsx",
  "app/users/[id]/page.tsx",
  "app/(protected)/user-missions/page.tsx",
  "app/(protected)/user-missions/[id]/page.tsx",
  "app/(protected)/user-missions/my/page.tsx",
  "app/(protected)/user-missions/new/page.tsx",
  "app/(protected)/settings/profile/page.tsx",
  "app/(protected)/reset-password/page.tsx",
  "app/(auth-pages)/sign-in/page.tsx",
  "app/(auth-pages)/sign-up/page.tsx",
  "app/(auth-pages)/sign-up-email/page.tsx",
  "app/(auth-pages)/sign-up-success/page.tsx",
  "app/(auth-pages)/forgot-password/page.tsx",
  "app/auth/line-callback/page.tsx",
  "app/auth/callback/route.ts",
  "app/api/auth/callback/line/route.ts",
  "app/api/badges/notifications/route.ts",
  "app/api/batch/backfill-missing-xp/route.ts",
  "app/api/missions/[id]/og/route.tsx",
  "app/api/slack-notification/route.ts",
];

function removeEdgeRuntime() {
  let removedCount = 0;

  for (const filePath of targetFiles) {
    const fullPath = path.join(process.cwd(), filePath);

    if (!fs.existsSync(fullPath)) {
      console.log(`ファイルが見つかりません: ${filePath}`);
      continue;
    }

    const content = fs.readFileSync(fullPath, "utf8");

    // Edge runtime設定をチェック
    if (
      !content.includes('export const runtime = "edge"') &&
      !content.includes("export const runtime = 'edge'")
    ) {
      continue;
    }

    // Edge runtime設定を削除（複数のパターンに対応）
    let newContent = content
      .replace(/export const runtime = ["']edge["'];\s*/g, "")
      .replace(/\n\nexport const runtime = ["']edge["'];\n/g, "\n")
      .replace(/^\s*export const runtime = ["']edge["'];\s*\n/gm, "")
      .replace(/export const runtime = ["']edge["'];\n/g, "");

    // 余分な改行を整理
    newContent = newContent.replace(/\n\n\n+/g, "\n\n");

    if (newContent !== content) {
      fs.writeFileSync(fullPath, newContent, "utf8");
      console.log(`✓ Edge runtime削除: ${filePath}`);
      removedCount++;
    }
  }

  console.log(`Edge runtime削除完了！ (${removedCount}ファイル処理)`);
}

removeEdgeRuntime();
