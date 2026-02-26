import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isOwner } from "@/lib/utils/isOwner";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AwardQuestionForm } from "./_components/question-form";
import { AwardQuestionList } from "./_components/question-list";
import { getAwardQuestions } from "./actions";

export const runtime = "edge";

export default async function AwardQuestionsAdminPage() {
  const owner = await isOwner();
  if (!owner) {
    redirect("/");
  }

  const questions = await getAwardQuestions();

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">質問管理</h1>
            <p className="text-muted-foreground">
              表彰アンケートの質問を追加・編集・削除できます。
            </p>
          </div>
          <Link href="/admin/award-surveys">
            <Button variant="outline">アンケート一覧に戻る</Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>質問を追加</CardTitle>
            <CardDescription>
              新しい質問を追加します。バリューグループと質問タイプを選択してください。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AwardQuestionForm />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>質問一覧</CardTitle>
            <CardDescription>
              質問の内容や表示順序を編集できます。
            </CardDescription>
          </CardHeader>
          <CardContent>
            {questions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                質問がまだ作成されていません。
              </p>
            ) : (
              <AwardQuestionList initialQuestions={questions} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
