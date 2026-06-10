export interface CreateUserMissionInput {
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
}

export interface SaveDraftUserMissionInput {
  draftId?: string; // 既存の下書きID（更新時）
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
}

export interface UpdateApprovedUserMissionInput {
  title: string;
  content: string;
}

export type SaveDraftUserMissionResult =
  | { success: true; missionId: string }
  | { success: false; error: string };
