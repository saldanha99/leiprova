import type { Metadata } from "next";

import { LiveStudySession } from "@/components/study/live-study-session";

export const metadata: Metadata = {
  title: "Treinar",
  description: "Sessão adaptativa de treino de literalidade.",
};

export default async function TrainPage({
  searchParams,
}: {
  searchParams: Promise<{ modo?: string; tema?: string }>;
}) {
  const params = await searchParams;
  const mode = params.modo === "revisao" ? "revisao" : "normal";
  const topic = normalizeTopic(params.tema);
  return <LiveStudySession key={`${mode}:${topic ?? "todos"}`} mode={mode} topic={topic} />;
}

function normalizeTopic(value: string | undefined) {
  const topic = value?.trim();
  return topic && topic.length <= 120 ? topic : undefined;
}
