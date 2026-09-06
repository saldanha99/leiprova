import Link from "next/link";
import {
  COURSE_PRODUCTION_NEXT_STEP_LABELS,
  type CourseProductionWorkOrder,
} from "@/lib/editorial/course-production-plan";

export function CourseProductionCard({ order }: { order: CourseProductionWorkOrder }) {
  const { research } = order;
  return (
    <details className="mt-5 rounded-xl border border-amber-200/15 bg-amber-100/[0.03] open:pb-4">
      <summary className="cursor-pointer rounded-xl px-4 py-3 text-sm font-semibold text-amber-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200">
        Preparação editorial · {COURSE_PRODUCTION_NEXT_STEP_LABELS[order.nextStep]}
      </summary>
      <div className="space-y-4 px-4 text-xs leading-6 text-slate-300">
        <p className="font-medium text-white">{research.editionDescription}</p>
        <dl className="space-y-2">
          <div><dt className="text-slate-400">Fase observada</dt><dd>{research.examStage}</dd></div>
          <div><dt className="text-slate-400">Banca identificada na pesquisa</dt><dd>{research.bankNames.join(" / ") || "Ainda não confirmada"}</dd></div>
          <div><dt className="text-slate-400">Recorte do programa</dt><dd>{research.syllabusNotes}</dd></div>
          <div><dt className="text-slate-400">Localizador</dt><dd>{research.requirementLocator ?? "Leitura e localização do programa pendentes"}</dd></div>
        </dl>
        <ul className="list-disc space-y-2 pl-4">
          {research.constraints.map((constraint) => <li key={constraint}>{constraint}</li>)}
        </ul>
        {research.officialUrls.length > 0 && (
          <div>
            <p className="font-semibold text-white">Fontes e pistas oficiais</p>
            <ul className="mt-2 space-y-1">
              {research.officialUrls.map((url, index) => {
                const address = new URL(url);
                const title = research.evidence.find((evidence) => evidence.url === url)?.title
                  ?? decodeURIComponent(address.pathname.split("/").filter(Boolean).at(-1) ?? "Portal oficial");
                return <li key={url}><a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 flex-col justify-center break-all py-2 text-emerald-200 underline underline-offset-4">
                  <span>{index + 1}. {title}</span>
                  <span className="text-[11px] text-slate-400">{address.hostname}</span>
                </a></li>;
              })}
            </ul>
          </div>
        )}
        {research.evidence.length > 0 && (
          <details className="border-t border-white/10 pt-3">
            <summary className="cursor-pointer py-2 font-semibold text-slate-200">O que foi observado e limitações da consulta</summary>
            <ul className="mt-3 space-y-4">
              {research.evidence.map((evidence, index) => (
                <li key={`${evidence.url}-${index}`}>
                  <p className="font-medium text-white">{evidence.title}</p>
                  <p>{evidence.observedFacts}</p>
                  <time dateTime={evidence.checkedAt} className="text-slate-400">Registro: {evidence.checkedAt.slice(0, 10)}</time>
                </li>
              ))}
            </ul>
          </details>
        )}
        <p className="border-t border-white/10 pt-3 text-amber-100">
          Plano de preparação, não execução automática. Pesquisa não aprova edital,
          questão ou vínculo. Cada produto mantém sua própria validação, mesmo ao
          aproveitar uma questão comum a outro curso.
        </p>
        <div className="flex flex-wrap gap-x-5 gap-y-1">
          <Link className="inline-flex min-h-11 items-center font-bold text-emerald-200" href="/admin/motor-editais">Conferir edital e requisitos →</Link>
          <Link className="inline-flex min-h-11 items-center font-bold text-emerald-200" href="/admin/fabrica-autoral">Revisar questões e dossiês →</Link>
        </div>
      </div>
    </details>
  );
}
