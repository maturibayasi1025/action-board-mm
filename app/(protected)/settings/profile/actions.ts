"use server";

export type UpdateProfileResult = {
  success: boolean;
  error?: string;
};

export type UploadAvatarResult = {
  success: boolean;
  avatarPath?: string;
  error?: string;
};
