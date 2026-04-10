#!/usr/bin/env node
/**
 * `app/` 以下の `export const runtime = "edge"` を一括削除する（再帰）。
 *
 * 注意: **`@cloudflare/next-on-pages` では非静的ルートに edge が必須**のため、本スクリプトを
 * デプロイビルドに組み込むと「Please make sure that all your non-static routes export
 * runtime = 'edge'」で失敗します。Cloudflare Pages 向けの通常デプロイでは使わないでください。
 *
 * 用途例: next-on-pages 以外の検証、ローカルでの比較など。
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
