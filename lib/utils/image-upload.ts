export const DEFAULT_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export const DEFAULT_MAX_FILE_SIZE_MB = 10;

export type ValidateImageFileOptions = {
  allowedMimeTypes?: readonly string[];
  maxFileSizeMB?: number;
};

export function sanitizeImageFileName(originalName: string): string {
  const fileExtension = originalName.split(".").pop() || "png";
  return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExtension}`;
}

export function validateImageFile(
  file: File,
  {
    allowedMimeTypes = DEFAULT_IMAGE_MIME_TYPES,
    maxFileSizeMB = DEFAULT_MAX_FILE_SIZE_MB,
  }: ValidateImageFileOptions = {},
): string | null {
  if (!allowedMimeTypes.includes(file.type)) {
    return `対応していないファイル形式です（${allowedMimeTypes.join(", ")}）`;
  }

  const maxBytes = maxFileSizeMB * 1024 * 1024;
  if (file.size > maxBytes) {
    return `ファイルサイズは${maxFileSizeMB}MB以下にしてください`;
  }

  return null;
}
