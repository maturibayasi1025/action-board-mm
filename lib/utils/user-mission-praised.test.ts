import { excludeCreatorFromPraisedUserIds } from "./user-mission-praised";

describe("excludeCreatorFromPraisedUserIds", () => {
  const creator = "creator-uuid";

  it("removes creator id from the list", () => {
    expect(
      excludeCreatorFromPraisedUserIds(["a", creator, "b"], creator),
    ).toEqual(["a", "b"]);
  });

  it("returns empty when only creator was listed", () => {
    expect(excludeCreatorFromPraisedUserIds([creator], creator)).toEqual([]);
  });

  it("drops empty strings", () => {
    expect(excludeCreatorFromPraisedUserIds(["", "x"], creator)).toEqual(["x"]);
  });
});
