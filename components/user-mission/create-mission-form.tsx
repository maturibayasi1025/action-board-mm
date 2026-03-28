"use client";

import {
  type SaveDraftUserMissionInput,
  createUserMissionAction,
  saveDraftUserMissionAction,
} from "@/app/(protected)/user-missions/actions";
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
import type { User } from "@supabase/supabase-js";
import { Save, Search, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";
import { UserMissionImageUploader } from "./image-uploader";
import { SharedMissionCompletionModal } from "./shared-mission-completion-modal";

const formSchema = z
  .object({
    title: z
      .string()
      .min(1, "タイトルは必須です")
      .max(100, "タイトルは100文字以内で入力してください"),
    content: z
      .string()
      .min(1, "内容は必須です")
      .max(1000, "内容は1000文字以内で入力してください"),
    praisedUserIds: z.array(z.string()),
    praisedExternalUserNames: z.array(z.string()),
    imagePaths: z.array(z.string()).optional(),
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
  })
  .refine(
    (data) =>
      data.praisedUserIds.length > 0 ||
      (data.praisedExternalUserNames &&
        data.praisedExternalUserNames.length > 0),
    {
      message: "賞賛に値するメンバーを少なくとも1人選択してください",
      path: ["praisedUserIds"],
    },
  );

type FormData = z.infer<typeof formSchema>;

interface UserData {
  id: string;
  name: string;
  x_username: string | null;
}

interface CreateMissionFormProps {
  draftId?: string;
  initialData?: {
    title: string;
    content: string;
    praisedUserIds: string[];
    praisedExternalUserNames?: string[];
    imagePaths?: string[];
    mvvItems: {
      passionateExecution: boolean;
      supremeRelationships: boolean;
      happinessCirculation: boolean;
    };
  };
}

export function CreateMissionForm(
  {
    draftId,
    initialData,
  }: CreateMissionFormProps = {} as CreateMissionFormProps,
) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<UserData[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [externalUserNames, setExternalUserNames] = useState<string[]>([]);
  const [externalUserNameInput, setExternalUserNameInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [draftIdState, setDraftIdState] = useState<string | undefined>(draftId);
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [imagePaths, setImagePaths] = useState<string[]>(
    initialData?.imagePaths || [],
  );
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [availableSharedMissions, setAvailableSharedMissions] = useState<
    Array<{
      id: string;
      title: string;
      icon_url: string | null;
      difficulty: number;
      content: string | null;
    }>
  >([]);
  const [isSharedMissionModalOpen, setIsSharedMissionModalOpen] =
    useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const supabase = createClient();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: initialData?.title || "",
      content: initialData?.content || "",
      praisedUserIds: initialData?.praisedUserIds || [],
      praisedExternalUserNames: initialData?.praisedExternalUserNames || [],
      imagePaths: initialData?.imagePaths || [],
      mvvItems: initialData?.mvvItems || {
        passionateExecution: false,
        supremeRelationships: false,
        happinessCirculation: false,
      },
    },
  });

  // 現在のユーザーを取得
  useEffect(() => {
    async function fetchCurrentUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setCurrentUser(user);
    }
    fetchCurrentUser();
  }, [supabase]);

  // 初期データがある場合はselectedUsersとexternalUserNamesも設定
  useEffect(() => {
    if (initialData?.praisedUserIds) {
      setSelectedUsers(initialData.praisedUserIds);
    }
    if (initialData?.praisedExternalUserNames) {
      setExternalUserNames(initialData.praisedExternalUserNames);
    }
  }, [initialData]);

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

  // 自分自身は賞賛対象に選べない
  const usersExcludingSelf = availableUsers.filter(
    (u) => !currentUser?.id || u.id !== currentUser.id,
  );

  // 検索クエリに基づいてユーザーをフィルタリング
  const filteredUsers = usersExcludingSelf.filter((user) => {
    const query = searchQuery.toLowerCase();
    const nameMatch = user.name.toLowerCase().includes(query);
    const xUsernameMatch = user.x_username
      ? user.x_username.toLowerCase().includes(query)
      : false;
    return nameMatch || xUsernameMatch;
  });

  // 下書き復元などで自分が含まれていた場合は除外
  useEffect(() => {
    if (!currentUser?.id) return;
    setSelectedUsers((prev) => {
      if (!prev.includes(currentUser.id)) return prev;
      const next = prev.filter((id) => id !== currentUser.id);
      form.setValue("praisedUserIds", next);
      return next;
    });
  }, [currentUser?.id, form.setValue]);

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

  // 外部ユーザー名を追加
  const addExternalUserName = () => {
    const trimmedName = externalUserNameInput.trim();
    if (trimmedName && !externalUserNames.includes(trimmedName)) {
      const newNames = [...externalUserNames, trimmedName];
      setExternalUserNames(newNames);
      form.setValue("praisedExternalUserNames", newNames);
      setExternalUserNameInput("");
    }
  };

  // 外部ユーザー名を削除
  const removeExternalUserName = (name: string) => {
    const newNames = externalUserNames.filter((n) => n !== name);
    setExternalUserNames(newNames);
    form.setValue("praisedExternalUserNames", newNames);
  };

  // 自動保存関数
  const autoSave = useCallback(async () => {
    const values = form.getValues();

    // タイトルと内容が両方空の場合は保存しない
    if (!values.title.trim() && !values.content.trim()) {
      return;
    }

    setSaveStatus("saving");

    try {
      const draftInput: SaveDraftUserMissionInput = {
        draftId: draftIdState,
        title: values.title,
        content: values.content,
        praisedUserIds: values.praisedUserIds,
        praisedExternalUserNames: values.praisedExternalUserNames,
        imagePaths: values.imagePaths || [],
        mvvItems: values.mvvItems,
      };

      const result = await saveDraftUserMissionAction(draftInput);

      if (result.success) {
        setDraftIdState(result.missionId);
        setSaveStatus("saved");
        // 3秒後にidleに戻す
        setTimeout(() => {
          setSaveStatus("idle");
        }, 3000);
      } else {
        setSaveStatus("error");
      }
    } catch (error) {
      console.error("自動保存エラー:", error);
      setSaveStatus("error");
    }
  }, [form, draftIdState]);

  // フォームの値を監視して自動保存（debounce）
  useEffect(() => {
    const subscription = form.watch(() => {
      // 既存のタイマーをクリア
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // 1.5秒後に自動保存
      saveTimeoutRef.current = setTimeout(() => {
        autoSave();
      }, 1500);
    });

    return () => {
      subscription.unsubscribe();
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [form, autoSave]);

  async function onSubmit(values: FormData) {
    setIsSubmitting(true);
    try {
      // 下書きがある場合は公開、ない場合は新規作成
      if (draftIdState) {
        const { publishDraftUserMissionAction } = await import(
          "@/app/(protected)/user-missions/actions"
        );
        const result = await publishDraftUserMissionAction(draftIdState);

        if (result.success) {
          toast.success("グッジョブを公開しました", {
            description: "すぐにユーザーグッジョブ一覧に表示されます。",
          });
          // 共有グッジョブが利用可能な場合、モーダルを表示（即時投稿と同様）
          if (
            result.availableSharedMissions &&
            result.availableSharedMissions.length > 0
          ) {
            setAvailableSharedMissions(result.availableSharedMissions);
            setIsSharedMissionModalOpen(true);
          } else {
            router.push("/user-missions/my");
          }
        } else {
          throw new Error("公開に失敗しました");
        }
      } else {
        // 入力値を正規化（undefined/nullを空配列に、空文字列をフィルタリング）
        const normalizedImagePaths = Array.isArray(values.imagePaths)
          ? values.imagePaths.filter(
              (path): path is string =>
                typeof path === "string" && path.length > 0,
            )
          : [];
        const normalizedPraisedUserIds = Array.isArray(values.praisedUserIds)
          ? values.praisedUserIds.filter(
              (id): id is string => typeof id === "string" && id.length > 0,
            )
          : [];
        const normalizedPraisedExternalUserNames = Array.isArray(
          values.praisedExternalUserNames,
        )
          ? values.praisedExternalUserNames.filter(
              (name): name is string =>
                typeof name === "string" && name.trim().length > 0,
            )
          : [];

        const result = await createUserMissionAction({
          title: values.title,
          content: values.content,
          praisedUserIds: normalizedPraisedUserIds,
          praisedExternalUserNames: normalizedPraisedExternalUserNames,
          imagePaths: normalizedImagePaths,
          mvvItems: values.mvvItems,
        });

        if (!result.success) {
          throw new Error("グッジョブの作成に失敗しました");
        }

        toast.success("グッジョブを作成しました", {
          description: "すぐにユーザーグッジョブ一覧に表示されます。",
        });

        // 共有グッジョブが利用可能な場合、モーダルを表示
        if (
          result.availableSharedMissions &&
          result.availableSharedMissions.length > 0
        ) {
          setAvailableSharedMissions(result.availableSharedMissions);
          setIsSharedMissionModalOpen(true);
          // モーダルを閉じた後にリダイレクト
        } else {
          router.push("/user-missions/my");
        }
      }
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

  const getSaveStatusText = () => {
    switch (saveStatus) {
      case "saving":
        return "下書き保存中...";
      case "saved":
        return "下書き保存済み";
      case "error":
        return "保存エラー";
      default:
        return "";
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* 自動保存ステータス表示 */}
        {saveStatus !== "idle" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Save className="h-4 w-4" />
            <span>{getSaveStatusText()}</span>
          </div>
        )}
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
                    {usersExcludingSelf.length}件）
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

        <FormField
          control={form.control}
          name="praisedExternalUserNames"
          render={({ field }) => (
            <FormItem>
              <FormLabel>MM経済圏ユーザーを賞賛</FormLabel>
              <FormDescription>
                登録されていないMM経済圏ユーザーも表彰できます。名前を入力して追加してください。
              </FormDescription>
              <div className="space-y-2">
                {/* 追加済み外部ユーザー */}
                {externalUserNames.length > 0 && (
                  <div className="flex flex-wrap gap-2 p-3 border rounded-md bg-muted/50">
                    {externalUserNames.map((name) => (
                      <div
                        key={name}
                        className="flex items-center gap-1 px-3 py-1 bg-secondary/10 rounded-full"
                      >
                        <span className="text-sm">{name}</span>
                        <button
                          type="button"
                          onClick={() => removeExternalUserName(name)}
                          className="hover:bg-secondary/20 rounded-full p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {/* 外部ユーザー名入力欄 */}
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="MM経済圏ユーザーの名前を入力..."
                    value={externalUserNameInput}
                    onChange={(e) => setExternalUserNameInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addExternalUserName();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addExternalUserName}
                    disabled={!externalUserNameInput.trim()}
                  >
                    追加
                  </Button>
                </div>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="imagePaths"
          render={() => (
            <FormItem>
              <FormControl>
                <UserMissionImageUploader
                  authUser={currentUser}
                  disabled={isSubmitting}
                  onImagePathsChange={(paths) => {
                    setImagePaths(paths);
                    form.setValue("imagePaths", paths);
                  }}
                  initialPaths={imagePaths}
                />
              </FormControl>
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

        <div className="flex gap-2">
          {draftIdState && (
            <Button
              type="button"
              variant="destructive"
              onClick={async () => {
                if (isDeleting) return;
                setIsDeleting(true);
                try {
                  const { deleteDraftUserMissionAction } = await import(
                    "@/app/(protected)/user-missions/actions"
                  );
                  await deleteDraftUserMissionAction(draftIdState);
                  toast.success("下書きを削除しました");
                  router.push("/user-missions/my");
                } catch (error) {
                  console.error("下書き削除エラー:", error);
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : "下書きの削除に失敗しました",
                  );
                } finally {
                  setIsDeleting(false);
                }
              }}
              disabled={isDeleting || isSubmitting}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {isDeleting ? "削除中..." : "下書きを削除"}
            </Button>
          )}
          <Button type="submit" disabled={isSubmitting || isDeleting}>
            {isSubmitting
              ? "公開中..."
              : draftIdState
                ? "グッジョブを公開"
                : "グッジョブを作成"}
          </Button>
        </div>
      </form>

      <SharedMissionCompletionModal
        isOpen={isSharedMissionModalOpen}
        onClose={() => {
          setIsSharedMissionModalOpen(false);
          router.push("/user-missions/my");
        }}
        missions={availableSharedMissions}
      />
    </Form>
  );
}
