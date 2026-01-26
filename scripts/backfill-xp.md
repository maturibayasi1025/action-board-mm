# XP未付与の補完処理実行方法

## 概要

グッジョブ達成時にXP付与が失敗した場合、achievement（達成記録）は作成されるがXPが付与されない状態になることがあります。
このスクリプトは、そのようなXP未付与のachievementを検出して、後からXPを補完します。

## 実行方法

### 1. 統計情報の確認

まず、XP未付与のachievementがどれくらいあるか確認します：

```bash
curl -X GET http://localhost:3000/api/batch/backfill-missing-xp
```

レスポンス例：
```json
{
  "statistics": {
    "totalAchievements": 1000,
    "totalXpTransactions": 950,
    "missingXpAchievements": 50,
    "completionRate": 95
  },
  "message": "50 件のグッジョブ達成にXPが付与されていません"
}
```

### 2. バックフィル処理の実行

XP未付与のachievementにXPを付与します：

```bash
curl -X POST http://localhost:3000/api/batch/backfill-missing-xp \
  -H "Content-Type: application/json" \
  -d '{"adminKey": "YOUR_BATCH_ADMIN_KEY"}'
```

**注意**: `BATCH_ADMIN_KEY`環境変数に設定したキーを使用してください。

レスポンス例：
```json
{
  "success": true,
  "message": "XP付与バッチ処理が完了しました",
  "summary": {
    "total": 50,
    "processed": 48,
    "skipped": 1,
    "errors": 1
  },
  "results": [
    {
      "achievementId": "xxx",
      "userId": "yyy",
      "missionTitle": "グッジョブ名",
      "xpGranted": 100,
      "status": "success"
    },
    ...
  ]
}
```

## 本番環境での実行

本番環境では、適切な認証情報を使用して実行してください：

```bash
curl -X POST https://your-domain.com/api/batch/backfill-missing-xp \
  -H "Content-Type: application/json" \
  -d '{"adminKey": "YOUR_BATCH_ADMIN_KEY"}'
```

## 定期実行の設定

定期的にXP未付与をチェック・補完する場合は、cronジョブやスケジューラーを設定してください。

例（cron）：
```cron
# 毎日午前2時に実行
0 2 * * * curl -X POST https://your-domain.com/api/batch/backfill-missing-xp -H "Content-Type: application/json" -d '{"adminKey": "YOUR_BATCH_ADMIN_KEY"}'
```

## 注意事項

- バックフィル処理は既にXPが付与されているachievementには影響しません
- 処理には時間がかかる場合があります（大量のachievementがある場合）
- エラーが発生した場合は、結果の`errors`フィールドを確認してください
