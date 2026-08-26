import { formatRemainingNames } from "./remaining";

export type OfficeClosingFloorCheck = {
  name: string;
  checked: boolean;
};

export type OfficePresenceKind = "checkin" | "midday" | "final";

export type OfficeClosingSlackPayload = {
  kind: OfficePresenceKind;
  reporterName: string;
  atLabel: string;
  remainingNames: string[];
  floors?: OfficeClosingFloorCheck[];
  note?: string | null;
};

function floorLine(floor: OfficeClosingFloorCheck): string {
  const mark = floor.checked ? ":white_check_mark:" : ":x:";
  return `• ${floor.name} ${mark}`;
}

function headingForKind(kind: OfficePresenceKind): {
  emoji: string;
  title: string;
  timeLabel: string;
} {
  switch (kind) {
    case "checkin":
      return {
        emoji: ":office:",
        title: "入室しました",
        timeLabel: "入室時間",
      };
    case "midday":
      return {
        emoji: ":walking:",
        title: "途中退室しました",
        timeLabel: "退室時間",
      };
    case "final":
      return {
        emoji: ":door:",
        title: "最終退室チェックが完了しました",
        timeLabel: "退室時間",
      };
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}

export function buildOfficeClosingSlackMessage(
  data: OfficeClosingSlackPayload,
): { text: string; blocks: unknown[] } {
  const heading = headingForKind(data.kind);
  const noteText = data.note?.trim() ? data.note.trim() : "なし";
  const remainingText = formatRemainingNames(data.remainingNames);

  const text = `${heading.emoji} ${heading.title}（${heading.timeLabel} ${data.atLabel}） 在室: ${remainingText}`;

  const blocks: unknown[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${heading.emoji} *${heading.title}*`,
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
          text: `*${heading.timeLabel}:*\n${data.atLabel}`,
        },
      ],
    },
  ];

  if (data.kind === "final") {
    const floorLines =
      data.floors && data.floors.length > 0
        ? data.floors.map(floorLine).join("\n")
        : "（対象階なし）";
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*各階の最終チェック:*\n${floorLines}`,
      },
    });
  }

  if (data.kind !== "checkin") {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*備考:*\n${noteText}`,
      },
    });
  }

  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: `*現在の在室:*\n${remainingText}`,
    },
  });

  return { text, blocks };
}
