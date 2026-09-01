"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type SearchUserResult,
  awardMvvBadgeAction,
  getCurrentQuarterAction,
  getMvvBadgesByQuarterAction,
  getUserMvvBadgesAction,
  removeMvvBadgeAction,
  searchUsers,
  updateMvvBadgeImageAction,
  uploadMvvBadgeImageAction,
} from "@/lib/actions/admin/mvv-badges";
import { createClient } from "@/lib/supabase/client";
import { getAvailableQuarters, getBadgeTitle } from "@/lib/types/badge";
import type { UserBadge } from "@/lib/types/badge";
import Image from "next/image";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const MVV_BADGE_TYPES = [
  {
    value: "MVV_PASSIONATE_EXECUTION",
    label: "夢中になってやり切る",
  },
  {
    value: "MVV_SUPREME_RELATIONSHIPS",
    label: "至高な人間関係",
  },
  {
    value: "MVV_HAPPINESS_CIRCULATION",
    label: "幸せの循環",
  },
  {
    value: "MVV_START_DASH",
    label: "スタートダッシュ",
  },
] as const;

export function MvvBadgeForm() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUserResult[]>([]);
  const [selectedUser, setSelectedUser] = useState<SearchUserResult | null>(
    null,
  );
  const [selectedQuarter, setSelectedQuarter] = useState<string>("");
  const [userBadges, setUserBadges] = useState<UserBadge[]>([]);
  const [quarterBadges, setQuarterBadges] = useState<UserBadge[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAwarding, setIsAwarding] = useState(false);
  const [isLoadingBadges, setIsLoadingBadges] = useState(false);
  // バッジタイプごとの画像パスを管理
  const [badgeImages, setBadgeImages] = useState<
    Record<
      string,
      { badgeImagePath: string | null; iconImagePath: string | null }
    >
  >({});
  const [uploadingImages, setUploadingImages] = useState<
    Record<string, { badge: boolean; icon: boolean }>
  >({});

  // 現在の四半期を取得
  useEffect(() => {
    async function loadCurrentQuarter() {
      const result = await getCurrentQuarterAction();
      if (result.success) {
        setSelectedQuarter(result.data);
      }
    }
    loadCurrentQuarter();
  }, []);

  // 四半期が変更されたらバッジ一覧を更新
  useEffect(() => {
    if (selectedQuarter) {
      loadQuarterBadges();
    }
  }, [selectedQuarter]);

  // ユーザーが選択されたらバッジ一覧を更新
  useEffect(() => {
    if (selectedUser) {
      loadUserBadges();
    } else {
      setUserBadges([]);
      setBadgeImages({});
    }
  }, [selectedUser]);

  // バッジ一覧が更新されたら、既存の画像パスを設定
  useEffect(() => {
    if (userBadges.length > 0 && selectedQuarter) {
      const images: Record<
        string,
        { badgeImagePath: string | null; iconImagePath: string | null }
      > = {};
      for (const badge of userBadges) {
        if (badge.quarter_period === selectedQuarter) {
          images[badge.badge_type] = {
            badgeImagePath: badge.badge_image_path || null,
            iconImagePath: badge.icon_image_path || null,
          };
        }
      }
      setBadgeImages(images);
    }
  }, [userBadges, selectedQuarter]);

  async function handleSearch() {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const result = await searchUsers(searchQuery.trim());
      if (result.success) {
        setSearchResults(result.data);
        if (result.data.length === 0) {
          toast.info("該当するユーザーが見つかりませんでした");
        }
      } else {
        toast.error(result.error || "ユーザー検索に失敗しました");
      }
    } catch (error) {
      console.error("Search error:", error);
      toast.error("ユーザー検索中にエラーが発生しました");
    } finally {
      setIsSearching(false);
    }
  }

  async function loadUserBadges() {
    if (!selectedUser) return;

    setIsLoadingBadges(true);
    try {
      const result = await getUserMvvBadgesAction(selectedUser.id);
      if (result.success) {
        setUserBadges(result.data);
      } else {
        toast.error(result.error || "バッジの取得に失敗しました");
      }
    } catch (error) {
      console.error("Load badges error:", error);
      toast.error("バッジの取得中にエラーが発生しました");
    } finally {
      setIsLoadingBadges(false);
    }
  }

  async function loadQuarterBadges() {
    if (!selectedQuarter) return;

    setIsLoadingBadges(true);
    try {
      const result = await getMvvBadgesByQuarterAction(selectedQuarter);
      if (result.success) {
        setQuarterBadges(result.data);
      } else {
        toast.error(result.error || "バッジの取得に失敗しました");
      }
    } catch (error) {
      console.error("Load quarter badges error:", error);
      toast.error("バッジの取得中にエラーが発生しました");
    } finally {
      setIsLoadingBadges(false);
    }
  }

  async function handleImageUpload(
    badgeType: string,
    imageType: "badge" | "icon",
    file: File,
  ) {
    if (!selectedQuarter) {
      toast.error("四半期を選択してください");
      return;
    }

    const key = `${badgeType}_${imageType}`;
    setUploadingImages((prev) => ({
      ...prev,
      [badgeType]: { ...prev[badgeType], [imageType]: true },
    }));

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("quarterPeriod", selectedQuarter);
      formData.append("badgeType", badgeType);
      formData.append("imageType", imageType);

      const result = await uploadMvvBadgeImageAction(formData);

      if (result.success) {
        setBadgeImages((prev) => ({
          ...prev,
          [badgeType]: {
            ...prev[badgeType],
            [`${imageType}ImagePath`]: result.data.path,
          },
        }));
        toast.success("画像をアップロードしました");

        // 既存のバッジがある場合はDBを更新
        if (selectedUser && selectedQuarter) {
          const existingBadge = userBadges.find(
            (badge) =>
              badge.badge_type === badgeType &&
              badge.quarter_period === selectedQuarter,
          );

          if (existingBadge) {
            const updateResult = await updateMvvBadgeImageAction({
              userId: selectedUser.id,
              badgeType: badgeType as
                | "MVV_PASSIONATE_EXECUTION"
                | "MVV_SUPREME_RELATIONSHIPS"
                | "MVV_HAPPINESS_CIRCULATION"
                | "MVV_START_DASH",
              quarterPeriod: selectedQuarter,
              imageType,
              imagePath: result.data.path,
            });

            if (updateResult.success) {
              // バッジ一覧を更新
              await loadUserBadges();
            } else {
              toast.error(
                updateResult.error || "DBへの画像パス保存に失敗しました",
              );
            }
          }
        }
      } else {
        toast.error(result.error || "画像のアップロードに失敗しました");
      }
    } catch (error) {
      console.error("Image upload error:", error);
      toast.error("画像のアップロード中にエラーが発生しました");
    } finally {
      setUploadingImages((prev) => ({
        ...prev,
        [badgeType]: { ...prev[badgeType], [imageType]: false },
      }));
    }
  }

  function getImageUrl(path: string | null): string | null {
    if (!path) return null;
    const supabase = createClient();
    const { data } = supabase.storage
      .from("mvv_badge_images")
      .getPublicUrl(path);
    return data.publicUrl;
  }

  async function handleAwardBadge(
    badgeType:
      | "MVV_PASSIONATE_EXECUTION"
      | "MVV_SUPREME_RELATIONSHIPS"
      | "MVV_HAPPINESS_CIRCULATION"
      | "MVV_START_DASH",
  ) {
    if (!selectedUser) {
      toast.error("ユーザーを選択してください");
      return;
    }

    if (!selectedQuarter) {
      toast.error("四半期を選択してください");
      return;
    }

    setIsAwarding(true);
    try {
      const images = badgeImages[badgeType] || {
        badgeImagePath: null,
        iconImagePath: null,
      };

      const result = await awardMvvBadgeAction({
        userId: selectedUser.id,
        badgeType,
        quarterPeriod: selectedQuarter,
        badgeImagePath: images.badgeImagePath,
        iconImagePath: images.iconImagePath,
      });

      if (result.success) {
        toast.success("バッジを付与しました");
        // バッジ一覧を更新
        await loadUserBadges();
        await loadQuarterBadges();
      } else {
        toast.error(result.error || "バッジの付与に失敗しました");
      }
    } catch (error) {
      console.error("Award badge error:", error);
      toast.error("バッジの付与中にエラーが発生しました");
    } finally {
      setIsAwarding(false);
    }
  }

  async function handleRemoveBadge(badgeId: string) {
    if (!confirm("このバッジを削除しますか？")) {
      return;
    }

    try {
      const result = await removeMvvBadgeAction(badgeId);

      if (result.success) {
        toast.success("バッジを削除しました");
        // バッジ一覧を更新
        await loadUserBadges();
        await loadQuarterBadges();
      } else {
        toast.error(result.error || "バッジの削除に失敗しました");
      }
    } catch (error) {
      console.error("Remove badge error:", error);
      toast.error("バッジの削除中にエラーが発生しました");
    }
  }

  const availableQuarters = getAvailableQuarters();

  return (
    <div className="space-y-6">
      {/* 四半期セレクター */}
      <div className="space-y-2">
        <label htmlFor="quarter-select" className="text-sm font-medium">
          四半期を選択
        </label>
        <Select value={selectedQuarter} onValueChange={setSelectedQuarter}>
          <SelectTrigger id="quarter-select" className="w-full max-w-xs">
            <SelectValue placeholder="四半期を選択" />
          </SelectTrigger>
          <SelectContent>
            {availableQuarters.map((quarter) => (
              <SelectItem key={quarter} value={quarter}>
                {quarter}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ユーザー検索 */}
      <div className="space-y-2">
        <label htmlFor="user-search" className="text-sm font-medium">
          ユーザーを検索
        </label>
        <div className="flex gap-2">
          <Input
            id="user-search"
            type="text"
            placeholder="ユーザー名またはメールアドレス"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSearch();
              }
            }}
            className="flex-1"
          />
          <Button onClick={handleSearch} disabled={isSearching}>
            {isSearching ? "検索中..." : "検索"}
          </Button>
        </div>

        {/* 検索結果 */}
        {searchResults.length > 0 && (
          <div className="border rounded-md p-2 space-y-1 max-h-48 overflow-y-auto">
            {searchResults.map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => {
                  setSelectedUser(user);
                  setSearchQuery("");
                  setSearchResults([]);
                }}
                className={`w-full text-left px-3 py-2 rounded hover:bg-gray-100 ${
                  selectedUser?.id === user.id ? "bg-blue-100" : ""
                }`}
              >
                <div className="font-medium">
                  {user.name}
                  {user.isSuspended ? (
                    <span className="ml-2 text-xs text-destructive">
                      停止中
                    </span>
                  ) : null}
                </div>
                {user.email && (
                  <div className="text-sm text-gray-500">{user.email}</div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 選択されたユーザー情報 */}
      {selectedUser && (
        <div className="border rounded-md p-4 bg-gray-50">
          <div className="font-medium">選択中のユーザー</div>
          <div className="text-sm text-gray-600">
            {selectedUser.name}
            {selectedUser.isSuspended ? "（停止中）" : ""}
          </div>
          {selectedUser.email && (
            <div className="text-sm text-gray-500">{selectedUser.email}</div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedUser(null)}
            className="mt-2"
          >
            選択を解除
          </Button>
        </div>
      )}

      {/* バッジ付与ボタン */}
      {selectedUser && selectedQuarter && (
        <div className="space-y-4">
          <div className="text-sm font-medium">バッジを付与</div>
          <div className="space-y-4">
            {MVV_BADGE_TYPES.map((badgeType) => {
              const hasBadge = userBadges.some(
                (badge) =>
                  badge.badge_type === badgeType.value &&
                  badge.quarter_period === selectedQuarter,
              );
              const images = badgeImages[badgeType.value] || {
                badgeImagePath: null,
                iconImagePath: null,
              };
              const badgeImageUrl = getImageUrl(images.badgeImagePath);
              const iconImageUrl = getImageUrl(images.iconImagePath);
              const isUploadingBadge =
                uploadingImages[badgeType.value]?.badge || false;
              const isUploadingIcon =
                uploadingImages[badgeType.value]?.icon || false;

              return (
                <div
                  key={badgeType.value}
                  className="border rounded-md p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{badgeType.label}</span>
                    <Button
                      onClick={() => handleAwardBadge(badgeType.value)}
                      disabled={isAwarding || hasBadge}
                      variant={hasBadge ? "outline" : "default"}
                      size="sm"
                    >
                      {hasBadge ? "✓ " : ""}
                      {hasBadge ? "付与済み" : "付与"}
                    </Button>
                  </div>

                  {/* バッジ画像アップロード */}
                  <div className="space-y-2">
                    <label
                      htmlFor={`badge-image-${badgeType.value}`}
                      className="text-xs text-gray-600"
                    >
                      バッジ画像（任意）
                    </label>
                    <div className="flex items-center gap-2">
                      <Input
                        id={`badge-image-${badgeType.value}`}
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleImageUpload(badgeType.value, "badge", file);
                          }
                        }}
                        disabled={isUploadingBadge}
                        className="text-xs"
                      />
                      {badgeImageUrl && (
                        <div className="relative w-16 h-16">
                          <Image
                            src={badgeImageUrl}
                            alt="バッジ画像プレビュー"
                            fill
                            className="object-contain rounded"
                          />
                        </div>
                      )}
                      {isUploadingBadge && (
                        <span className="text-xs text-gray-500">
                          アップロード中...
                        </span>
                      )}
                    </div>
                  </div>

                  {/* アイコン画像アップロード */}
                  <div className="space-y-2">
                    <label
                      htmlFor={`icon-image-${badgeType.value}`}
                      className="text-xs text-gray-600"
                    >
                      アイコン画像（任意）
                    </label>
                    <div className="flex items-center gap-2">
                      <Input
                        id={`icon-image-${badgeType.value}`}
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleImageUpload(badgeType.value, "icon", file);
                          }
                        }}
                        disabled={isUploadingIcon}
                        className="text-xs"
                      />
                      {iconImageUrl && (
                        <div className="relative w-12 h-12">
                          <Image
                            src={iconImageUrl}
                            alt="アイコン画像プレビュー"
                            fill
                            className="object-contain rounded-full bg-emerald-100"
                          />
                        </div>
                      )}
                      {isUploadingIcon && (
                        <span className="text-xs text-gray-500">
                          アップロード中...
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ユーザーのバッジ一覧 */}
      {selectedUser && (
        <div className="space-y-2">
          <div className="text-sm font-medium">
            {selectedUser.name}さんのバッジ一覧
          </div>
          {isLoadingBadges ? (
            <div className="text-sm text-gray-500">読み込み中...</div>
          ) : userBadges.length === 0 ? (
            <div className="text-sm text-gray-500">バッジはありません</div>
          ) : (
            <div className="border rounded-md divide-y">
              {userBadges.map((badge) => (
                <div
                  key={badge.id}
                  className="p-3 flex items-center justify-between"
                >
                  <div>
                    <div className="font-medium">{getBadgeTitle(badge)}</div>
                    <div className="text-sm text-gray-500">
                      {new Date(badge.achieved_at).toLocaleDateString("ja-JP")}
                    </div>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleRemoveBadge(badge.id)}
                  >
                    削除
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 四半期ごとのバッジ一覧 */}
      {selectedQuarter && (
        <div className="space-y-2">
          <div className="text-sm font-medium">
            {selectedQuarter}のバッジ一覧
          </div>
          {isLoadingBadges ? (
            <div className="text-sm text-gray-500">読み込み中...</div>
          ) : quarterBadges.length === 0 ? (
            <div className="text-sm text-gray-500">
              この四半期のバッジはありません
            </div>
          ) : (
            <div className="border rounded-md divide-y max-h-96 overflow-y-auto">
              {quarterBadges.map((badge) => (
                <div key={badge.id} className="p-3">
                  <div className="font-medium">{getBadgeTitle(badge)}</div>
                  <div className="text-sm text-gray-500">
                    ユーザーID: {badge.user_id.slice(0, 8)}...
                  </div>
                  <div className="text-sm text-gray-500">
                    {new Date(badge.achieved_at).toLocaleDateString("ja-JP")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
