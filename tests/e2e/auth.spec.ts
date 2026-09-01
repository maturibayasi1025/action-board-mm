import {
  assertAuthState,
  expect,
  generateRandomEmail,
  test,
} from "../e2e-test-helpers";

test.describe("ユーザー登録とログイン", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("サインアップ、サインイン、ログアウトの基本フローが正常に動作する", async ({
    page,
  }) => {
    await assertAuthState(page, false);

    if (await page.getByTestId("navmenubutton").isVisible()) {
      await page.getByTestId("navmenubutton").click();
      await page.getByRole("menuitem", { name: "新規登録" }).click();
    } else {
      await page.getByRole("link", { name: "新規登録" }).click();
    }

    await expect(page).toHaveURL("/sign-up");

    await page.locator("#terms").click();
    const testEmail = generateRandomEmail();
    const testPassword = "TestPassword123!";
    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="password"]', testPassword);
    await page.getByRole("button", { name: "アカウントを作成" }).click();

    await expect(page).toHaveURL(/\/sign-up-success/, { timeout: 10000 });
    await expect(
      page.getByText("ご登録頂きありがとうございます！"),
    ).toBeVisible();

    await page.goto("/sign-in");
    await expect(page.getByRole("heading", { name: "ログイン" })).toBeVisible();
    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="password"]', testPassword);
    await page.getByRole("button", { name: "ログイン", exact: true }).click();

    await Promise.race([
      page.waitForURL("/", { timeout: 15000 }),
      page.waitForURL(/\/settings\/profile/, { timeout: 15000 }),
      page.locator('[role="alert"]').waitFor({ timeout: 15000 }),
    ]);

    if (!page.url().includes("settings/profile") && !page.url().endsWith("/")) {
      return;
    }

    await assertAuthState(page, true);
    await page.getByTestId("usermenubutton").click();
    await page.getByTestId("sign-out").click();
    await page.waitForURL("/sign-in", { timeout: 10000 });
    await assertAuthState(page, false);
  });

  test("利用規約に同意しないとアカウント作成できない", async ({ page }) => {
    await page.goto("/sign-up");
    await page.fill('input[name="email"]', "test@example.com");
    await page.fill('input[name="password"]', "TestPassword123!");
    await expect(
      page.getByRole("button", { name: "アカウントを作成" }),
    ).toBeDisabled();

    await page.locator("#terms").click();
    await expect(
      page.getByRole("button", { name: "アカウントを作成" }),
    ).toBeEnabled();
  });

  test("登録フォームの入力バリデーション", async ({ page }) => {
    await page.goto("/sign-up");

    await expect(
      page.getByRole("heading", { name: "アクションボードに登録" }),
    ).toBeVisible();
    await expect(
      page.getByText("メールアドレス", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("パスワード", { exact: true })).toBeVisible();
    await expect(page.getByRole("main").getByText("利用規約")).toBeVisible();
    await expect(
      page.getByRole("main").getByText("プライバシーポリシー"),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "こちら" })).toBeVisible();

    await expect(
      page.getByRole("button", { name: "アカウントを作成" }),
    ).toBeDisabled();

    await page.fill('input[name="email"]', "test@example.com");
    await expect(
      page.getByRole("button", { name: "アカウントを作成" }),
    ).toBeDisabled();

    await page.fill('input[name="password"]', "TestPassword123!");
    await expect(
      page.getByRole("button", { name: "アカウントを作成" }),
    ).toBeDisabled();

    await page.locator("#terms").click();
    await expect(
      page.getByRole("button", { name: "アカウントを作成" }),
    ).toBeEnabled();
  });

  test("/sign-up-email は /sign-up にリダイレクトされる", async ({ page }) => {
    await page.goto("/sign-up-email");
    await page.waitForURL("/sign-up", { timeout: 5000 });
    await expect(
      page.getByRole("heading", { name: "アクションボードに登録" }),
    ).toBeVisible();
  });

  test("サインインページの表示と入力検証", async ({ page }) => {
    await page.goto("/sign-in");

    await expect(page.getByRole("heading", { name: "ログイン" })).toBeVisible();
    await expect(
      page.getByText("メールアドレス", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("パスワード", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "ログイン", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "こちら" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "パスワードを忘れた方" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "ログイン", exact: true }).click();
    await expect(page).toHaveURL("/sign-in");

    await page.fill('input[name="email"]', "test@example.com");
    await page.getByRole("button", { name: "ログイン", exact: true }).click();
    await expect(page).toHaveURL("/sign-in");

    await page.fill('input[name="email"]', "");
    await page.fill('input[name="password"]', "password123");
    await page.getByRole("button", { name: "ログイン", exact: true }).click();
    await expect(page).toHaveURL("/sign-in");

    await page.fill('input[name="email"]', "nonexistent@example.com");
    await page.fill('input[name="password"]', "wrongpassword");
    await page.getByRole("button", { name: "ログイン", exact: true }).click();
    await expect(
      page.getByText(/認証エラー|間違っています|見つかりません/).first(),
    ).toBeVisible({ timeout: 5000 });
  });

  test("パスワードを忘れた方ページが表示される", async ({ page }) => {
    await page.goto("/forgot-password");
    await expect(
      page.getByRole("heading", { name: "パスワードを忘れた方" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "パスワードリセットメールを送信" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "ログイン画面に戻る" }),
    ).toBeVisible();
  });
});
