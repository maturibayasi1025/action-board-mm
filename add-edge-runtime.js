#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

// Edge Runtimeを追加する必要があるページファイルのリスト
const pageFiles = [
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
  "app/privacy/page.tsx",
  "app/terms/page.tsx",
];

// Route handlers (既に処理済みは除外)
const routeFiles = ["app/auth/callback/route.ts"];

const allFiles = [...pageFiles, ...routeFiles];

console.log("Edge Runtime設定を追加中...");

for (const filePath of allFiles) {
  const fullPath = path.join(process.cwd(), filePath);

  if (!fs.existsSync(fullPath)) {
    console.log(`ファイルが見つかりません: ${filePath}`);
    continue;
  }

  const content = fs.readFileSync(fullPath, "utf8");

  // 既にruntimeが設定されているかチェック
  if (content.includes("export const runtime = 'edge'")) {
    console.log(`既に設定済み: ${filePath}`);
    continue;
  }

  // import文の後に追加（改行を含む最初のimport文の後）
  const importRegex = /^(import[\s\S]*?from[\s\S]*?;)\s*$/m;
  const match = content.match(importRegex);

  if (match) {
    // 最後のimport文を見つけて、その後に追加
    const lastImportIndex = content.lastIndexOf("import");
    const afterLastImport = content.indexOf(";", lastImportIndex) + 1;

    const beforeImports = content.substring(0, afterLastImport);
    const afterImports = content.substring(afterLastImport);

    // Edge runtime設定を追加
    const newContent = `${beforeImports}\n\nexport const runtime = 'edge';${afterImports}`;

    fs.writeFileSync(fullPath, newContent, "utf8");
    console.log(`✓ 更新完了: ${filePath}`);
  } else {
    console.log(`import文が見つかりません: ${filePath}`);
  }
}

console.log("完了！");
