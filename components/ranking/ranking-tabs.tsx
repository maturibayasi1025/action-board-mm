"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface RankingTabsProps {
  children: React.ReactNode;
}

export function RankingTabs({ children }: RankingTabsProps) {
  const pathname = usePathname();
  const isMissionPage = pathname.includes("ranking-mission");
  const isPrefecturePage = pathname.includes("ranking-prefecture");
  const isLikesPage = pathname.includes("ranking-likes");

  // パスに基づいてタブの値を決定
  const getTabValue = () => {
    if (isMissionPage) return "mission";
    if (isPrefecturePage) return "prefecture";
    if (isLikesPage) return "likes";
    return "overall";
  };

  return (
    <Tabs value={getTabValue()} className="w-full max-w-6xl mx-auto px-4">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="overall" asChild>
          <Link href="/ranking">全体</Link>
        </TabsTrigger>
        {/* <TabsTrigger value="prefecture" asChild>
          <Link href="/ranking/ranking-prefecture">都道府県別</Link>
        </TabsTrigger> */}
        <TabsTrigger value="mission" asChild>
          <Link href="/ranking/ranking-mission">グッジョブ別</Link>
        </TabsTrigger>
        <TabsTrigger value="likes" asChild>
          <Link href="/ranking/ranking-likes">いいね数</Link>
        </TabsTrigger>
      </TabsList>
      <TabsContent value={getTabValue()}>{children}</TabsContent>
    </Tabs>
  );
}
