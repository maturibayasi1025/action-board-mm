#!/usr/bin/env node
/**
 * Cloudflare Pages（next-on-pages）では `export const runtime = "edge"` が多いと
 * Worker バンドルが肥大化しやすく、無料枠の 3 MiB 制限に引っかかることがある。
 * デプロイ直前のビルドで本スクリプトを走らせ、Edge 指定を外して Node ランタイム側に寄せる。
 *
 * 対象: `app/` 以下の `.ts` / `.tsx`（再帰）。リポジトリのソースは変更せず、CI/ローカルビルド時のみ書き換える運用を想定。
 */
const fs = require("node:fs");
const path = require("node:path");

const appDir = path.join(process.cwd(), "app");

function collectTsFiles(dir, out = []) {
  if (!fs.existsSync(dir)) {
    return out;
  }
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) {
      collectTsFiles(full, out);
    } else if (/\.(ts|tsx)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

function stripEdgeRuntime(content) {
  let newContent = content
    .replace(/export const runtime = ["']edge["'];\s*/g, "")
    .replace(/\n\nexport const runtime = ["']edge["'];\n/g, "\n")
    .replace(/^\s*export const runtime = ["']edge["'];\s*\n/gm, "")
    .replace(/export const runtime = ["']edge["'];\n/g, "");

  newContent = newContent.replace(/\n\n\n+/g, "\n\n");
  return newContent;
}

function hasEdgeRuntime(content) {
  return (
    content.includes('export const runtime = "edge"') ||
    content.includes("export const runtime = 'edge'")
  );
}

console.log("Edge Runtime 設定を app/ 配下から削除中...");

const files = collectTsFiles(appDir);
let removedCount = 0;

for (const fullPath of files) {
  const content = fs.readFileSync(fullPath, "utf8");
  if (!hasEdgeRuntime(content)) {
    continue;
  }

  const newContent = stripEdgeRuntime(content);
  if (newContent !== content) {
    fs.writeFileSync(fullPath, newContent, "utf8");
    console.log(`✓ ${path.relative(process.cwd(), fullPath)}`);
    removedCount++;
  }
}

console.log(`Edge runtime 削除完了（${removedCount} ファイル）`);
