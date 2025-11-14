"use client";

import { createUserMissionAction } from "@/app/(protected)/user-missions/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
  praisedUserIds: z
    .array(z.string())
    .min(1, "賞賛に値するメンバーを少なくとも1人選択してください"),
  mvvItems: z
    .object({
      passionateExecution: z.boolean(),
      supremeRelationships: z.boolean(),
      happinessCirculation: z.boolean(),
    })
    .refine(
      (data) =>
        data.passionateExecution ||
        data.supremeRelationships ||
        data.happinessCirculation,
      { message: "MVV項目を少なくとも1つ選択してください" },
    ),
});

type FormData = z.infer<typeof formSchema>;

interface User {
  id: string;
  name: string;
  x_username?: string;
}

export function CreateMissionForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const supabase = createClient();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      content: "",
      praisedUserIds: [],
      mvvItems: {
        passionateExecution: false,
        supremeRelationships: false,
        happinessCirculation: false,
      },
    },
  });

  // 利用可能なユーザーを取得
  useEffect(() => {
    async function fetchUsers() {
      const { data, error } = await supabase
        .from("private_users")
        .select("id, name, x_username")
        .order("name");

      if (data && !error) {
        setAvailableUsers(data);
      }
    }
    fetchUsers();
  }, [supabase]);

  // 検索クエリに基づいてユーザーをフィルタリング
  const filteredUsers = availableUsers.filter((user) => {
    const query = searchQuery.toLowerCase();
    const nameMatch = user.name.toLowerCase().includes(query);
    const xUsernameMatch = user.x_username
      ? user.x_username.toLowerCase().includes(query)
      : false;
    return nameMatch || xUsernameMatch;
  });

  // ユーザーを選択/選択解除
  const toggleUser = (userId: string) => {
    setSelectedUsers((prev) => {
      const newSelection = prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId];
      form.setValue("praisedUserIds", newSelection);
      return newSelection;
    });
  };

  async function onSubmit(values: FormData) {
    setIsSubmitting(true);
    try {
      const result = await createUserMissionAction({
        title: values.title,
        content: values.content,
        praisedUserIds: values.praisedUserIds,
        mvvItems: values.mvvItems,
      });

      toast.success("グッジョブを作成しました", {
        description: "すぐにユーザーグッジョブ一覧に表示されます。",
      });

      router.push("/user-missions/my");
    } catch (error: unknown) {
      console.error("グッジョブ作成エラー詳細:", {
        error: error,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
      });

      // エラーメッセージを適切に表示
      const errorMessage =
        error instanceof Error ? error.message : "不明なエラーが発生しました";

      if (errorMessage.includes("ログイン") || errorMessage.includes("認証")) {
        toast.error("ログインが必要です", {
          description: "ログインしてから再度お試しください。",
          action: {
            label: "ログイン",
            onClick: () => router.push("/sign-in"),
          },
        });
      } else {
        toast.error("グッジョブの作成に失敗しました", {
          description: errorMessage,
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  }

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
                <Input
                  placeholder="例: お客様の笑顔を生み出した素晴らしい対応"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                グッジョブのタイトルを入力してください
              </FormDescription>
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
                <Textarea
                  placeholder="具体的にどのような行動や成果が賞賛に値するのか詳しく説明してください"
                  rows={6}
                  {...field}
                />
              </FormControl>
              <FormDescription>
                グッジョブの詳細な内容を入力してください
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="praisedUserIds"
          render={({ field }) => (
            <FormItem>
              <FormLabel>賞賛に値するメンバー（複数選択可）</FormLabel>
              <FormDescription>
                このグッジョブで賞賛したいメンバーを選択してください
              </FormDescription>
              <div className="space-y-2">
                {/* 選択済みメンバー */}
                {selectedUsers.length > 0 && (
                  <div className="flex flex-wrap gap-2 p-3 border rounded-md bg-muted/50">
                    {selectedUsers.map((userId) => {
                      const user = availableUsers.find((u) => u.id === userId);
                      return user ? (
                        <div
                          key={userId}
                          className="flex items-center gap-1 px-3 py-1 bg-primary/10 rounded-full"
                        >
                          <span className="text-sm">{user.name}</span>
                          <button
                            type="button"
                            onClick={() => toggleUser(userId)}
                            className="hover:bg-primary/20 rounded-full p-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : null;
                    })}
                  </div>
                )}
                {/* 検索フィールド */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="メンバーを検索..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-9"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 hover:bg-muted rounded-full p-0.5"
                    >
                      <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                  )}
                </div>
                {/* 件数表示 */}
                {searchQuery && (
                  <div className="text-sm text-muted-foreground px-1">
                    {filteredUsers.length}件中{filteredUsers.length}件表示（全
                    {availableUsers.length}件）
                  </div>
                )}
                {/* 選択可能なメンバー */}
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded-md p-3">
                  {filteredUsers.length > 0 ? (
                    filteredUsers.map((user) => (
                      <label
                        key={user.id}
                        htmlFor={`user-checkbox-${user.id}`}
                        className="flex items-center space-x-2 cursor-pointer hover:bg-muted/50 p-2 rounded"
                      >
                        <Checkbox
                          id={`user-checkbox-${user.id}`}
                          checked={selectedUsers.includes(user.id)}
                          onCheckedChange={() => toggleUser(user.id)}
                        />
                        <span className="text-sm">{user.name}</span>
                      </label>
                    ))
                  ) : (
                    <div className="col-span-2 text-center py-4 text-muted-foreground text-sm">
                      該当するメンバーが見つかりません
                    </div>
                  )}
                </div>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-4">
          <FormLabel>MVV項目（該当するものを選択）</FormLabel>

          <FormField
            control={form.control}
            name="mvvItems.passionateExecution"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel className="font-normal">
                    夢中になってやりきる
                  </FormLabel>
                  <FormDescription>
                    情熱を持って最後まで取り組んだ行動
                  </FormDescription>
                </div>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="mvvItems.supremeRelationships"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel className="font-normal">至高な人間関係</FormLabel>
                  <FormDescription>
                    素晴らしい人間関係を築いた行動
                  </FormDescription>
                </div>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="mvvItems.happinessCirculation"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel className="font-normal">幸せの循環</FormLabel>
                  <FormDescription>幸せを広げ、循環させた行動</FormDescription>
                </div>
              </FormItem>
            )}
          />

          {form.formState.errors.mvvItems && (
            <p className="text-sm font-medium text-destructive">
              {form.formState.errors.mvvItems.message}
            </p>
          )}
        </div>

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "作成中..." : "グッジョブを作成"}
        </Button>
      </form>
    </Form>
  );
}
