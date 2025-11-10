import Missions, { type MissionsProps } from "./missions";

//コードの2重管理回避のためmissions.tsxを参照する
export default function ImportantMissions(
  props: Omit<MissionsProps, "filterImportant">,
) {
  return (
    <Missions
      {...props}
      filterImportant={true}
      title="⭐ 重要グッジョブ"
      id="important-missions"
    />
  );
}
