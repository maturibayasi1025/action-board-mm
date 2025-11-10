"use client";

import {
  getAllMissions,
  setImportantMission,
} from "@/app/(protected)/admin/important-missions/actions";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

const formSchema = z
  .object({
    missionId: z.string().min(1, "グッジョブを選択してください"),
    isImportant: z.boolean(),
    displayStartDate: z.string().optional().nullable(),
    displayEndDate: z.string().optional().nullable(),
  })
  .refine(
    (data) => {
      // 重要グッジョブとして設定する場合のみ日時のバリデーション
      if (!data.isImportant) {
        return true;
      }
      // 両方の日時が設定されている場合、開始日 < 終了日をチェック
      if (data.displayStartDate && data.displayEndDate) {
        return new Date(data.displayStartDate) <= new Date(data.displayEndDate);
      }
      return true;
    },
    {
      message: "表示開始日時は表示終了日時より前である必要があります",
      path: ["displayEndDate"],
    },
  );

type FormData = z.infer<typeof formSchema>;

interface Mission {
  id: string;
  title: string;
  is_hidden: boolean;
}

export function ImportantMissionForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [isLoadingMissions, setIsLoadingMissions] = useState(true);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      missionId: "",
      isImportant: true,
      displayStartDate: null,
      displayEndDate: null,
    },
  });

  const isImportant = form.watch("isImportant");

  // ミッション一覧を取得
  useEffect(() => {
    async function fetchMissions() {
      setIsLoadingMissions(true);
      const result = await getAllMissions();
      if (result.success && result.data) {
        setMissions(result.data);
      } else {
        toast.error("ミッションの取得に失敗しました", {
          description: result.error,
        });
      }
      setIsLoadingMissions(false);
    }
    fetchMissions();
  }, []);

  async function onSubmit(values: FormData) {
    setIsSubmitting(true);
    try {
      const result = await setImportantMission({
        missionId: values.missionId,
        isImportant: values.isImportant,
        displayStartDate: values.displayStartDate || null,
        displayEndDate: values.displayEndDate || null,
      });

      if (result.success) {
        toast.success(
          values.isImportant
            ? "重要グッジョブを設定しました"
            : "重要グッジョブを解除しました",
        );
        form.reset();
      } else {
        toast.error("設定に失敗しました", {
          description: result.error,
        });
      }
    } catch (error) {
      console.error("重要グッジョブ設定エラー:", error);
      toast.error("予期しないエラーが発生しました");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="missionId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>グッジョブ</FormLabel>
              <Select
                onValueChange={field.onChange}
                value={field.value}
                disabled={isLoadingMissions}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="グッジョブを選択してください" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {missions.map((mission) => (
                    <SelectItem key={mission.id} value={mission.id}>
                      {mission.title}
                      {mission.is_hidden && " (非表示)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                重要グッジョブとして設定するグッジョブを選択してください
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="isImportant"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
              <FormControl>
                <input
                  type="checkbox"
                  checked={field.value}
                  onChange={field.onChange}
                  className="mt-1"
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>重要グッジョブとして設定</FormLabel>
                <FormDescription>
                  チェックを外すと重要グッジョブを解除します
                </FormDescription>
              </div>
            </FormItem>
          )}
        />

        {isImportant && (
          <>
            <FormField
              control={form.control}
              name="displayStartDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>表示開始日時（オプション）</FormLabel>
                  <FormControl>
                    <input
                      type="datetime-local"
                      value={
                        field.value
                          ? new Date(field.value).toISOString().slice(0, 16)
                          : ""
                      }
                      onChange={(e) => {
                        const value = e.target.value
                          ? new Date(e.target.value).toISOString()
                          : null;
                        field.onChange(value);
                      }}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </FormControl>
                  <FormDescription>
                    設定しない場合は常に表示されます
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="displayEndDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>表示終了日時（オプション）</FormLabel>
                  <FormControl>
                    <input
                      type="datetime-local"
                      value={
                        field.value
                          ? new Date(field.value).toISOString().slice(0, 16)
                          : ""
                      }
                      onChange={(e) => {
                        const value = e.target.value
                          ? new Date(e.target.value).toISOString()
                          : null;
                        field.onChange(value);
                      }}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </FormControl>
                  <FormDescription>
                    設定しない場合は常に表示されます
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "設定中..." : "設定"}
        </Button>
      </form>
    </Form>
  );
}
