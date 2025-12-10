import type { UserLikesRanking } from "@/lib/services/likesRanking";
import BaseCurrentUserCard from "./base-current-user-card";

interface CurrentUserCardLikesProps {
  currentUser: UserLikesRanking | null;
}

export const CurrentUserCardLikes: React.FC<CurrentUserCardLikesProps> = ({
  currentUser,
}) => {
  if (!currentUser || !currentUser.user_id) {
    return null;
  }

  const displayUser = {
    ...currentUser,
    likes_count: currentUser.likes_count || 0,
  };

  const userForCard = {
    user_id: currentUser.user_id,
    name: currentUser.name,
    address_prefecture: currentUser.address_prefecture,
    rank: currentUser.rank,
  };

  return (
    <BaseCurrentUserCard currentUser={userForCard}>
      <div className="flex items-center gap-2 mb-1">
        <div className="text-lg font-bold">
          👍 {displayUser.likes_count.toLocaleString()}いいね
        </div>
      </div>
    </BaseCurrentUserCard>
  );
};
