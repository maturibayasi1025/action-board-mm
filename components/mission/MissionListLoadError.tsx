/** グッジョブ一覧の取得に失敗したとき、一覧の場所にだけ出す表示 */
export function MissionListLoadError() {
  return (
    <div role="alert" className="col-span-full text-center py-12">
      <p className="text-gray-700 text-lg">グッジョブの取得に失敗しました</p>
      <p className="text-gray-500 text-sm mt-2">
        時間をおいて、ページを再読み込みしてください
      </p>
    </div>
  );
}
