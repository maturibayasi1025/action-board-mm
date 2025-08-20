import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CreateMissionForm } from "@/components/user-mission/create-mission-form";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function NewUserMissionPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in?message=グッジョブ作成にはログインが必要です");
  }

  return (
    <div className="container mx-auto py-8 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>新しいグッジョブを作成</CardTitle>
          <CardDescription>
            素晴らしい行動や成果を賞賛するグッジョブを作成しましょう。
            作成されたグッジョブはすぐにユーザーグッジョブ一覧に公開されます。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateMissionForm />
        </CardContent>
      </Card>
    </div>
  );
}
