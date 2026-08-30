import { adminDeleteUser } from "@/app/(protected)/admin/users-and-companies/actions";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isUserIdOwner, requireOwner } from "@/lib/utils/isOwner";
import { revalidatePath } from "next/cache";

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
  createServiceClient: jest.fn(),
}));

jest.mock("@/lib/utils/isOwner", () => ({
  requireOwner: jest.fn(),
  isUserIdOwner: jest.fn(),
}));

jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}));

function createServiceMock(options?: {
  updateError?: { message: string } | null;
  updated?: { id: string } | null;
  existing?: { id: string; deleted_at: string | null } | null;
  banError?: { message: string } | null;
}) {
  const maybeSingle = jest
    .fn()
    .mockResolvedValueOnce({
      data: options?.updated ?? { id: "target-user" },
      error: options?.updateError ?? null,
    })
    .mockResolvedValueOnce({
      data: options?.existing ?? { id: "target-user", deleted_at: null },
      error: null,
    });

  const query = {
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    maybeSingle,
  };

  return {
    from: jest.fn().mockReturnValue(query),
    auth: {
      admin: {
        deleteUser: jest.fn(),
        updateUserById: jest.fn().mockResolvedValue({
          data: { user: null },
          error: options?.banError ?? null,
        }),
      },
    },
    query,
  };
}

describe("adminDeleteUser", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireOwner as jest.Mock).mockResolvedValue(undefined);
    (isUserIdOwner as jest.Mock).mockResolvedValue(false);
    (createClient as jest.Mock).mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: "operator-user" } },
        }),
      },
    });
  });

  it("自分自身は削除できない", async () => {
    const result = await adminDeleteUser("operator-user");
    expect(result).toEqual({
      success: false,
      error: "自分自身は削除できません",
    });
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  it("経営者アカウントは削除できない", async () => {
    (isUserIdOwner as jest.Mock).mockResolvedValue(true);
    const result = await adminDeleteUser("owner-user");
    expect(result).toEqual({
      success: false,
      error: "経営者アカウントは削除できません",
    });
  });

  it("deleted_at を立てて Auth を停止し、物理削除はしない", async () => {
    const service = createServiceMock();
    (createServiceClient as jest.Mock).mockResolvedValue(service);

    const result = await adminDeleteUser("target-user");

    expect(result).toEqual({ success: true });
    expect(service.from).toHaveBeenCalledWith("private_users");
    expect(service.query.update).toHaveBeenCalledWith({
      deleted_at: expect.any(String),
    });
    expect(service.auth.admin.updateUserById).toHaveBeenCalledWith(
      "target-user",
      { ban_duration: "876600h" },
    );
    expect(service.auth.admin.deleteUser).not.toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/admin/users-and-companies");
  });

  it("プロフィール更新に失敗したらエラーを返す", async () => {
    const service = createServiceMock({
      updateError: { message: "db error" },
      updated: null,
    });
    (createServiceClient as jest.Mock).mockResolvedValue(service);

    const result = await adminDeleteUser("target-user");
    expect(result).toEqual({
      success: false,
      error: "削除状態の更新に失敗しました",
    });
  });
});
