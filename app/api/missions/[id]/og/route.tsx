// Edge Runtime互換のため、画像をbase64エンコードして埋め込み
import { getMissionPageData } from "@/app/missions/[id]/_lib/data";
import { sanitizeImageUrl } from "@/lib/metadata";
import { Noto_Sans_JP } from "next/font/google";
import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const runtime = "edge";

// キャッシュ用Mapを定義（メモリキャッシュ）- completeタイプのみキャッシュ
const MAX_CACHE_SIZE = 100;
const cache = new Map<string, ArrayBuffer>();

const size = {
  width: 1200,
  height: 630,
};

async function loadGoogleFont(font: string, text: string) {
  try {
    const url = `https://fonts.googleapis.com/css2?family=${font}:wght@700&text=${encodeURIComponent(text)}`;
    const css = await (await fetch(url)).text();
    const resource = css.match(
      /src:\s*url\(([^)]+)\)\s*format\('(opentype|truetype|woff2)'\)/,
    );

    if (resource) {
      const response = await fetch(resource[1]);
      if (response.status === 200) {
        return await response.arrayBuffer();
      }
    }
    throw new Error("Font resource not found");
  } catch (error) {
    console.error("Font loading failed:", error);
    // フォールバック: システムフォントを使用
    return null;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (typeof id !== "string") {
    return new Response("Invalid mission ID", { status: 400 });
  }

  if (request.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  const pageData = await getMissionPageData(id);
  if (!pageData) {
    return new Response("Mission not found", { status: 404 });
  }

  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get("type");

  if (type === "complete") {
    const key = [id, pageData.mission.slug ?? ""].join("|");

    if (cache.has(key)) {
      const buf = cache.get(key);
      if (buf) {
        return new Response(buf, {
          headers: {
            "Content-Type": "image/png",
            "Cache-Control": "public, max-age=3600, s-maxage=86400",
          },
        });
      }
    }
  }

  // Edge Runtime互換のため、シンプルなテキストベースのOG画像を生成
  const backgroundColor = type === "complete" ? "#10b981" : "#3b82f6";

  // titleに()や（）が含まれる場合は(や（の手前で改行する
  const title = pageData.mission.title;
  const titleWithLineBreak = title.replace(/（/g, "\n（").replace(/\(/g, "\n(");

  const fontData = await loadGoogleFont(
    "Noto+Sans+JP",
    `${pageData.mission.title} #テクノロジーで誰も取り残さない日本へ ${pageData.totalAchievementCount}件のアクションが達成されました！`,
  );

  let imageResponse: ImageResponse;
  if (type === "complete") {
    imageResponse = new ImageResponse(
      <div
        style={{
          fontFamily: "Noto Sans JP",
          width: "100%",
          height: "100%",
          padding: "40px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-end",
          backgroundColor: backgroundColor,
        }}
      >
        <div
          style={{
            width: "90%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "80px",
          }}
        >
          <div
            style={{
              fontSize: 36,
              color: "black",
              fontWeight: "700",
              marginBottom: "8px",
              whiteSpace: "pre-wrap",
              textAlign: "center",
            }}
          >
            {`「${pageData.mission.title}」\nを達成しました！`}
          </div>
        </div>
      </div>,
      {
        ...size,
        fonts: fontData
          ? [
              {
                name: "Noto Sans JP",
                data: fontData,
                weight: 700,
                style: "normal",
              },
            ]
          : [],
      },
    );
  } else {
    imageResponse = new ImageResponse(
      <div
        style={{
          fontFamily: "Noto Sans JP",
          width: "100%",
          height: "100%",
          padding: "40px",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          justifyContent: "center",
          backgroundColor: backgroundColor,
        }}
      >
        <div
          style={{
            width: "62%",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              fontSize: 40,
              color: "black",
              fontWeight: "700",
              marginBottom: "8px",
              whiteSpace: "pre-wrap",
            }}
          >
            {titleWithLineBreak}
          </div>
          <div
            style={{
              fontFamily: "Noto Sans JP",
              fontSize: 28,
              color: "black",
              fontWeight: "700",
              marginBottom: "24px",
            }}
          >
            #テクノロジーで誰も取り残さない日本へ
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "flex-start",
              alignItems: "baseline",
            }}
          >
            <div
              style={{
                fontFamily: "Noto Sans JP",
                fontSize: "58px",
                color: "#0d9488",
                textAlign: "center",
                lineHeight: "1",
              }}
            >
              {pageData.totalAchievementCount.toLocaleString()}
            </div>
            <div
              style={{
                marginLeft: "8px",
                fontFamily: "Noto Sans JP",
                fontSize: "24px",
                color: "#0d9488",
                textAlign: "center",
              }}
            >
              件のアクションが達成されました！
            </div>
          </div>
        </div>
      </div>,
      {
        ...size,
        fonts: fontData
          ? [
              {
                name: "Noto Sans JP",
                data: fontData,
                weight: 700,
                style: "normal",
              },
            ]
          : [],
      },
    );
  }

  // ImageResponseからArrayBufferを取得
  const buf = await imageResponse.arrayBuffer();

  if (type === "complete") {
    const key = [id, pageData.mission.slug ?? ""].join("|");

    // キャッシュサイズ制限（FIFO方式）
    if (cache.size >= MAX_CACHE_SIZE) {
      const firstKey = cache.keys().next().value;
      if (typeof firstKey === "string") {
        cache.delete(firstKey);
      }
    }

    cache.set(key, buf);
  }

  return new Response(buf, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
