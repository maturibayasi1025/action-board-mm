import { getUserLevel } from "@/lib/services/userLevel";
import { getProfile } from "@/lib/services/users";
import { MapPin } from "lucide-react";
import Link from "next/link";
import { LevelProgress } from "./level-progress";
import UserAvatar from "./user-avatar";
import { UserTopBadge } from "./user-badges/user-top-badge";

interface LevelsProps {
  userId: string;
  hideProgress?: boolean;
  clickable?: boolean;
  showBadge?: boolean;
}

export default async function Levels({
  userId,
  hideProgress = false,
  clickable = false,
  showBadge = false,
}: LevelsProps) {
  const profile = await getProfile(userId);

  if (!profile) {
    throw new Error("Private user data not found");
  }

  const userLevel = await getUserLevel(userId);

  const cardContent = (
    <div
      className={`flex w-full min-w-0 max-w-full flex-col items-stretch overflow-hidden bg-white rounded-md p-4 sm:p-6 ${clickable ? "hover:bg-gray-50 transition-colors max-w-xl" : "max-w-md"}`}
    >
      <div className="flex min-w-0 items-start gap-3 sm:items-center sm:gap-4">
        <UserAvatar userProfile={profile} size="lg" />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="break-words text-lg font-bold leading-snug">
            {profile.name}
          </div>
          <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <div className="flex shrink-0 items-baseline">
              <div className="text-sm font-bold">LV.</div>
              <div className="text-xxl font-bold ml-1 leading-none">
                {userLevel ? userLevel.level : "1"}
              </div>
            </div>
            <div className="flex min-w-0 items-center">
              <MapPin className="mr-0.5 h-4 w-4 shrink-0" />
              <span className="min-w-0 break-words">
                {profile.address_prefecture}
              </span>
            </div>
          </div>
        </div>
      </div>
      {showBadge && (
        <div className="mt-3">
          <UserTopBadge userId={userId} />
        </div>
      )}
      {!hideProgress && (
        <div className="mt-4 flex flex-col items-start">
          <LevelProgress userLevel={userLevel} />
        </div>
      )}
    </div>
  );

  if (clickable) {
    return (
      <section className="bg-gradient-hero flex w-full min-w-0 max-w-full justify-center overflow-x-hidden py-6 px-4">
        <Link
          href={`/users/${userId}`}
          aria-label={`${profile.name}さんのプロフィールへ`}
          className="w-full min-w-0 max-w-xl"
        >
          {cardContent}
        </Link>
      </section>
    );
  }

  return (
    <section className="bg-gradient-hero flex w-full min-w-0 max-w-full justify-center overflow-x-hidden py-6 px-4">
      {cardContent}
    </section>
  );
}
