import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { ArrowRight, Building2, FileCheck2, Sparkles } from "lucide-react";

import { PageHeader } from "@/components/platform/page-header";
import { requireUser } from "@/lib/auth";
import { PROTECTED_PATH_HEADER } from "@/lib/protected-path";
import { quizPresetHref } from "@/components/quiz/preset-config";
import { listEligibleQuizExamEditions, listOriginalStyleSimulationCoverage } from "@/lib/db/quiz-exam-editions";
import { getSubjectsForCareer } from "@/lib/quiz/catalog";
import { toQuizExamEditionOptions } from "@/lib/quiz/exam-edition-catalog";

export const metadata: Metadata = {
  title: "Biblioteca de simulados",
  description: "Rodadas predefinidas de literalidade e estilo de banca.",
};

export default async function SimulationsPage() {
  // O layout também exige login, mas renderiza em paralelo com a página:
  // sem esta guarda, a consulta pesada rodava para visitante sem sessão.
  await requireUser((await headers()).get(PROTECTED_PATH_HEADER) ?? "/app");
  const [eligibleEditions, bankRounds] = await Promise.all([
    listEligibleQuizExamEditions(new Date(), true),
    listOriginalStyleSimulationCoverage(),
  ]);
  const editions = toQuizExamEditionOptions(eligibleEditions);
  const editionRounds = editions.filter((edition) => edition.scheduled).slice(0, 12).flatMap((edition) => {
    const subject = getSubjectsForCareer(edition.careerSlug)[0];
    if (!subject) return [];
    return [{
      title: edition.title,
      description: `Rodada autoral alinhada à edição e ao padrão ${edition.bank.name}.`,
      meta: `${edition.jurisdiction ?? "Nacional"} · ${edition.examYear}`,
      href: quizPresetHref({
        path: "career",
        careerSlug: edition.careerSlug,
        specializationSlug: edition.specializationSlug ?? undefined,
        examYear: edition.examYear,
        examEditionId: edition.publicId,
        subjectSlug: subject.slug,
        mode: "original_style",
        count: 20,
        experience: "exam",
        timed: true,
        examScope: "latest",
      }),
    }];
  });

  return (
    <main className="mx-auto max-w-7xl px-4 py-7 sm:px-7 lg:px-9 lg:py-10">
      <PageHeader
        eyebrow="Rodadas prontas"
        title="Biblioteca de simulados"
        description="Comece por uma rodada pronta ou abra o construtor para ajustar banca, matéria, quantidade e tempo. As questões autorais e as provas licenciadas permanecem identificadas separadamente."
        icon={FileCheck2}
      />

      <section className="mt-8">
        <div><p className="text-xs font-bold uppercase tracking-[.15em] text-els-amber-ink">Acervo disponível agora</p><h2 className="mt-2 text-2xl font-semibold tracking-[-.03em]">Simulados autorais por banca</h2></div>
        {bankRounds.length ? (
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {bankRounds.map((round) => (
              <PresetCard
                key={`${round.bankSlug}:${round.subjectSlug}`}
                icon={Sparkles}
                title={`${round.subjectName} — ${round.bankName}`}
                description={`Questões inéditas revisadas no padrão ${round.bankName}, fundamentadas em texto oficial e separadas de provas anteriores.`}
                meta={`${round.questionCount} questões disponíveis`}
                href={quizPresetHref({ path: "bank", bankSlug: round.bankSlug, subjectSlug: round.subjectSlug, mode: "original_style", count: 20, experience: "training", timed: false, examScope: "latest" })}
              />
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-els-line bg-els-surface p-8 text-center text-sm text-els-fg-3">Nenhum simulado autoral revisado está disponível neste momento.</div>
        )}
      </section>

      <section className="mt-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.15em] text-els-green-ink">Por edição oficial</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-.03em]">Simulados alinhados ao edital</h2>
          </div>
          <Link href="/app/quiz" className="inline-flex items-center gap-2 text-sm font-semibold text-els-amber-ink">Montar outro recorte <ArrowRight className="size-4" /></Link>
        </div>
        {editionRounds.length ? (
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {editionRounds.map((round) => (
              <article key={round.href} className="flex min-h-56 flex-col rounded-2xl border border-els-line bg-els-surface p-5">
                <span className="grid size-10 place-items-center rounded-xl bg-els-green/10 text-els-green-ink"><Building2 className="size-5" /></span>
                <h3 className="mt-5 font-semibold text-els-fg">{round.title}</h3>
                <p className="mt-2 text-xs leading-5 text-els-fg-3">{round.description}</p>
                <div className="mt-auto flex items-center justify-between gap-3 pt-5">
                  <span className="text-[11px] text-els-fg-4">{round.meta}</span>
                  <Link href={round.href} className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-els-amber px-3 text-xs font-bold text-els-on-amber">Preparar <ArrowRight className="size-3.5" /></Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-els-line bg-els-surface p-8 text-center text-sm text-els-fg-3">As rodadas por edital aparecem depois que a edição, a banca e o programa forem revisados.</div>
        )}
      </section>
    </main>
  );
}

function PresetCard({ icon: Icon, title, description, meta, href }: { icon: typeof FileCheck2; title: string; description: string; meta: string; href: string }) {
  return (
    <article className="flex min-h-64 flex-col rounded-[1.5rem] border border-els-amber/12 bg-[radial-gradient(circle_at_top_right,color-mix(in_oklch,var(--els-amber)_8%,transparent),transparent_42%),var(--els-bg-2)] p-6">
      <span className="grid size-11 place-items-center rounded-xl bg-els-amber/10 text-els-amber-ink"><Icon className="size-5" /></span>
      <h2 className="mt-5 text-xl font-semibold">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-els-fg-3">{description}</p>
      <div className="mt-auto flex items-center justify-between gap-3 pt-6">
        <span className="text-[11px] text-els-fg-4">{meta}</span>
        <Link href={href} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-els-line px-4 text-xs font-bold text-els-fg">Abrir <ArrowRight className="size-3.5" /></Link>
      </div>
    </article>
  );
}
