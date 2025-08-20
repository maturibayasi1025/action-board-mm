const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // ページにアクセス
  await page.goto("http://localhost:3000/user-missions");

  // コンテンツが読み込まれるのを待つ
  await page.waitForTimeout(3000);

  // グッジョブカードが表示されているか確認
  const missionCards = await page.$$(".rounded-lg.border.bg-card");
  console.log(`Found ${missionCards.length} mission cards`);

  // タイトル「テスト」が表示されているか確認
  const titleElement = await page.$("text=テスト");
  if (titleElement) {
    console.log('✅ Mission "テスト" is displayed');
  } else {
    console.log('❌ Mission "テスト" is NOT displayed');
  }

  // 賞賛対象者が表示されているか確認
  const praisedUsersText = await page.textContent("body");
  if (
    praisedUsersText.includes("柳瀬裕也") ||
    praisedUsersText.includes("猪狩俊") ||
    praisedUsersText.includes("葉倉歩")
  ) {
    console.log("✅ Praised users are displayed");
  } else {
    console.log("❌ Praised users are NOT displayed");
  }

  await browser.close();
})();
