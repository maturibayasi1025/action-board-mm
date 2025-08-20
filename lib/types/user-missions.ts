// ユーザーミッション関連の型定義

export interface PraisedUser {
  praised_user_id: string;
  private_users: {
    name: string;
  } | null;
}

export interface MvvItem {
  mvv_type: string;
}

export interface Like {
  user_id: string;
}

// Supabaseクエリ結果の型定義
export interface UserMissionWithRelations {
  id: string;
  created_by: string;
  title: string;
  content: string;
  status: string;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
  approved_by: string | null;
  public_mission_id: string | null;
  likes_count: number;
  user_mission_mvv_items: MvvItem[] | null;
  user_mission_likes: Like[] | null;
  user_mission_praised_users: PraisedUser[] | null;
}
