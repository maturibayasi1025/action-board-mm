import { assertAuthState, expect, test } from "../e2e-test-helpers";

test.describe("スモークテスト", () => {
  test("プロフィール更新が正常に動作する", async ({ signedInPage }) => {
    await assertAuthState(signedInPage, true);

    await signedInPage.getByTestId("usermenubutton").click();
    await signedInPage.getByRole("menuitem", { name: "アカウント" }).click();
    await expect(signedInPage).toHaveURL(/\/settings\/profile/, {
      timeout: 10000,
    });

    const nicknameInput = signedInPage.getByRole("textbox", {
      name: "ニックネーム",
    });
    await nicknameInput.clear();
    await nicknameInput.fill("スモークテストユーザー");

    await signedInPage.getByRole("button", { name: "更新する" }).click();

    await expect(
      signedInPage.getByText("プロフィールを更新しました。"),
    ).toBeVisible({ timeout: 10000 });
  });

  test("グッジョブ完了の記録が正常に動作する", async ({ signedInPage }) => {
    await assertAuthState(signedInPage, true);

    await signedInPage
      .getByRole("button", { name: "詳細を見る →" })
      .first()
      .click();
    await expect(signedInPage).toHaveURL(/\/missions\/[^/]+$/, {
      timeout: 10000,
    });

    const completeButton = signedInPage.getByRole("button", {
      name: "グッジョブ完了を記録する",
    });
    if (await completeButton.isVisible()) {
      await completeButton.click();
      await expect(
        signedInPage.getByText("おめでとうございます！"),
      ).toBeVisible({
        timeout: 10000,
      });
    } else {
      await expect(
        signedInPage.getByText("このグッジョブは達成済みです。"),
      ).toBeVisible({ timeout: 10000 });
    }
  });
});
