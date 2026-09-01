import { recoverInviteSessionFromLocation } from "./recover-invite-session";

const mockSetSession = jest.fn();
const mockGetUser = jest.fn();

jest.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      setSession: (...args: unknown[]) => mockSetSession(...args),
      getUser: (...args: unknown[]) => mockGetUser(...args),
    },
  }),
}));

describe("recoverInviteSessionFromLocation", () => {
  const originalLocation = window.location;

  afterEach(() => {
    mockSetSession.mockReset();
    mockGetUser.mockReset();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  it("returns none when tokens are missing", async () => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { hash: "", search: "" },
    });

    await expect(recoverInviteSessionFromLocation()).resolves.toBe("none");
    expect(mockSetSession).not.toHaveBeenCalled();
  });

  it("sets the session from hash tokens", async () => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        hash: "#access_token=aaa&refresh_token=bbb&type=invite",
        search: "?redirect_to=/invite/set-password",
      },
    });
    mockSetSession.mockResolvedValue({ error: null });
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });

    await expect(recoverInviteSessionFromLocation()).resolves.toBe("recovered");
    expect(mockSetSession).toHaveBeenCalledWith({
      access_token: "aaa",
      refresh_token: "bbb",
    });
  });

  it("returns error when setSession fails", async () => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        hash: "#access_token=aaa&refresh_token=bbb",
        search: "",
      },
    });
    mockSetSession.mockResolvedValue({ error: { message: "invalid" } });

    await expect(recoverInviteSessionFromLocation()).resolves.toBe("error");
  });
});
