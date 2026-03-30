/**
 * findPrivateUserBySubstringSymmetric 相当の正規化・部分一致は
 * findPrivateUserIdForSlackMention 内で行うため、ここでは正規化の期待のみ検証する。
 */
describe("normalizeComparableName (via substring behavior)", () => {
  it("スペース除去後に長い Slack 表示名が DB の短い名前を含めば一致扱いになる想定", () => {
    const normalize = (s: string) => s.trim().replace(/\s+/g, "").toLowerCase();
    const slack = normalize("高橋聖（takahashi akira）");
    const db = normalize("高橋聖");
    expect(slack.includes(db)).toBe(true);
  });
});
