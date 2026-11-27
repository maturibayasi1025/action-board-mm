import fs from "node:fs";
import path from "node:path";
import { getSurveys } from "@/app/(protected)/admin/enps-surveys/actions";
import AdminError from "@/app/(protected)/admin/error";
import { createServiceClient } from "@/lib/supabase/server";
import { fireEvent, render, screen } from "@testing-library/react";
import { ErrorBoundary } from "next/dist/client/components/error-boundary";
import { createFakePostgrest } from "../survey/fake-postgrest";

const refresh = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));
jest.mock("@/lib/logger", () => ({
  __esModule: true,
  default: { log: jest.fn() },
}));
jest.mock("@/lib/supabase/server", () => ({
  createServiceClient: jest.fn(),
}));
jest.mock("@/lib/utils/isOwner", () => ({
  requireOwner: jest.fn(),
}));
jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}));

const ADMIN_DIR = path.join(process.cwd(), "app", "(protected)", "admin");

function GlobalErrorStandIn() {
  return <p>global-error に落ちた</p>;
}

describe("admin の取得失敗は admin の中だけで止まる", () => {
  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    refresh.mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("集計の取得失敗を admin の error.tsx が受け止め、詳細を出さずに再試行できる", async () => {
    jest.mocked(createServiceClient).mockResolvedValue(
      createFakePostgrest(
        {
          enps_surveys: [
            {
              id: "survey-enps",
              title: "2026年10月 eNPS",
              created_at: "2026-10-01T00:00:00Z",
            },
          ],
          enps_responses: [],
        },
        { failingTables: ["enps_responses"] },
      ) as Awaited<ReturnType<typeof createServiceClient>>,
    );
    const failure = await getSurveys().then(
      () => null,
      (error: Error) => error,
    );
    if (!failure) throw new Error("取得失敗が例外になっていない");
    failure.stack = "Error: 秘密のスタック\n    at secret-file.ts:1:1";

    let failing = true;
    function AdminPage() {
      if (failing) throw failure;
      return <p>admin の一覧</p>;
    }

    render(
      <ErrorBoundary errorComponent={GlobalErrorStandIn}>
        <p>ヘッダー</p>
        <ErrorBoundary errorComponent={AdminError}>
          <AdminPage />
        </ErrorBoundary>
      </ErrorBoundary>,
    );

    expect(screen.getByText("データの取得に失敗しました")).toBeTruthy();
    expect(screen.getByText("ヘッダー")).toBeTruthy();
    expect(screen.queryByText("global-error に落ちた")).toBeNull();
    const body = document.body.textContent ?? "";
    expect(body).not.toContain(failure.message);
    expect(body).not.toContain("秘密のスタック");
    expect(body).not.toContain("connection error");

    failing = false;
    fireEvent.click(screen.getByRole("button", { name: "再試行" }));

    expect(await screen.findByText("admin の一覧")).toBeTruthy();
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("データの取得に失敗しました")).toBeNull();
  });

  it("admin の全ページが error.tsx の配下にあり、同じ階層に layout がない", () => {
    expect(fs.existsSync(path.join(ADMIN_DIR, "error.tsx"))).toBe(true);
    // 同じ階層の layout で投げた例外は、その階層の error.tsx では受け止められない
    expect(fs.existsSync(path.join(ADMIN_DIR, "layout.tsx"))).toBe(false);

    const pages = fs
      .readdirSync(ADMIN_DIR, { recursive: true, encoding: "utf8" })
      .filter((file) => path.basename(file) === "page.tsx");
    expect(pages.length).toBeGreaterThan(0);
  });
});
