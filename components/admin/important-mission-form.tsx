"use client";

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  createMission,
  getAllMissions,
  setImportantMission,
} from "@/lib/actions/admin/important-missions";
import { ARTIFACT_TYPES } from "@/lib/artifactTypes";
import {
  type CreateImportantMissionFormData,
  type SelectImportantMissionFormData,
  createImportantMissionFormSchema,
  selectImportantMissionFormSchema,
} from "@/lib/validation/important-mission";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

interface Mission {
  id: string;
  title: string;
  is_hidden: boolean;
}

// slug自動生成ヘルパー関数
function generateSlugFromTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, "") // 特殊文字を削除
    .replace(/\s+/g, "-") // スペースをハイフンに変換
    .replace(/-+/g, "-") // 連続するハイフンを1つに
    .replace(/^-|-$/g, ""); // 先頭と末尾のハイフンを削除
}

export function ImportantMissionForm() {
  const [mode, setMode] = useState<"select" | "create">("select");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [isLoadingMissions, setIsLoadingMissions] = useState(true);

  const selectForm = useForm<SelectImportantMissionFormData>({
    resolver: zodResolver(selectImportantMissionFormSchema),
    defaultValues: {
      missionId: "",
      isImportant: true,
      displayStartDate: null,
      displayEndDate: null,
    },
  });

  const createForm = useForm<CreateImportantMissionFormData>({
    resolver: zodResolver(createImportantMissionFormSchema),
    defaultValues: {
      title: "",
      slug: "",
      content: null,
      difficulty: 1,
      required_artifact_type: "NONE",
      icon_url: null,
      event_date: null,
      max_achievement_count: null,
      artifact_label: null,
      ogp_image_url: null,
      is_hidden: false,
      is_featured: false,
      is_important: true,
      important_display_start_date: null,
      important_display_end_date: null,
    },
  });

  const isImportant = selectForm.watch("isImportant");
  const isImportantCreate = createForm.watch("is_important");
  const title = createForm.watch("title");

  // タイトルからslugを自動生成
  useEffect(() => {
    if (mode === "create" && title) {
      const autoSlug = generateSlugFromTitle(title);
      if (
        !createForm.getValues("slug") ||
        createForm.getValues("slug") === ""
      ) {
        createForm.setValue("slug", autoSlug);
      }
    }
  }, [title, mode, createForm]);

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

  async function onSubmitSelect(values: SelectImportantMissionFormData) {
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
            ? "共有グッジョブを設定しました"
            : "共有グッジョブを解除しました",
        );
        selectForm.reset();
        // ミッション一覧を再取得
        const missionsResult = await getAllMissions();
        if (missionsResult.success && missionsResult.data) {
          setMissions(missionsResult.data);
        }
      } else {
        toast.error("設定に失敗しました", {
          description: result.error,
        });
      }
    } catch (error) {
      console.error("共有グッジョブ設定エラー:", error);
      toast.error("予期しないエラーが発生しました");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onSubmitCreate(values: CreateImportantMissionFormData) {
    setIsSubmitting(true);
    try {
      const result = await createMission({
        title: values.title,
        slug: values.slug,
        content: values.content || null,
        difficulty: values.difficulty,
        required_artifact_type: values.required_artifact_type,
        icon_url: values.icon_url || null,
        event_date: values.event_date || null,
        max_achievement_count: values.max_achievement_count || null,
        artifact_label: values.artifact_label || null,
        ogp_image_url: values.ogp_image_url || null,
        is_hidden: values.is_hidden || false,
        is_featured: values.is_featured || false,
        is_important: values.is_important || false,
        important_display_start_date:
          values.important_display_start_date || null,
        important_display_end_date: values.important_display_end_date || null,
      });

      if (result.success) {
        toast.success("グッジョブを作成しました");
        createForm.reset();
        // ミッション一覧を再取得
        const missionsResult = await getAllMissions();
        if (missionsResult.success && missionsResult.data) {
          setMissions(missionsResult.data);
        }
        // 選択モードに切り替え
        setMode("select");
      } else {
        toast.error("作成に失敗しました", {
          description: result.error,
        });
      }
    } catch (error) {
      console.error("グッジョブ作成エラー:", error);
      toast.error("予期しないエラーが発生しました");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Tabs value={mode} onValueChange={(v) => setMode(v as "select" | "create")}>
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="select">既存のグッジョブを選択</TabsTrigger>
        <TabsTrigger value="create">新規グッジョブを作成</TabsTrigger>
      </TabsList>

      <TabsContent value="select">
        <Form {...selectForm}>
          <form
            onSubmit={selectForm.handleSubmit(onSubmitSelect)}
            className="space-y-6"
          >
            <FormField
              control={selectForm.control}
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
                    共有グッジョブとして設定するグッジョブを選択してください
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={selectForm.control}
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
                    <FormLabel>共有グッジョブとして設定</FormLabel>
                    <FormDescription>
                      チェックを外すと共有グッジョブを解除します
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />

            {isImportant && (
              <>
                <FormField
                  control={selectForm.control}
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
                  control={selectForm.control}
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
      </TabsContent>

      <TabsContent value="create">
        <Form {...createForm}>
          <form
            onSubmit={createForm.handleSubmit(onSubmitCreate)}
            className="space-y-6"
          >
            <FormField
              control={createForm.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>タイトル *</FormLabel>
                  <FormControl>
                    <input
                      type="text"
                      {...field}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      placeholder="グッジョブのタイトル"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={createForm.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>スラッグ *</FormLabel>
                  <FormControl>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        {...field}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        placeholder="例: new-mission-slug"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          const autoSlug = generateSlugFromTitle(
                            createForm.getValues("title") || "",
                          );
                          createForm.setValue("slug", autoSlug);
                        }}
                        disabled={!createForm.getValues("title")}
                      >
                        自動生成
                      </Button>
                    </div>
                  </FormControl>
                  <FormDescription>
                    英数字、ハイフン、アンダースコアのみ使用できます
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={createForm.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>説明文</FormLabel>
                  <FormControl>
                    <textarea
                      {...field}
                      value={field.value || ""}
                      rows={5}
                      className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      placeholder="グッジョブの説明文（Markdown対応）"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={createForm.control}
                name="difficulty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>難易度 *</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(Number(v))}
                      value={String(field.value)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {[1, 2, 3, 4, 5].map((d) => (
                          <SelectItem key={d} value={String(d)}>
                            {d}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={createForm.control}
                name="required_artifact_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>成果物の種類 *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.values(ARTIFACT_TYPES).map((type) => (
                          <SelectItem key={type.key} value={type.key}>
                            {type.displayName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={createForm.control}
              name="icon_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>アイコンURL</FormLabel>
                  <FormControl>
                    <input
                      type="url"
                      {...field}
                      value={field.value || ""}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      placeholder="https://example.com/icon.png"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={createForm.control}
              name="event_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>イベント日</FormLabel>
                  <FormControl>
                    <input
                      type="date"
                      {...field}
                      value={field.value || ""}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={createForm.control}
              name="max_achievement_count"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>最大達成回数</FormLabel>
                  <FormControl>
                    <input
                      type="number"
                      {...field}
                      value={field.value || ""}
                      onChange={(e) => {
                        const value = e.target.value
                          ? Number(e.target.value)
                          : null;
                        field.onChange(value);
                      }}
                      min={1}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      placeholder="空欄の場合は無制限"
                    />
                  </FormControl>
                  <FormDescription>空欄の場合は無制限です</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={createForm.control}
              name="artifact_label"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>成果物ラベル</FormLabel>
                  <FormControl>
                    <input
                      type="text"
                      {...field}
                      value={field.value || ""}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      placeholder="成果物の入力欄のラベル"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={createForm.control}
              name="ogp_image_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>OGP画像URL</FormLabel>
                  <FormControl>
                    <input
                      type="url"
                      {...field}
                      value={field.value || ""}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      placeholder="https://example.com/ogp.png"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-4">
              <FormField
                control={createForm.control}
                name="is_hidden"
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
                      <FormLabel>非表示</FormLabel>
                      <FormDescription>
                        チェックすると非表示になります
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={createForm.control}
                name="is_featured"
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
                      <FormLabel>おすすめ</FormLabel>
                      <FormDescription>
                        チェックするとおすすめとして表示されます
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={createForm.control}
                name="is_important"
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
                      <FormLabel>共有グッジョブとして設定</FormLabel>
                      <FormDescription>
                        チェックすると共有グッジョブとして設定されます
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
            </div>

            {isImportantCreate && (
              <>
                <FormField
                  control={createForm.control}
                  name="important_display_start_date"
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
                  control={createForm.control}
                  name="important_display_end_date"
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
              {isSubmitting ? "作成中..." : "作成"}
            </Button>
          </form>
        </Form>
      </TabsContent>
    </Tabs>
  );
}
