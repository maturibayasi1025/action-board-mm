import { OfficeClosingHistory } from "@/components/office-check/office-closing-history";
import type { Meta, StoryObj } from "@storybook/react";

const meta = {
  title: "OfficeCheck/History",
  component: OfficeClosingHistory,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof OfficeClosingHistory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: {
    reports: [],
  },
};

export const WithReports: Story = {
  args: {
    reports: [
      {
        id: "report-1",
        reporterName: "関口貴大",
        leftAt: "2026-08-26T13:15:00.000Z",
        leaveKind: "final",
        note: "問題なし",
        floors: [
          { name: "3F", checked: true },
          { name: "4F", checked: true },
        ],
      },
      {
        id: "report-2",
        reporterName: "島田瞳",
        leftAt: "2026-08-26T09:30:00.000Z",
        leaveKind: "midday",
        note: null,
        floors: [],
      },
    ],
  },
};
