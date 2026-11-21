import { QuestionReportsHeader, QuestionReportsList } from "@/components/admin/question-reports-list";
import { requireAdmin } from "@/lib/auth";
import { listAdminQuestionReports } from "@/lib/db/question-reports-admin";
import { parseQuestionReportFilters } from "@/lib/study/question-report-admin";

export default async function QuestionReportsPage({ searchParams }: PageProps<"/admin/relatos">) {
  await requireAdmin("/admin/relatos");
  const filters = parseQuestionReportFilters(await searchParams);
  const data = await listAdminQuestionReports(filters);

  return (
    <main className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-7 lg:px-9 lg:py-9">
      <QuestionReportsHeader />
      <QuestionReportsList data={data} filters={filters} />
    </main>
  );
}
