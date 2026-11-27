import { MissionListLoadError } from "@/components/mission/MissionListLoadError";
import type { Meta, StoryObj } from "@storybook/react";

const meta = {
  title: "MissionListLoadError",
  component: MissionListLoadError,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof MissionListLoadError>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
