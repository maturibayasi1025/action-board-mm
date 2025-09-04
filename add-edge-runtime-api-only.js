#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

console.log("APIルートのみにEdge Runtime設定を追加中...");

// APIルートのみを対象とする
const apiFiles = [
  "app/api/auth/callback/line/route.ts",
  "app/api/badges/notifications/route.ts",
  "app/api/batch/backfill-missing-xp/route.ts",
  "app/api/missions/[id]/og/route.tsx",
  "app/api/slack-notification/route.ts",
  "app/auth/callback/route.ts",
];

function addEdgeRuntimeToApiRoutes() {
  let addedCount = 0;

  for (const filePath of apiFiles) {
    const fullPath = path.join(process.cwd(), filePath);

    if (!fs.existsSync(fullPath)) {
      console.log(`ファイルが見つかりません: ${filePath}`);
      continue;
    }

    const content = fs.readFileSync(fullPath, "utf8");

    // 既にruntimeが設定されているかチェック
    if (
      content.includes('export const runtime = "edge"') ||
      content.includes("export const runtime = 'edge'")
    ) {
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
      const newContent = `${beforeImports}\n\nexport const runtime = "edge";${afterImports}`;

      fs.writeFileSync(fullPath, newContent, "utf8");
      console.log(`✓ Edge runtime追加: ${filePath}`);
      addedCount++;
    } else {
      // import文がない場合は、ファイルの先頭に追加
      const newContent = `export const runtime = "edge";\n\n${content}`;
      fs.writeFileSync(fullPath, newContent, "utf8");
      console.log(`✓ Edge runtime追加（先頭）: ${filePath}`);
      addedCount++;
    }
  }

  console.log(`APIルートのEdge runtime追加完了！ (${addedCount}ファイル処理)`);
}

addEdgeRuntimeToApiRoutes();
