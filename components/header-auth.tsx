import { signOutAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { isOwner } from "@/lib/utils/isOwner";
import Link from "next/link";
import MyAvatar from "./my-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

export default async function AuthButton() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const owner = user ? await isOwner() : false;

  return user /* && profile */ ? (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="ユーザーメニューを開く"
          data-testid="usermenubutton"
        >
          <MyAvatar className="w-8 h-8" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
          side="bottom"
          align="end"
          sideOffset={4}
        >
          <DropdownMenuGroup>
            <DropdownMenuItem asChild>
              <Link href="/">ホーム</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="block md:hidden">
              <Link href="/user-missions/praised">自分宛のグッジョブ</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="block md:hidden">
              <Link href="/user-missions">みんなの投稿</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="block md:hidden">
              <Link href="/user-missions/my">自分の投稿</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="block md:hidden">
              <Link href="/user-missions/new">グッジョブ作成</Link>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          {owner && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem asChild>
                  <Link href="/admin/statistics">統計ダッシュボード</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/admin/important-missions">
                    共有グッジョブを登録する
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/admin/mvv-badges">MVVバッジを登録する</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/admin/goodjob-matrix">グッジョブマトリクス</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/admin/enps-surveys">eNPSアンケート管理</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/admin/award-surveys">表彰アンケート管理</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/admin/assessment-export">
                    査定データエクスポート
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/admin/business-units">会社・事業部マスタ</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/admin/user-business-units">
                    ユーザー事業部の割り当て
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/admin/users-and-companies">
                    ユーザー一覧（会社・事業部）
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem asChild>
              <Link href="/settings/profile">アカウント</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>お知らせ</DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <form action={signOutAction}>
            <DropdownMenuItem>
              <button
                type="submit"
                className="w-full text-left cursor-default"
                data-testid="sign-out"
              >
                ログアウト
              </button>
            </DropdownMenuItem>
          </form>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  ) : (
    <div className="flex gap-2">
      <Button asChild size="sm" variant="outline">
        <Link href="/sign-in">ログイン</Link>
      </Button>
      {/* <Button asChild size="sm" variant="default">
        <Link href="/sign-up">新規登録</Link>
      </Button> */}
    </div>
  );
}
