"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type ImageUploaderProps = {
  authUser: User | null;
  disabled: boolean;
  onImagePathsChange: (paths: string[]) => void;
  initialPaths?: string[];
  allowedMimeTypes?: readonly string[];
  maxFileSizeMB?: number;
  maxImages?: number;
};

export function UserMissionImageUploader({
  authUser,
  disabled,
  onImagePathsChange,
  initialPaths = [],
  allowedMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"],
  maxFileSizeMB = 10,
  maxImages = 3,
}: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [imagePaths, setImagePaths] = useState<string[]>(
    Array.isArray(initialPaths)
      ? initialPaths.filter(
          (path): path is string => typeof path === "string" && path.length > 0,
        )
      : [],
  );
  const [previewUrls, setPreviewUrls] = useState<Map<string, string>>(
    new Map(),
  );
  const supabaseBrowserClient = createClient();

  // 有効な配列を親コンポーネントに渡すヘルパー関数
  const notifyImagePathsChange = useCallback(
    (paths: string[]) => {
      const validPaths = Array.isArray(paths)
        ? paths.filter(
            (path): path is string =>
              typeof path === "string" && path.length > 0,
          )
        : [];
      onImagePathsChange(validPaths);
    },
    [onImagePathsChange],
  );

  // 画像URLを取得してプレビュー用に保存
  const loadPreviewUrl = useCallback(
    async (path: string) => {
      if (previewUrls.has(path)) return;

      const { data } = supabaseBrowserClient.storage
        .from("user_mission_images")
        .getPublicUrl(path);

      if (data?.publicUrl) {
        setPreviewUrls((prev) => new Map(prev).set(path, data.publicUrl));
      }
    },
    [previewUrls, supabaseBrowserClient.storage],
  );

  // 初期画像のプレビューURLを読み込む
  useEffect(() => {
    for (const path of initialPaths) {
      loadPreviewUrl(path);
    }
  }, [initialPaths, loadPreviewUrl]);

  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    if (
      !event.target.files ||
      event.target.files.length === 0 ||
      !authUser?.id
    ) {
      setUploadError(
        "ファイルが選択されていないか、ユーザー情報がありません。",
      );
      return;
    }

    const file = event.target.files[0];

    // ファイルサイズチェック
    if (file.size > maxFileSizeMB * 1024 * 1024) {
      setUploadError(
        `ファイルサイズが大きすぎます。最大${maxFileSizeMB}MBまでです。`,
      );
      return;
    }

    // MIMEタイプチェック
    if (!allowedMimeTypes.includes(file.type)) {
      setUploadError(
        `対応していないファイル形式です。許可されている形式: ${allowedMimeTypes.join(", ")}`,
      );
      return;
    }

    // 最大枚数チェック
    if (imagePaths.length >= maxImages) {
      setUploadError(`画像は最大${maxImages}枚までアップロードできます。`);
      return;
    }

    // プレビュー用URL生成
    const reader = new FileReader();
    reader.onloadend = () => {
      const previewUrl = reader.result as string;
      // 一時的なプレビューURLを保存（アップロード完了後に実際のパスに置き換え）
      const tempId = `temp_${Date.now()}`;
      setPreviewUrls((prev) => new Map(prev).set(tempId, previewUrl));
    };
    reader.readAsDataURL(file);

    // ファイル名をサニタイズ（日本語や特殊文字を安全な形式に変換）
    const fileExtension = file.name.split(".").pop() || "png";
    const sanitizedFileName = `${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 9)}.${fileExtension}`;
    const fileName = `${authUser.id}/${sanitizedFileName}`;
    setUploading(true);
    setUploadError(null);

    const { data, error } = await supabaseBrowserClient.storage
      .from("user_mission_images")
      .upload(fileName, file);

    setUploading(false);
    if (error) {
      console.error("Upload error:", error);
      setUploadError(`アップロードに失敗しました: ${error.message}`);
      // エラー時も現在のimagePathsを確実に親に通知
      notifyImagePathsChange(imagePaths);
    } else if (data?.path) {
      const newPaths = [...imagePaths, data.path].filter(
        (path): path is string => typeof path === "string" && path.length > 0,
      );
      setImagePaths(newPaths);
      notifyImagePathsChange(newPaths);
      setUploadError(null);

      // プレビューURLを読み込む
      loadPreviewUrl(data.path);
    }

    // 入力フィールドをリセット
    event.target.value = "";
  };

  const handleRemoveImage = async (index: number) => {
    const pathToRemove = imagePaths[index];
    const newPaths = imagePaths
      .filter((_, i) => i !== index)
      .filter(
        (path): path is string => typeof path === "string" && path.length > 0,
      );
    setImagePaths(newPaths);
    notifyImagePathsChange(newPaths);

    // プレビューURLを削除
    setPreviewUrls((prev) => {
      const newMap = new Map(prev);
      newMap.delete(pathToRemove);
      return newMap;
    });

    // ストレージからも削除（エラーが発生しても続行）
    if (pathToRemove && authUser?.id) {
      try {
        await supabaseBrowserClient.storage
          .from("user_mission_images")
          .remove([pathToRemove]);
      } catch (error) {
        console.error("画像削除エラー:", error);
        // エラーが発生してもUIからは削除済みなので続行
      }
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="userMissionImages">画像（任意、最大{maxImages}枚）</Label>
      <Input
        type="file"
        id="userMissionImages"
        accept={allowedMimeTypes?.join(",")}
        disabled={disabled || uploading || imagePaths.length >= maxImages}
        onChange={handleImageUpload}
      />
      {uploading && <p className="text-xs text-blue-600">アップロード中...</p>}
      {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
      {imagePaths.length >= maxImages && (
        <p className="text-xs text-muted-foreground">
          画像は最大{maxImages}枚までアップロードできます。
        </p>
      )}
      {/* アップロード済み画像のプレビュー */}
      {imagePaths.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mt-4">
          {imagePaths.map((path, index) => {
            const previewUrl =
              previewUrls.get(path) ||
              supabaseBrowserClient.storage
                .from("user_mission_images")
                .getPublicUrl(path).data.publicUrl;

            return (
              <div key={path} className="relative group">
                <img
                  src={previewUrl}
                  alt={`プレビュー ${index + 1}`}
                  className="w-full h-24 object-cover rounded border"
                />
                {!disabled && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleRemoveImage(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        最大ファイルサイズ: {maxFileSizeMB}MB（{imagePaths.length}/{maxImages}
        枚）
      </p>
    </div>
  );
}
