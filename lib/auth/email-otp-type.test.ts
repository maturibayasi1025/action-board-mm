import { parseEmailOtpType } from "./email-otp-type";

describe("parseEmailOtpType", () => {
  it("accepts invite and recovery types", () => {
    expect(parseEmailOtpType("invite")).toBe("invite");
    expect(parseEmailOtpType("recovery")).toBe("recovery");
  });

  it("rejects unknown or empty values", () => {
    expect(parseEmailOtpType("not-a-type")).toBeNull();
    expect(parseEmailOtpType(null)).toBeNull();
  });
});
