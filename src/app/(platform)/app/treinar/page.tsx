import type { Metadata } from "next";

import { LiveStudySession } from "@/components/study/live-study-session";
import { requireUser } from "@/lib/auth";
import { listQuestionNotebooks } from "@/lib/db/legal-library";
import {
  normalizeArticleRange,
  normalizeLegalActSlug,
  normalizeNotebookPublicId,
  normalizeStudyTopic,
} from "@/lib/study/scope";

export const metadata: Metadata = {
  title: "Treinar",
  description: "Sessão adaptativa de treino de literalidade.",
};

export default async function TrainPage({
  searchParams,
}: {
  searchParams: Promise<{
    modo?: string;
    tema?: string;
    lei?: string;
    de?: string;
    ate?: string;
    ordem?: string;
    caderno?: string;
  }>;
}) {
  const params = await searchParams;
  const user = await requireUser("/app/treinar");
  const mode = params.modo === "revisao" ? "revisao" : "normal";
  const topic = normalizeStudyTopic(params.tema);
  const legalActSlug = normalizeLegalActSlug(params.lei);
  const { start: articleStartOrder, end: articleEndOrder } = normalizeArticleRange(params.de, params.ate);
  const notebookPublicId = normalizeNotebookPublicId(params.caderno);
  const notebooks = await listQuestionNotebooks(user.id);
  const sessionKey = [mode, topic, legalActSlug, articleStartOrder, articleEndOrder, notebookPublicId]
    .filter((value) => value !== undefined && value !== null)
    .join(":");

  return (
    <LiveStudySession
      key={sessionKey}
      mode={mode}
      topic={topic}
      legalActSlug={legalActSlug}
      articleStartOrder={articleStartOrder}
      articleEndOrder={articleEndOrder}
      sequential={params.ordem === "sequencial"}
      notebookPublicId={notebookPublicId}
      notebooks={notebooks.map(({ publicId, name, questionCount }) => ({ publicId, name, questionCount }))}
    />
  );
}
