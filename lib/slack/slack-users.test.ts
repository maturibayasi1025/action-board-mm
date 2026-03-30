import {
  type SlackUser,
  buildPraisedMentionsLine,
  findSlackUserIdByName,
  formatPraisedNamesWithMentions,
} from "./slack-users";

describe("findSlackUserIdByName", () => {
  const users: SlackUser[] = [
    {
      id: "U111",
      name: "takahashi",
      real_name: "Takahashi Akira",
      profile: { display_name: "高橋聖" },
    },
    {
      id: "U222",
      name: "deleted_user",
      deleted: true,
      profile: { display_name: "高橋聖" },
    },
    {
      id: "B333",
      name: "botty",
      is_bot: true,
      profile: { display_name: "高橋聖" },
    },
  ];

  it("表示名に含まれるアプリ側の名前で Slack ユーザー ID を返す", () => {
    expect(findSlackUserIdByName("高橋聖", users)).toBe("U111");
  });

  it("ボット・削除済みユーザーはスキップする", () => {
    expect(findSlackUserIdByName("高橋聖", users.slice(1))).toBeNull();
  });
});

describe("formatPraisedNamesWithMentions", () => {
  const users: SlackUser[] = [
    {
      id: "UAAA",
      name: "yamada",
      profile: { display_name: "山田太郎" },
    },
  ];

  it("カンマ区切りの各名前をメンションまたはプレーンテキストに変換する", () => {
    expect(formatPraisedNamesWithMentions("山田太郎, 存在しない", users)).toBe(
      "<@UAAA>, 存在しない",
    );
  });
});

describe("buildPraisedMentionsLine", () => {
  const slackUsers: SlackUser[] = [
    {
      id: "UZZZ",
      name: "fallback",
      profile: { display_name: "フォールバック名" },
    },
  ];

  it("slack_user_id があればそれを優先し、無ければ名前解決する", () => {
    expect(
      buildPraisedMentionsLine(
        [
          { name: "無視される", slack_user_id: "U111" },
          { name: "フォールバック名", slack_user_id: null },
        ],
        ["外部"],
        slackUsers,
      ),
    ).toBe("<@U111>, <@UZZZ>, 外部");
  });
});
