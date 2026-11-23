import Link from "next/link";
import { BookOpenCheck, CheckCircle2, Database, ExternalLink, FileSearch, FileText, Link2, ShieldCheck } from "lucide-react";

import {
  ExamMetadataForm,
  LegalSyncButton,
  LegalTextCaptureButton,
  LegalTextReviewControls,
  PortalVerifyButton,
  SnapshotReviewControls,
} from "@/components/admin/source-actions";
import { requireAdmin } from "@/lib/auth";
import { getOfficialSourcesSnapshot } from "@/lib/db/official-sources-admin";

const numberFormatter = new Intl.NumberFormat("pt-BR");
const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

function formatDate(value: Date | string | null) {
  if (!value) return "data indisponível";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "data indisponível" : dateFormatter.format(date);
}

const snapshotLabels: Record<string, string> = {
  pending_review: "Aguardando revisão",
  approved: "Referência aprovada",
  superseded: "Substituída",
  rejected: "Rejeitada",
};

export default async function OfficialSourcesPage() {
  const [, snapshot] = await Promise.all([requireAdmin(), getOfficialSourcesSnapshot()]);
  const bankOptions = snapshot.portals.map(({ bankId, bankName }) => ({ bankId, bankName }));
  const metrics = [
    { label: "Leis monitoradas", value: snapshot.metrics.monitoredLaws, icon: BookOpenCheck, tone: "text-els-amber-ink bg-els-amber/10" },
    { label: "Fotografias pendentes", value: snapshot.metrics.pendingSnapshots, icon: FileSearch, tone: "text-els-info-ink bg-els-info/10" },
    { label: "Portais saudáveis", value: snapshot.metrics.healthyPortals, icon: Link2, tone: "text-els-green-ink bg-els-green/10" },
    { label: "Provas só com metadados", value: snapshot.metrics.metadataExams, icon: Database, tone: "text-els-info-ink bg-els-info/10" },
    { label: "Textos aguardando revisão", value: snapshot.metrics.pendingLegalTexts, icon: FileText, tone: "text-els-info-ink bg-els-info/10" },
    { label: "Artigos oficiais ativos", value: snapshot.metrics.activeLegalArticles, icon: CheckCircle2, tone: "text-els-green-ink bg-els-green/10" },
  ];

  return (
    <main className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-7 lg:px-9 lg:py-9">
      <header className="relative overflow-hidden rounded-[1.75rem] border border-els-green/15 bg-[linear-gradient(145deg,var(--els-surface)_0%,var(--els-bg-2)_58%,var(--els-bg-2)_100%)] p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-28 size-72 rounded-full bg-els-green/8 blur-3xl" />
        <div className="relative max-w-4xl">
          <span className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.17em] text-els-green-ink"><ShieldCheck className="size-3.5" />Fontes e governança</span>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-.045em] text-els-fg sm:text-4xl">Atualização oficial sem copiar questões.</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-els-fg-3 sm:text-base">O monitor compara páginas de normas no sistema oficial do Senado Federal. Para provas, a base aceita exclusivamente título, banca, data e link oficial. Enunciados, alternativas e gabaritos de terceiros não são coletados.</p>
          <div className="mt-5 flex flex-wrap gap-3 text-xs font-semibold text-els-fg-2"><span>10 fontes federais registradas</span><span>•</span><span>0 textos de questões de banca armazenados</span><span>•</span><span>publicação sempre humana</span></div>
        </div>
      </header>

      <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Indicadores das fontes">
        {metrics.map(({ label, value, icon: Icon, tone }) => <article key={label} className="rounded-2xl border border-els-line bg-els-surface p-4"><div className={`grid size-9 place-items-center rounded-xl ${tone}`}><Icon className="size-4" /></div><p className="mt-4 text-2xl font-semibold text-els-fg">{numberFormatter.format(value)}</p><p className="mt-1 text-xs font-semibold text-els-fg-3">{label}</p></article>)}
      </section>

      <section className="mt-5 rounded-[1.5rem] border border-els-line bg-els-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4"><div><span className="text-xs font-bold uppercase tracking-[.14em] text-els-amber-ink">Leis federais</span><h2 className="mt-2 text-xl font-semibold text-els-fg">Fotografias da página oficial</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-els-fg-3">Uma conferência calcula a impressão digital da página que reúne publicação e atos modificadores. Ela sinaliza mudanças, mas não altera artigos nem gabaritos; a conta editorial responsável registra a revisão humana antes da aprovação.</p></div><Link href="/fontes-e-atualizacao" className="text-xs font-bold text-els-amber-ink hover:text-els-amber-ink min-h-11 inline-flex items-center">Ver política pública →</Link></div>
        <p className="mt-4 rounded-xl border border-els-green/15 bg-els-green/[.045] px-4 py-3 text-xs leading-5 text-els-green-ink">A mesma conta pode capturar e revisar o mesmo item, sempre com nota e auditoria.</p>
        <div className="mt-5 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {snapshot.laws.map((law) => <article key={law.id} className="rounded-2xl border border-els-line bg-els-sink p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0 break-words"><h3 className="font-semibold text-els-fg">{law.shortTitle}</h3><p className="mt-1 text-[11px] text-els-fg-4">{law.pendingCount} pendente(s) · {law.approvedCount} referência(s) atual(is)</p></div><a href={law.officialUrl} target="_blank" rel="noreferrer" aria-label={`Abrir ${law.shortTitle} na fonte oficial`} className="text-els-fg-3 hover:text-els-amber-ink min-h-11 inline-flex items-center"><ExternalLink className="size-4" /></a></div><p className="mt-3 text-xs text-els-fg-3">{law.lastSeenAt ? `Última leitura: ${formatDate(law.lastSeenAt)}` : "Ainda não conferida pelo monitor."}</p><LegalSyncButton slug={law.slug} /><LegalTextCaptureButton slug={law.slug} enabled={law.approvedCount > 0} /></article>)}
        </div>
      </section>

      <section className="mt-5 rounded-[1.5rem] border border-els-line bg-els-surface p-5 sm:p-6">
        <span className="text-xs font-bold uppercase tracking-[.14em] text-els-green-ink">Corpus legal consolidado</span>
        <h2 className="mt-2 text-xl font-semibold text-els-fg">Versões integrais prontas para ativação</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-els-fg-3">
          O sistema localiza a compilação monovigente no Senado, remove redações riscadas, separa os artigos e preserva o texto com checksum. A conta editorial responsável confere a versão inteira antes de os artigos entrarem no motor.
        </p>
        {snapshot.textSnapshots.length ? (
          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            {snapshot.textSnapshots.map((item) => {
              const canReview = item.status === "pending_review";
              return (
                <article key={item.publicId} className="rounded-2xl border border-els-line bg-els-sink p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <strong className="text-sm text-els-fg">{item.actTitle}</strong>
                      <p className="mt-1 text-[11px] text-els-fg-4">Parser {item.parserVersion}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${item.status === "approved" ? "bg-els-green/10 text-els-green-ink" : item.status === "pending_review" ? "bg-els-amber/10 text-els-amber-ink" : "bg-els-raise text-els-fg-3"}`}>{snapshotLabels[item.status] ?? item.status}</span>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-els-fg-3">
                    <div><dt>Texto preservado</dt><dd className="mt-0.5 font-semibold text-els-fg-2">{numberFormatter.format(item.contentLength)} caracteres</dd></div>
                    <div><dt>Artigos reconhecidos</dt><dd className="mt-0.5 font-semibold text-els-fg-2">{numberFormatter.format(item.articleCount)}</dd></div>
                  </dl>
                  <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-els-green-ink hover:text-els-green-ink min-h-11">Abrir compilação oficial <ExternalLink className="size-3.5" /></a>
                  <p className="mt-3 break-all font-mono text-[10px] text-els-fg-4">SHA-256 {item.checksumSha256}</p>
                  <p className="mt-3 text-[11px] leading-5 text-els-fg-4">Capturada em {formatDate(item.fetchedAt)} · iniciada por {item.initiatorName ?? "rotina interna"}{item.reviewerName ? ` · revisada por ${item.reviewerName}` : ""}</p>
                  {item.reviewNotes ? <p className="mt-2 rounded-lg bg-els-raise p-2 text-xs text-els-fg-3">{item.reviewNotes}</p> : null}
                  {canReview ? <LegalTextReviewControls publicId={item.publicId} /> : null}
                </article>
              );
            })}
          </div>
        ) : (
          <p className="mt-5 rounded-xl border border-dashed border-els-line p-6 text-center text-sm text-els-fg-3">Nenhuma compilação integral foi capturada. Aprove uma fotografia de monitoramento e use “Capturar texto consolidado”.</p>
        )}
      </section>

      <section className="mt-5 rounded-[1.5rem] border border-els-line bg-els-surface p-5 sm:p-6">
        <span className="text-xs font-bold uppercase tracking-[.14em] text-els-info-ink">Revisão humana auditada</span><h2 className="mt-2 text-xl font-semibold text-els-fg">Histórico das fotografias</h2>
        {snapshot.snapshots.length ? <div className="mt-5 grid gap-4 xl:grid-cols-2">{snapshot.snapshots.map((item) => {
          const canReview = item.status === "pending_review";
          return <article key={item.publicId} className="rounded-2xl border border-els-line bg-els-sink p-4"><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm text-els-fg">{item.actTitle}</strong><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${item.status === "approved" ? "bg-els-green/10 text-els-green-ink" : item.status === "pending_review" ? "bg-els-amber/10 text-els-amber-ink" : "bg-els-raise text-els-fg-3"}`}>{snapshotLabels[item.status] ?? item.status}</span></div><dl className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-els-fg-3"><div><dt>Tamanho</dt><dd className="mt-0.5 font-semibold text-els-fg-2">{numberFormatter.format(item.contentLength)} caracteres</dd></div><div><dt>Marcadores de artigo</dt><dd className="mt-0.5 font-semibold text-els-fg-2">{numberFormatter.format(item.articleMarkerCount)}</dd></div></dl><p className="mt-3 break-all font-mono text-[10px] text-els-fg-4">SHA-256 {item.checksumSha256}</p><p className="mt-3 text-[11px] leading-5 text-els-fg-4">Lida em {formatDate(item.fetchedAt)} · iniciada por {item.initiatorName ?? "monitor automático"}{item.reviewerName ? ` · revisada por ${item.reviewerName}` : ""}</p>{item.reviewNotes ? <p className="mt-2 rounded-lg bg-els-raise p-2 text-xs text-els-fg-3">{item.reviewNotes}</p> : null}{canReview ? <SnapshotReviewControls publicId={item.publicId} /> : null}</article>;
        })}</div> : <p className="mt-5 rounded-xl border border-dashed border-els-line p-6 text-center text-sm text-els-fg-3">O monitor ainda não registrou fotografias.</p>}
      </section>

      <section className="mt-5 grid gap-5 2xl:grid-cols-[.85fr_1.15fr] [&>*]:min-w-0">
        <article className="rounded-[1.5rem] border border-els-line bg-els-surface p-5 sm:p-6"><span className="text-xs font-bold uppercase tracking-[.14em] text-els-green-ink">Portais oficiais</span><h2 className="mt-2 text-xl font-semibold text-els-fg">Saúde das fontes de prova</h2><p className="mt-2 text-sm leading-6 text-els-fg-3">A verificação lê apenas o necessário para confirmar status, endereço final e título da página.</p><div className="mt-5 space-y-3">{snapshot.portals.map((portal) => <div key={portal.id} className="rounded-xl border border-els-line bg-els-sink p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0 break-words"><strong className="text-sm text-els-fg">{portal.bankName}</strong><p className="mt-1 line-clamp-1 text-[11px] text-els-fg-4">{portal.lastPageTitle ?? portal.officialUrl}</p></div><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${portal.lastHttpStatus && portal.lastHttpStatus < 400 ? "bg-els-green/10 text-els-green-ink" : "bg-els-raise text-els-fg-3"}`}>{portal.lastHttpStatus ?? "não verificado"}</span></div>{portal.lastError ? <p className="mt-2 text-xs text-els-danger-ink">{portal.lastError}</p> : null}<PortalVerifyButton portalId={portal.id} /></div>)}</div></article>

        <article className="rounded-[1.5rem] border border-els-line bg-els-surface p-5 sm:p-6"><span className="text-xs font-bold uppercase tracking-[.14em] text-els-info-ink">Catálogo documental</span><h2 className="mt-2 text-xl font-semibold text-els-fg">Adicionar uma prova sem copiar seu conteúdo</h2><p className="mt-2 text-sm leading-6 text-els-fg-3">O link precisa pertencer ao domínio oficial da banca. O registro nasce como rascunho e não habilita questões anteriores.</p><ExamMetadataForm banks={bankOptions} careers={snapshot.careers} /></article>
      </section>

      <section className="mt-5 rounded-[1.5rem] border border-els-line bg-els-surface p-5 sm:p-6"><div className="flex items-center gap-2"><CheckCircle2 className="size-5 text-els-green-ink" /><h2 className="text-xl font-semibold text-els-fg">Provas catalogadas</h2></div>{snapshot.exams.length ? <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="text-els-fg-4"><tr><th className="pb-3">Prova</th><th className="pb-3">Banca / carreira</th><th className="pb-3">Data</th><th className="pb-3">Fonte</th><th className="pb-3">Conteúdo armazenado</th></tr></thead><tbody>{snapshot.exams.map((exam) => <tr key={exam.publicId} className="border-t border-els-line"><td className="py-3 pr-4 font-semibold text-els-fg-2">{exam.title}</td><td className="py-3 pr-4 text-els-fg-3">{exam.bankName} · {exam.careerName}</td><td className="py-3 pr-4 text-els-fg-3">{exam.examDate.split("-").reverse().join("/")}</td><td className="py-3 pr-4"><a href={exam.officialUrl ?? "#"} target="_blank" rel="noreferrer" className="text-els-amber-ink min-h-11 inline-flex items-center">HTTP {exam.sourceHttpStatus ?? "—"}</a></td><td className="py-3 font-bold text-els-green-ink">{exam.sourceContentStored ? "Sim" : "Não — só metadados"}</td></tr>)}</tbody></table></div> : <p className="mt-5 rounded-xl border border-dashed border-els-line p-6 text-center text-sm text-els-fg-3">Nenhuma prova catalogada ainda.</p>}</section>
    </main>
  );
}
