import { Badge } from "@/components/ui/badge";
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
import { QuestionForm } from "./_components/question-form";
import { QuestionList } from "./_components/question-list";
import { getQuestions } from "./actions";

export const runtime = "edge";

export default async function EnpsQuestionsAdminPage() {
  const owner = await isOwner();
  if (!owner) {
    redirect("/");
  }

  const questions = await getQuestions();

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">質問管理</h1>
            <p className="text-muted-foreground">
              eNPSアンケートの質問を追加・編集・削除できます。
            </p>
          </div>
          <Link href="/admin/enps-surveys">
            <Button variant="outline">アンケート一覧に戻る</Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>質問を追加</CardTitle>
            <CardDescription>
              新しい質問を追加します。質問タイプを選択してください。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <QuestionForm />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>質問一覧</CardTitle>
            <CardDescription>
              質問の表示順序や内容を編集できます。
            </CardDescription>
          </CardHeader>
          <CardContent>
            {questions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                質問がまだ作成されていません。
              </p>
            ) : (
              <QuestionList initialQuestions={questions} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
