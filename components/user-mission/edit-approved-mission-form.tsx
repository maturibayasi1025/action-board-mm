"use client";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { updateUserMissionAction } from "@/lib/actions/user-missions";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

const formSchema = z.object({
  title: z
    .string()
    .min(1, "タイトルは必須です")
    .max(100, "タイトルは100文字以内で入力してください"),
  content: z
    .string()
    .min(1, "内容は必須です")
    .max(1000, "内容は1000文字以内で入力してください"),
});

type FormData = z.infer<typeof formSchema>;

interface EditApprovedMissionFormProps {
  missionId: string;
  initialData: {
    title: string;
    content: string;
  };
}

export function EditApprovedMissionForm({
  missionId,
  initialData,
}: EditApprovedMissionFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: initialData.title,
      content: initialData.content,
    },
  });

  const onSubmit = async (values: FormData) => {
    setIsSubmitting(true);
    try {
      await updateUserMissionAction(missionId, {
        title: values.title,
        content: values.content,
      });
      toast.success("グッジョブを更新しました");
      router.push(`/user-missions/${missionId}`);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "グッジョブの更新に失敗しました",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>タイトル</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="content"
          render={({ field }) => (
            <FormItem>
              <FormLabel>内容</FormLabel>
              <FormControl>
                <Textarea rows={8} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-2">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "更新中..." : "更新する"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(`/user-missions/${missionId}`)}
            disabled={isSubmitting}
          >
            キャンセル
          </Button>
        </div>
      </form>
    </Form>
  );
}
