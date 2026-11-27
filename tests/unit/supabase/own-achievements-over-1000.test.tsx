import { achieveMissionAction } from "@/app/missions/[id]/_actions/achieve";
import { MissionWithSubmissionHistory } from "@/app/missions/[id]/_components/MissionWithSubmissionHistory";
import { getMissionPageData } from "@/app/missions/[id]/_lib/data";
import type { SubmissionData } from "@/app/missions/[id]/_lib/types";
import { UserMissionAchievements } from "@/components/user-mission-achievements";
import { getUserRepeatableMissionAchievements } from "@/lib/services/userMissionAchievement";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/types/supabase";
import type { User } from "@supabase/supabase-js";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createFakePostgrest, pad } from "../survey/fake-postgrest";

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
  createServiceClient: jest.fn(),
}));
jest.mock("@/lib/supabase/client", () => ({ createClient: jest.fn() }));
jest.mock("nanoid", () => ({ nanoid: () => "ref00001" }));
jest.mock("@/lib/services/user-status", () => ({
  assertUserActive: jest.fn(),
}));
jest.mock("@/components/mission/MissionGuidanceArrow", () => ({
  MissionGuidanceArrow: () => null,
}));
jest.mock("@/app/missions/[id]/_components/MissionFormWrapper", () => ({
  MissionFormWrapper: ({
    userAchievementCount,
    onSubmissionSuccess,
  }: {
    userAchievementCount: number;
    onSubmissionSuccess: () => void;
  }) => (
    <div>
      <span data-testid="form-count">{userAchievementCount}</span>
      <button type="button" onClick={onSubmissionSuccess}>
        投稿完了
      </button>
    </div>
  ),
}));
jest.mock("@/app/missions/[id]/_components/SubmissionHistoryWrapper", () => ({
  SubmissionHistoryWrapper: ({
    submissions,
  }: {
    submissions: SubmissionData[];
  }) => (
    <ol data-testid="history">
      {submissions.map((s) => (
        <li key={s.id} data-id={s.id} />
      ))}
    </ol>
  ),
}));

const USER_ID = "user-0001";
const OTHER_USER_ID = "user-0002";
const MISSION_ID = "mission-0001";
const OTHER_MISSION_ID = "mission-0002";
const OWN = 1200;
const SAME_INSTANT = "2026-11-01T00:00:00.000Z";
const LIMIT_ERROR = "あなたはこのグッジョブの達成回数の上限に達しています。";

const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const achievementId = (n: number) => `achievement-${pad(n)}`;
const ownIdsNewestFirst = range(OWN).map(achievementId).reverse();

function buildTables({ maxAchievementCount = 1500 } = {}) {
  const achievements = [
    ...range(OWN).map((n) => ({
      id: achievementId(n),
      user_id: USER_ID,
      mission_id: MISSION_ID,
      created_at: SAME_INSTANT,
    })),
    ...range(50).map((n) => ({
      id: `other-mission-${pad(n)}`,
      user_id: USER_ID,
      mission_id: OTHER_MISSION_ID,
      created_at: SAME_INSTANT,
    })),
    ...range(50).map((n) => ({
      id: `other-user-${pad(n)}`,
      user_id: OTHER_USER_ID,
      mission_id: MISSION_ID,
      created_at: SAME_INSTANT,
    })),
  ];
  return {
    missions: [
      {
        id: MISSION_ID,
        title: "繰り返すグッジョブ",
        max_achievement_count: maxAchievementCount,
        is_important: false,
        required_artifact_type: "TEXT",
      },
    ],
    mission_achievement_count_view: [
      { mission_id: MISSION_ID, achievement_count: OWN + 50 },
    ],
    mission_main_links: [],
    user_referral: [{ user_id: USER_ID, referral_code: "ref00001" }],
    achievements,
    mission_artifacts: achievements.map((a, n) => ({
      id: `artifact-${pad(n)}`,
      achievement_id: a.id,
      user_id: a.user_id,
      artifact_type: n % 5 === 0 ? "IMAGE_WITH_GEOLOCATION" : "TEXT",
      image_storage_path: n % 5 === 0 ? `path/${pad(n)}.jpg` : null,
      text_content: `提出${n}`,
      created_at: SAME_INSTANT,
    })),
    mission_artifact_geolocations: achievements
      .map((_, n) => n)
      .filter((n) => n % 5 === 0)
      .map((n) => ({
        id: n,
        mission_artifact_id: `artifact-${pad(n)}`,
        lat: 35,
        lon: 139,
      })),
  };
}

