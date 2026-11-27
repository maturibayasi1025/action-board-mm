/**
 * @jest-environment node
 */
import fs from "node:fs";
import path from "node:path";

const rootDir = path.resolve(__dirname, "../..");
const appDir = path.join(rootDir, "app");
const appPathsManifest = path.join(
  rootDir,
  ".next/server/app-paths-manifest.json",
);

const ROUTE_FILE = /^(page|route)\.(tsx|ts|jsx|js)$/;

function toUrlPath(segments: string[]): string {
  const visible = segments.filter(
    (segment) => !/^\(.+\)$/.test(segment) && !segment.startsWith("@"),
  );
  return `/${visible.join("/")}`;
}

function routesFromAppDir(dir = appDir, segments: string[] = []): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) {
      if (entry.name.startsWith("_")) return [];
      return routesFromAppDir(path.join(dir, entry.name), [
        ...segments,
        entry.name,
      ]);
    }
    return ROUTE_FILE.test(entry.name) ? [toUrlPath(segments)] : [];
  });
}

function routesFromBuild(): string[] {
  const manifest: Record<string, string> = JSON.parse(
    fs.readFileSync(appPathsManifest, "utf8"),
  );
  return Object.keys(manifest).map((entry) =>
    toUrlPath(entry.split("/").filter(Boolean).slice(0, -1)),
  );
}

// CI は Build のあとに jest を走らせるので next build の結果も確かめる。
// ローカルでビルド成果物が無いときは app ディレクトリだけで判定する。
type RouteSource = [name: string, listRoutes: () => string[]];
const routeSources: RouteSource[] = [
  ["app ディレクトリ", () => routesFromAppDir()],
];
if (fs.existsSync(appPathsManifest)) {
  routeSources.push(["next build の app-paths-manifest", routesFromBuild]);
}

describe.each(routeSources)("%s から見たルート一覧", (_source, listRoutes) => {
  const routes = new Set(listRoutes());

  it("通常のページは含まれる", () => {
    expect(routes).toContain("/");
    expect(routes).toContain("/missions/[id]");
  });

  it("意図的にエラーを起こす /test-error は本番ルートに無い", () => {
    expect(routes).not.toContain("/test-error");
  });
});
