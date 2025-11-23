import HeaderAuth from "@/components/header-auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/server";
import { Menu, Plus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default async function Navbar() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <nav className="sticky top-0 z-50 w-full flex justify-center bg-white border-b border-b-foreground/10 h-16">
      <div className="px-4 md:container md:mx-auto w-full flex justify-between items-center text-sm">
        <div className="flex gap-5 items-center font-semibold min-w-[60px]">
          <Link href="/" className="flex items-center gap-4">
            <Image
              src="/img/MMHD_symbol.png"
              alt="MMHD_symbol"
              width={57}
              height={48}
            />
            <div className="text-lg">アクションボード</div>
          </Link>
        </div>
        {user ? (
          <>
            <div className="flex gap-6 items-center">
              <div className="font-semibold hidden sm:flex">
                <Link href="/">ホーム</Link>
              </div>
              <div className="font-semibold hidden sm:flex">
                <Link href="/user-missions/praised">自分宛のグッジョブ</Link>
              </div>
              <div className="font-semibold hidden sm:flex">
                <Link href="/user-missions">みんなの投稿</Link>
              </div>
              <div className="font-semibold hidden sm:flex">
                <Link href="/user-missions/my">自分の投稿</Link>
              </div>
              <div className="hidden sm:flex">
                <Button asChild size="sm" variant="default">
                  <Link
                    href="/user-missions/new"
                    className="flex items-center gap-1"
                  >
                    <Plus className="h-4 w-4" />
                    グッジョブを作成
                  </Link>
                </Button>
              </div>
              <HeaderAuth />
            </div>
            <div className="flex gap-6 items-center font-semibold sm:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label="ナビゲーションメニューを開く"
                  data-testid="navmenubutton"
                >
                  <Menu />
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
                    <DropdownMenuItem asChild>
                      <Link href="/user-missions/praised">
                        自分宛のグッジョブ
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/user-missions">みんなの投稿</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/user-missions/my">自分の投稿</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/user-missions/new">グッジョブ作成</Link>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              <HeaderAuth />
            </div>
          </>
        ) : (
          <>
            <div className="gap-6 items-center font-semibold hidden sm:flex">
              <Link href="/">ホーム</Link>
              <HeaderAuth />
            </div>
            <div className="flex gap-6 items-center font-semibold sm:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label="ナビゲーションメニューを開く"
                  data-testid="navmenubutton"
                >
                  <Menu />
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
                    <DropdownMenuItem asChild>
                      <Link href="/user-missions/new">グッジョブ作成</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/user-missions/my">マイグッジョブ</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/user-missions/praised">
                        自分宛のグッジョブ
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/sign-in">ログイン</Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </>
        )}
      </div>
    </nav>
  );
}