function useServerTables(
  tables: Record<string, Record<string, unknown>[]>,
  options?: Parameters<typeof createFakePostgrest>[1],
) {
  jest
    .mocked(createClient)
    .mockResolvedValue(
      createFakePostgrest(tables, { authUserId: USER_ID, ...options }),
    );
}

beforeEach(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("グッジョブ詳細の提出履歴（初期表示）", () => {
  it("本人の 1 グッジョブに 1200 件あっても、新しい順に欠けなく成果物つきで返す", async () => {
    useServerTables(buildTables());
    const page = await getMissionPageData(MISSION_ID, USER_ID);
    const history = page?.submissionHistory;

    expect(history?.map((s) => s.id)).toEqual(ownIdsNewestFirst);
    for (const submission of history ?? []) {
      expect(submission.artifacts).toHaveLength(1);
      expect(submission.artifacts[0].achievement_id).toBe(submission.id);
    }
    const withImage = (history ?? [])
      .flatMap((s) => s.artifacts)
      .filter((a) => a.artifact_type === "IMAGE_WITH_GEOLOCATION");
    expect(withImage).toHaveLength(OWN / 5);
    for (const artifact of withImage) {
      expect(artifact.image_storage_path).toMatch(/^signed:path\//);
      expect(artifact.geolocations).toHaveLength(1);
    }
  });

  it.each(["achievements", "mission_artifacts"])(
    "%s の取得に失敗したら、0 件ではなく取得失敗として返し、グッジョブ自体は返す",
    async (table) => {
      useServerTables(buildTables(), { failingTables: [table] });
      const page = await getMissionPageData(MISSION_ID, USER_ID);
      expect(page?.mission.id).toBe(MISSION_ID);
      expect(page?.submissionHistory).toBeNull();
    },
  );
});

describe("グッジョブ詳細の提出履歴（投稿後の取り直し）", () => {
  const mission = buildTables().missions[0] as unknown as Tables<"missions">;
  const authUser = { id: USER_ID } as User;

  async function renderHistory(initialSubmissions: SubmissionData[] | null) {
    useServerTables(buildTables());
    render(
      <MissionWithSubmissionHistory
        mission={mission}
        authUser={authUser}
        referralCode={null}
        initialSubmissions={initialSubmissions}
        missionId={MISSION_ID}
        mainLink={null}
      />,
    );
  }

  const historyIds = () =>
    Array.from(
      screen.getByTestId("history").querySelectorAll<HTMLElement>("li"),
    ).map((li) => li.dataset.id);

  const initial = async () => {
    const page = await getMissionPageData(MISSION_ID, USER_ID);
    return (page?.submissionHistory ?? []).slice(1);
  };

  it("取り直したあと、1200 件すべてが新しい順に並び、達成回数も 1200 になる", async () => {
    await renderHistory(await initial());

    jest
      .mocked(createBrowserClient)
      .mockReturnValue(createFakePostgrest(buildTables()));
    fireEvent.click(screen.getByText("投稿完了"));

    await waitFor(() =>
      expect(screen.getByTestId("form-count")).toHaveTextContent(String(OWN)),
    );
    expect(historyIds()).toEqual(ownIdsNewestFirst);
  });

  it("取り直しに失敗したら、表示中の履歴を残したまま、その場に失敗を出す", async () => {
    const shown = await initial();
    await renderHistory(shown);

    jest.mocked(createBrowserClient).mockReturnValue(
      createFakePostgrest(buildTables(), {
        failingTables: ["achievements"],
      }),
    );
    fireEvent.click(screen.getByText("投稿完了"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "提出履歴の更新に失敗しました",
    );
    expect(historyIds()).toEqual(shown.map((s) => s.id));
    expect(screen.getByTestId("form-count")).toHaveTextContent(String(OWN - 1));
  });

  it("初期表示で取得に失敗していたら、0 件の履歴やフォームを出さず、その場に失敗を出す", async () => {
    await renderHistory(null);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "提出履歴の取得に失敗しました",
    );
    expect(screen.queryByTestId("form-count")).not.toBeInTheDocument();
    expect(screen.queryByTestId("history")).not.toBeInTheDocument();
  });
});

describe("グッジョブ達成の上限判定", () => {
  function submit() {
    const formData = new FormData();
    formData.set("missionId", MISSION_ID);
    formData.set("requiredArtifactType", "TEXT");
    formData.set("artifactText", "提出");
    return achieveMissionAction(formData).catch((error: unknown) => ({
      success: false,
      error: String(error),
    }));
  }

  it("上限 1100 回に対して本人が 1200 回達成済みなら、上限エラーにする", async () => {
    useServerTables(buildTables({ maxAchievementCount: 1100 }));
    expect(await submit()).toEqual({ success: false, error: LIMIT_ERROR });
  });

  it("上限 1201 回に対して本人が 1200 回なら、上限エラーにしない", async () => {
    useServerTables(buildTables({ maxAchievementCount: OWN + 1 }));
    const result = await submit();
    expect(result.error).not.toBe(LIMIT_ERROR);
  });

  it("達成回数の取得に失敗したら、上限未満とみなさずエラーにする", async () => {
    useServerTables(buildTables({ maxAchievementCount: OWN + 1 }), {
      failingTables: ["achievements"],
    });
    expect(await submit()).toEqual({
      success: false,
      error: "ユーザーの達成回数の取得に失敗しました。",
    });
  });
});

describe("ユーザーページの繰り返しグッジョブの達成状況", () => {
  const repeatable = (id: string, title: string) => ({
    id,
    title,
    max_achievement_count: null,
  });

  function achievementsTable() {
    return {
      achievements: [
        ...range(OWN).map((n) => ({
          id: achievementId(n),
          user_id: USER_ID,
          mission_id: "mission-a",
          missions: repeatable("mission-a", "繰り返しA"),
        })),
        ...range(300).map((n) => ({
          id: `b-${pad(n)}`,
          user_id: USER_ID,
          mission_id: "mission-b",
          missions: repeatable("mission-b", "繰り返しB"),
        })),
        ...range(100).map((n) => ({
          id: `c-${pad(n)}`,
          user_id: USER_ID,
          mission_id: "mission-c",
          missions: {
            id: "mission-c",
            title: "上限あり",
            max_achievement_count: 5,
          },
        })),
        ...range(100).map((n) => ({
          id: `d-${pad(n)}`,
          user_id: OTHER_USER_ID,
          mission_id: "mission-a",
          missions: repeatable("mission-a", "繰り返しA"),
        })),
      ],
    };
  }

  it("本人の 1 グッジョブに 1200 件あっても、回数を欠けなく数える", async () => {
    useServerTables(achievementsTable());
    const summary = await getUserRepeatableMissionAchievements(USER_ID);
    expect(
      [...summary].sort((a, b) => a.mission_id.localeCompare(b.mission_id)),
    ).toEqual([
      {
        mission_id: "mission-a",
        mission_title: "繰り返しA",
        achievement_count: OWN,
      },
      {
        mission_id: "mission-b",
        mission_title: "繰り返しB",
        achievement_count: 300,
      },
    ]);
  });

  it("取得に失敗したら、空の一覧ではなく例外にする", async () => {
    useServerTables(achievementsTable(), { failingTables: ["achievements"] });
    await expect(getUserRepeatableMissionAchievements(USER_ID)).rejects.toThrow(
      "connection error",
    );
  });

  it("達成状況のカードは、取得に失敗したことをその場に出し、総数は出したままにする", () => {
    render(<UserMissionAchievements achievements={null} totalCount={OWN} />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "グッジョブ達成状況の取得に失敗しました",
    );
    expect(screen.getByText("グッジョブ達成状況")).toBeInTheDocument();
  });
});
