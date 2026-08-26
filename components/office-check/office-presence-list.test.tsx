import { render, screen } from "@testing-library/react";
import { OfficePresenceList } from "./office-presence-list";

describe("OfficePresenceList", () => {
  it("在室者なしのときはその旨を出す", () => {
    render(<OfficePresenceList names={[]} />);
    expect(screen.getByText("なし（在室者なし）")).toBeInTheDocument();
  });

  it("在室者名と人数を出す", () => {
    render(<OfficePresenceList names={["葉倉歩", "島田瞳"]} />);
    expect(screen.getByText("葉倉歩、島田瞳（2名）")).toBeInTheDocument();
  });
});
