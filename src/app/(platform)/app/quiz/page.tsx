import type { Metadata } from "next";
import { ListChecks } from "lucide-react";

import { PageHeader } from "@/components/platform/page-header";
import { QuizExperience } from "@/components/quiz/quiz-experience";
import { listEligibleQuizExamEditions } from "@/lib/db/quiz-exam-editions";
import { toQuizExamEditionOptions } from "@/lib/quiz/exam-edition-catalog";

export const metadata: Metadata = {
  title: "Quiz e simulados",
  description: "Monte sessões por cargo, banca, matéria e estilo de questão.",
};

export default async function QuizPage() {
  const examEditions = toQuizExamEditionOptions(await listEligibleQuizExamEditions());

  return (
    <main className="mx-auto max-w-7xl px-4 py-7 sm:px-7 lg:px-9 lg:py-10">
      <PageHeader
        eyebrow="Treino sob medida"
        title="Quiz e simulados"
        description="Escolha o cargo ou a banca, refine a matéria e treine literalidade, questões licenciadas ou itens inéditos autorais no padrão de cobrança."
        icon={ListChecks}
      />
      <QuizExperience examEditions={examEditions} />
    </main>
  );
}
