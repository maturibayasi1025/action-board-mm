"use client";

import { submitOfficeClosingCheckAction } from "@/app/(protected)/office-check/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatJstHm } from "@/lib/office-check/left-at";
import { useRouter } from "next/navigation";
import { type FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";

export type OfficeFloorOption = {
  id: string;
  name: string;
};

type LeaveKind = "midday" | "final";

type Props = {
  floors: OfficeFloorOption[];
};

export function OfficeClosingForm({ floors }: Props) {
  const router = useRouter();
  const defaultTime = useMemo(() => formatJstHm(new Date()), []);
  const [leaveKind, setLeaveKind] = useState<LeaveKind>("midday");
  const [leftAtTime, setLeftAtTime] = useState(defaultTime);
  const [checkedFloorIds, setCheckedFloorIds] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function toggleFloor(floorId: string, checked: boolean) {
    setCheckedFloorIds((current) => {
      if (checked) {
        return current.includes(floorId) ? current : [...current, floorId];
      }
      return current.filter((id) => id !== floorId);
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const result = await submitOfficeClosingCheckAction({
        leaveKind,
        leftAtTime,
        checkedFloorIds: leaveKind === "final" ? checkedFloorIds : [],
        note,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(
        leaveKind === "final"
          ? "最終チェックを送信し、Slackへ通知しました"
          : "途中退室をSlackへ通知しました",
      );
      setCheckedFloorIds([]);
      setNote("");
      setLeftAtTime(formatJstHm(new Date()));
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("退室の送信に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">退室の種類</legend>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={leaveKind === "midday" ? "default" : "outline"}
            onClick={() => setLeaveKind("midday")}
          >
            途中退室
          </Button>
          <Button
            type="button"
            variant={leaveKind === "final" ? "default" : "outline"}
            onClick={() => setLeaveKind("final")}
          >
            最終退室
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          {leaveKind === "final"
            ? "最後に退室する人が、各階チェックを入れて送信します。"
            : "先に帰るときは途中退室を送ると、Slackに在室者が残ります。"}
        </p>
      </fieldset>

      {leaveKind === "final" ? (
        floors.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            チェック対象の階がまだ登録されていません。管理者に連絡してください。
          </p>
        ) : (
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">各階の最終チェック</legend>
            <p className="text-sm text-muted-foreground">
              消灯・空調・施錠などを確認できたら、階ごとにチェックを入れてください。
            </p>
            {floors.map((floor) => {
              const checked = checkedFloorIds.includes(floor.id);
              const checkboxId = `floor-${floor.id}`;
              return (
                <div key={floor.id} className="flex items-center gap-3">
                  <Checkbox
                    id={checkboxId}
                    checked={checked}
                    onCheckedChange={(value) =>
                      toggleFloor(floor.id, value === true)
                    }
                  />
                  <Label
                    htmlFor={checkboxId}
                    className="cursor-pointer text-base"
                  >
                    {floor.name} 最終チェック
                  </Label>
                </div>
              );
            })}
          </fieldset>
        )
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="left-at-time">退室時間</Label>
        <Input
          id="left-at-time"
          type="time"
          required
          value={leftAtTime}
          onChange={(event) => setLeftAtTime(event.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="closing-note">備考（任意）</Label>
        <Textarea
          id="closing-note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={500}
          rows={3}
          placeholder="気になった点があれば記入してください"
        />
      </div>

      <Button
        type="submit"
        disabled={submitting || (leaveKind === "final" && floors.length === 0)}
        className="w-full sm:w-auto"
      >
        {submitting
          ? "送信中..."
          : leaveKind === "final"
            ? "最終チェックを送信"
            : "途中退室を通知"}
      </Button>
    </form>
  );
}
