"use client";

import type { UserMission } from "@/lib/types/user-missions";
import { MyMissionsListClient } from "./my-missions-list-client";
import { PraisedMissionsListClient } from "./praised-missions-list-client";
import { UserMissionsList as AllUserMissionsList } from "./user-missions-list";

export type UserMissionFilterMode = "all" | "my" | "praised";

export function UserMissionList({
  missions,
  filterMode = "all",
}: {
  missions: UserMission[];
  filterMode?: UserMissionFilterMode;
}) {
  switch (filterMode) {
    case "my":
      return <MyMissionsListClient missions={missions} />;
    case "praised":
      return <PraisedMissionsListClient missions={missions} />;
    default:
      return <AllUserMissionsList missions={missions} />;
  }
}
