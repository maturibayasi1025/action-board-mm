export type OfficeClosingFloorCheck = {
  name: string;
  checked: boolean;
};

export type OfficeClosingSlackPayload = {
  reporterName: string;
  leftAtLabel: string;
  floors: OfficeClosingFloorCheck[];
  note?: string | null;
};

function floorLine(floor: OfficeClosingFloorCheck): string {
  const mark = floor.checked ? ":white_check_mark:" : ":x:";
  return `• ${floor.name} ${mark}`;
}

export function buildOfficeClosingSlackMessage(
  data: OfficeClosingSlackPayload,
): { text: string; blocks: unknown[] } {
  const floorLines =
    data.floors.length > 0
      ? data.floors.map(floorLine).join("\n")
      : "（対象階なし）";
  const noteText = data.note?.trim() ? data.note.trim() : "なし";

  const text = `:door: 最終退室チェック（退室時間 ${data.leftAtLabel}）`;

  const blocks: unknown[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: ":door: *最終退室チェックが完了しました*",
      },
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*報告者:*\n${data.reporterName}`,
        },
        {
          type: "mrkdwn",
          text: `*退室時間:*\n${data.leftAtLabel}`,
        },
      ],
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*各階の最終チェック:*\n${floorLines}`,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*備考:*\n${noteText}`,
      },
    },
  ];

  return { text, blocks };
}
