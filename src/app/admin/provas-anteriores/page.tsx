import Link from "next/link";
import {
  CheckCircle2,
  ExternalLink,
  FileCheck2,
  FileClock,
  FileText,
  Link2,
  ShieldCheck,
} from "lucide-react";

import {
  ExamDocumentForm,
  ExamDocumentReviewControls,
  LicensedPreviousExamImportForm,
  LicensedPreviousExamReviewControls,
  ProductExamReferenceForm,
  ProductExamReferenceReviewControls,
  RevokeExamDocumentControls,
  RevokeProductExamReferenceControls,
  SuspendPreviousExamQuestionForm,
} from "@/components/admin/previous-exam-actions";
import { requireSuperAdmin } from "@/lib/auth";
import { CONTEST_CATALOG, contestTitle } from "@/lib/commerce/catalog";
import { getPreviousExamsAdminSnapshot } from "@/lib/db/previous-exams-admin";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

function formatDate(value: Date | string | null) {
  if (!value) return "não informada";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime())
    ? "não informada"
    : dateFormatter.format(date);
}

function productName(slug: string) {
  const product = CONTEST_CATALOG.find((item) => item.slug === slug);
  return product ? contestTitle(product) : slug;
}

const statusLabel: Record<string, string> = {
  pending_review: "Aguardando revisão",
  approved: "Aprovado",
  superseded: "Substituído",
  rejected: "Rejeitado",
};

const licenseStatusLabel: Record<string, string> = {
  prepared: "Pedido preparado",
  awaiting_response: "Aguardando resposta",
  granted_pending_review: "Concedida; evidência em revisão",
  granted: "Licença validada",
  denied: "Negada",
  expired: "Expirada",
  manual_review: "Intervenção necessária",
  cancelled: "Cancelada",
};

export default async function PreviousExamsAdminPage() {
  const user = await requireSuperAdmin("/admin/provas-anteriores");
  const snapshot = await getPreviousExamsAdminSnapshot();
  const examOptions = snapshot.exams.map((exam) => ({
    publicId: exam.publicId,
    title: exam.title,
    examDate: exam.examDate,
    bankName: exam.bankName,
    institutionAcronym: exam.institutionAcronym,
    jurisdictionCode: exam.jurisdictionCode,
    careerName: exam.careerName,
    specializationName: exam.specializationName,
  }));
  const productOptions = snapshot.products.map((product) => ({
    slug: product.slug,
    opportunityTitle: product.opportunityTitle,
    opportunityEditorialStatus: product.opportunityEditorialStatus,
  }));
  const approvedDocuments = snapshot.documents.filter(
    (document) =>
      document.status === "approved",
  );
  const referenceDocumentOptions = approvedDocuments.map(
    (document) => ({
      publicId: document.publicId,
      examPublicId: document.examPublicId,
      title: document.title,
      status: document.status,
      documentType: document.documentType,
      sourcePolicy: document.sourcePolicy,
    }),
  );
  const importDocumentOptions = approvedDocuments
    .filter((document) => document.sourcePolicy === "licensed_content")
    .map((document) => ({
      publicId: document.publicId,
      examPublicId: document.examPublicId,
      examTitle: document.examTitle,
      careerTrackId: document.careerTrackId,
      title: document.title,
      status: document.status,
      documentType: document.documentType,
      sourcePolicy: document.sourcePolicy,
      expectedQuestionCount: document.expectedQuestionCount,
      rightsHolder: document.rightsHolder,
      licenseReference: document.licenseReference,
      licenseEvidenceChecksumSha256:
        document.licenseEvidenceChecksumSha256,
    }));
  const subjectOptions = snapshot.subjects.map((subject) => ({
    careerTrackId: subject.careerTrackId,
    subjectId: subject.subjectId,
    subjectName: subject.subjectName,
  }));
  const reviewBatchDtos = snapshot.reviewBatches.map((batch) => ({
    batchPublicId: batch.batchPublicId,
    documentPublicId: batch.documentPublicId,
    documentTitle: batch.documentTitle,
    answerKeyDocumentPublicId: batch.answerKeyDocumentPublicId,
    answerKeyDocumentTitle: batch.answerKeyDocumentTitle,
    canApprove: batch.importedByUserId !== user.id,
    expectedQuestionCount: batch.expectedQuestionCount,
    rightsHolder: batch.rightsHolder,
    licenseEvidenceUrl: batch.licenseEvidenceUrl,
    licenseEvidenceVersion: batch.licenseEvidenceVersion,
    answerKeyLicenseEvidenceUrl: batch.answerKeyLicenseEvidenceUrl,
    answerKeyLicenseEvidenceVersion:
      batch.answerKeyLicenseEvidenceVersion,
    fingerprint: batch.fingerprint,
    questions: batch.questions.map((question) => ({
      id: question.id,
      publicId: question.publicId,
      type: question.type,
      prompt: question.prompt,
      explanation: question.explanation,
      topic: question.topic,
      difficulty: question.difficulty,
      originalQuestionNumber: question.originalQuestionNumber,
      originalQuestionOrder: question.originalQuestionOrder,
      subjectId: question.subjectId,
    })),
    options: batch.options.map((option) => ({
      questionId: option.questionId,
      optionKey: option.optionKey,
      text: option.text,
      isCorrect: option.isCorrect,
      rationale: option.rationale,
      sortOrder: option.sortOrder,
    })),
  }));
  const metrics = [
    {
      label: "Edições históricas",
      value: snapshot.metrics.editions,
      icon: FileText,
      tone: "text-sky-300 bg-sky-300/10",
    },
    {
      label: "Documentos pendentes",
      value: snapshot.metrics.documentsPending,
      icon: FileClock,
      tone: "text-amber-300 bg-amber-300/10",
    },
    {
      label: "Links aprovados",
      value: snapshot.metrics.documentsApproved,
      icon: Link2,
      tone: "text-emerald-300 bg-emerald-300/10",
    },
    {
      label: "Documentos com licença",
      value: snapshot.metrics.licensedDocumentsApproved,
      icon: ShieldCheck,
      tone: "text-violet-300 bg-violet-300/10",
    },
    {
      label: "Vínculos pendentes",
      value: snapshot.metrics.referencesPending,
      icon: FileCheck2,
      tone: "text-orange-300 bg-orange-300/10",
    },
    {
      label: "Produtos com última prova",
      value: snapshot.metrics.productsWithApprovedReference,
      icon: CheckCircle2,
      tone: "text-emerald-300 bg-emerald-300/10",
    },
  ];

  return (
    <main className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-7 lg:px-9 lg:py-9">
      <header className="relative overflow-hidden rounded-[1.75rem] border border-sky-300/15 bg-[linear-gradient(145deg,#101a27_0%,#071521_58%,#0b201d_100%)] p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-28 size-72 rounded-full bg-sky-300/8 blur-3xl" />
        <div className="relative max-w-4xl">
          <span className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.17em] text-sky-300">
            <ShieldCheck className="size-3.5" /> Provas anteriores
          </span>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-.045em] text-white sm:text-4xl">
            Uma edição, uma banca, um cargo e uma licença.
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400 sm:text-base">
            O link do PDF oficial e o direito de reproduzir questões são duas
            decisões separadas. Cada proposta nasce pendente, exige outra conta
            revisora e nunca abre vendas ou publica questões automaticamente.
          </p>
          <div className="mt-5 flex flex-wrap gap-3 text-xs font-semibold text-slate-300">
            <span>Somente domínios oficiais cadastrados</span>
            <span>•</span>
            <span>Cópia hospedada bloqueada sem licença escrita</span>
            <span>•</span>
            <span>Stripe continua subordinada aos gates</span>
          </div>
        </div>
      </header>

      <section
        className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
        aria-label="Indicadores de provas anteriores"
      >
        {metrics.map(({ label, value, icon: Icon, tone }) => (
          <article
            key={label}
            className="rounded-2xl border border-white/8 bg-[#09131f] p-4"
          >
            <div className={`grid size-9 place-items-center rounded-xl ${tone}`}>
              <Icon className="size-4" />
            </div>
            <p className="mt-4 text-2xl font-semibold text-white">{value}</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">{label}</p>
          </article>
        ))}
      </section>

      <section className="mt-5 rounded-2xl border border-violet-300/15 bg-[#0b1220] p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[.17em] text-violet-300">
              Licenciamento automatizado
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              Pedidos e acompanhamentos por edição
            </h2>
          </div>
          <p className="text-sm text-slate-400">
            {snapshot.metrics.licenseRequestsOpen} em andamento · {snapshot.metrics.licenseRequestsGranted} validadas
          </p>
        </div>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-400">
          O motor prepara um pedido apenas quando existe caderno e gabarito oficiais
          exatos, envia e cobra resposta em ciclos auditáveis. Nenhum envio, silêncio
          ou link público é convertido em licença. A resposta escrita ainda precisa
          ser registrada e conferida antes da reprodução.
        </p>
        {snapshot.licenseRequests.length ? (
          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {snapshot.licenseRequests.map((request) => (
              <article key={request.publicId} className="rounded-xl border border-white/10 bg-black/10 p-4">
                <p className="font-semibold text-violet-100">{request.editionTitle}</p>
                <p className="mt-1 text-xs text-slate-500">{request.bankName} · {request.editionPublicId}</p>
                <dl className="mt-3 grid gap-2 text-xs text-slate-300 sm:grid-cols-2">
                  <div><dt className="text-slate-500">Situação</dt><dd>{licenseStatusLabel[request.status] ?? request.status}</dd></div>
                  <div><dt className="text-slate-500">Acompanhamentos</dt><dd>{request.followUpCount} / 3</dd></div>
                  <div><dt className="text-slate-500">Pedido enviado</dt><dd>{formatDate(request.requestedAt)}</dd></div>
                  <div><dt className="text-slate-500">Próxima ação</dt><dd>{formatDate(request.nextFollowUpAt)}</dd></div>
                </dl>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-5 text-sm text-amber-100">
            Nenhum caso foi preparado ainda: aprove primeiro os links oficiais do
            caderno e do gabarito da edição histórica.
          </p>
        )}
      </section>

      {snapshot.metrics.productsWithoutOpportunity > 0 ? (
        <p className="mt-5 rounded-xl border border-amber-300/15 bg-amber-300/[.045] px-4 py-3 text-xs leading-5 text-amber-100">
          <strong>{snapshot.metrics.productsWithoutOpportunity} produto(s)</strong>{" "}
          ainda não possuem uma oportunidade oficial vinculada e, por isso, não
          podem receber prova anterior nem ser vendidos.
        </p>
      ) : null}

      <section className="mt-5 grid gap-5 2xl:grid-cols-2">
        <article className="rounded-[1.5rem] border border-white/8 bg-[#09131f] p-5 sm:p-6">
          <span className="text-xs font-bold uppercase tracking-[.14em] text-sky-300">
            1 · Documento oficial
          </span>
          <h2 className="mt-2 text-xl font-semibold text-white">
            Cadastrar caderno ou gabarito
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Nesta etapa o sistema conserva apenas o link externo. Para uma edição
            nova, cadastre primeiro seus metadados em{" "}
            <Link
              href="/admin/fontes-oficiais"
              className="font-bold text-sky-300"
            >
              Fontes oficiais
            </Link>
            .
          </p>
          <ExamDocumentForm exams={examOptions} />
        </article>

        <article className="rounded-[1.5rem] border border-white/8 bg-[#09131f] p-5 sm:p-6">
          <span className="text-xs font-bold uppercase tracking-[.14em] text-amber-300">
            2 · Produto exato
          </span>
          <h2 className="mt-2 text-xl font-semibold text-white">
            Vincular a última prova do cargo
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            O servidor revalida banca, carreira, especialidade, data histórica,
            oportunidade revisada e caderno aprovado. Sem coincidência exata, o
            vínculo é recusado.
          </p>
          <ProductExamReferenceForm
            products={productOptions}
            exams={examOptions}
            documents={referenceDocumentOptions}
          />
        </article>
      </section>

      <section className="mt-5 rounded-[1.5rem] border border-violet-300/15 bg-[#09131f] p-5 sm:p-6">
        <span className="text-xs font-bold uppercase tracking-[.14em] text-violet-300">
          3 · Entrada licenciada
        </span>
        <h2 className="mt-2 text-xl font-semibold text-white">
          Importar o caderno completo para revisão
        </h2>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-500">
          Esta etapa aceita somente um documento já aprovado com licença escrita
          e URL de evidência. A fonte, a licença e a versão são relidas do banco;
          o JSON não pode substituí-las. Todo o lote entra de forma atômica como
          pendente e ainda exige revisor humano diferente do importador.
        </p>
        <LicensedPreviousExamImportForm
          documents={importDocumentOptions}
          subjects={subjectOptions}
        />
      </section>

      <section className="mt-5 rounded-[1.5rem] border border-emerald-300/15 bg-[#09131f] p-5 sm:p-6">
        <span className="text-xs font-bold uppercase tracking-[.14em] text-emerald-300">
          4 · Revisão independente
        </span>
        <h2 className="mt-2 text-xl font-semibold text-white">
          Conferir o lote real inteiro
        </h2>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-500">
          A decisão é atômica: se uma questão, alternativa, matéria, licença ou
          impressão do dossiê mudar, o lote inteiro permanece pendente. Quem
          importou não pode revisar. Expandir cada item é parte obrigatória da
          conferência humana.
        </p>
        <div className="mt-5 space-y-5">
          {reviewBatchDtos.map((batch) => {
            return (
              <article
                key={batch.batchPublicId}
                className="rounded-2xl border border-white/8 bg-black/10 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <strong className="text-sm text-white">
                      {batch.documentTitle} + {batch.answerKeyDocumentTitle}
                    </strong>
                    <p className="mt-1 text-xs text-slate-500">
                      {batch.questions.length} de {batch.expectedQuestionCount} questões ·
                      titular {batch.rightsHolder}
                    </p>
                  </div>
                  <a
                    href={batch.licenseEvidenceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-violet-300"
                  >
                    Evidência da licença <ExternalLink className="size-3.5" />
                  </a>
                  <a
                    href={batch.answerKeyLicenseEvidenceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-violet-300"
                  >
                    Evidência do gabarito <ExternalLink className="size-3.5" />
                  </a>
                </div>
                <p className="mt-2 break-all text-[10px] text-slate-600">
                  Lote {batch.batchPublicId} · SHA-256 caderno{" "}
                  {batch.licenseEvidenceVersion} · SHA-256 gabarito{" "}
                  {batch.answerKeyLicenseEvidenceVersion}
                </p>
                <LicensedPreviousExamReviewControls batch={batch} />
              </article>
            );
          })}
          {reviewBatchDtos.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/10 p-6 text-sm text-slate-500">
              Nenhum caderno licenciado aguarda revisão integral.
            </p>
          ) : null}
        </div>
      </section>

      <section className="mt-5 rounded-[1.5rem] border border-rose-300/15 bg-[#09131f] p-5 sm:p-6">
        <span className="text-xs font-bold uppercase tracking-[.14em] text-rose-300">
          Trava de emergência
        </span>
        <h2 className="mt-2 text-xl font-semibold text-white">
          Revogar fonte, vínculo ou questão real
        </h2>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-500">
          Use quando uma licença for rescindida, uma fonte sair do ar ou houver
          dúvida jurídica/editorial. A retirada é imediata, derruba o gate de
          venda e fica registrada na auditoria. Para renovar direitos, suspenda
          a versão anterior e submeta uma nova versão ao fluxo independente.
        </p>

        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {snapshot.documents
            .filter((document) => document.status === "approved")
            .map((document) => (
              <article
                key={document.publicId}
                className="rounded-2xl border border-white/8 bg-black/10 p-4"
              >
                <strong className="text-sm text-white">{document.title}</strong>
                <p className="mt-1 text-xs text-slate-500">
                  {document.bankName} · {document.examTitle} ·{" "}
                  {document.documentType === "question_booklet"
                    ? `${document.expectedQuestionCount ?? "?"} questões`
                    : "gabarito"}
                </p>
                <RevokeExamDocumentControls publicId={document.publicId} />
              </article>
            ))}
          {snapshot.references
            .filter((reference) => reference.status === "approved")
            .map((reference) => (
              <article
                key={reference.publicId}
                className="rounded-2xl border border-white/8 bg-black/10 p-4"
              >
                <strong className="text-sm text-white">
                  {productName(reference.productSlug)}
                </strong>
                <p className="mt-1 text-xs text-slate-500">
                  {reference.examTitle} · {reference.documentTitle}
                </p>
                <RevokeProductExamReferenceControls
                  publicId={reference.publicId}
                />
              </article>
            ))}
        </div>

        <div className="mt-5 rounded-2xl border border-white/8 bg-black/10 p-4">
          <h3 className="text-sm font-semibold text-white">
            Suspender uma questão real específica
          </h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            A versão suspensa permanece no histórico e libera a mesma ordem da
            prova para uma nova versão licenciada e revisada.
          </p>
          <SuspendPreviousExamQuestionForm />
        </div>
      </section>

      <section className="mt-5 rounded-[1.5rem] border border-white/8 bg-[#09131f] p-5 sm:p-6">
        <span className="text-xs font-bold uppercase tracking-[.14em] text-amber-300">
          Revisão independente · documentos
        </span>
        <h2 className="mt-2 text-xl font-semibold text-white">
          Fontes e licenças pendentes
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          Quem cadastrou não pode aprovar o próprio item. A URL é consultada de
          novo no momento da decisão e a nota fica no histórico de auditoria.
        </p>
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {snapshot.documents
            .filter((document) => document.status === "pending_review")
            .map((document) => {
              const canApprove = document.initiatedByUserId !== user.id;
              return (
                <article
                  key={document.publicId}
                  className="rounded-2xl border border-white/8 bg-black/10 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <strong className="text-sm text-white">{document.title}</strong>
                      <p className="mt-1 text-xs text-slate-500">
                        {document.bankName} · {document.examTitle}
                        {document.documentType === "question_booklet"
                          ? ` · ${document.expectedQuestionCount ?? "?"} questões`
                          : ""}
                      </p>
                    </div>
                    <span className="rounded-full bg-amber-300/10 px-2.5 py-1 text-[10px] font-bold text-amber-200">
                      {document.documentType === "question_booklet"
                        ? "Caderno"
                        : "Gabarito"}
                    </span>
                  </div>
                  <a
                    href={document.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-sky-300"
                  >
                    Abrir fonte · HTTP {document.httpStatus}{" "}
                    <ExternalLink className="size-3.5" />
                  </a>
                  <div className="mt-3 space-y-1 break-words text-[11px] leading-5 text-slate-500">
                    {document.sourcePolicy === "licensed_content" ? (
                      <>
                        <p><strong className="text-slate-300">Titular:</strong> {document.rightsHolder}</p>
                        <p><strong className="text-slate-300">Base integral:</strong> {document.licenseBasis}</p>
                        <p><strong className="text-slate-300">Concessão:</strong> {formatDate(document.licensedAt)} · <strong className="text-slate-300">validade:</strong> {formatDate(document.licenseExpiresAt)}</p>
                        <p><strong className="text-slate-300">Referência documental:</strong> {document.licenseReference}</p>
                        <p className="break-all"><strong className="text-slate-300">SHA-256 da autorização:</strong> {document.licenseEvidenceChecksumSha256}</p>
                        <p><strong className="text-slate-300">Evidência conferida em:</strong> {formatDate(document.licenseEvidenceCheckedAt)}</p>
                      </>
                    ) : (
                      <p>Somente link externo; não autoriza copiar ou transcrever questões.</p>
                    )}
                    <p>Proposta por {document.initiatorName ?? "rotina interna"} em {formatDate(document.createdAt)}.</p>
                  </div>
                  <ExamDocumentReviewControls
                    publicId={document.publicId}
                    dossierFingerprint={document.reviewFingerprint}
                    canApprove={canApprove}
                  />
                </article>
              );
            })}
          {snapshot.metrics.documentsPending === 0 ? (
            <p className="rounded-xl border border-dashed border-white/10 p-6 text-sm text-slate-500">
              Nenhum documento aguardando decisão.
            </p>
          ) : null}
        </div>
      </section>

      <section className="mt-5 rounded-[1.5rem] border border-white/8 bg-[#09131f] p-5 sm:p-6">
        <span className="text-xs font-bold uppercase tracking-[.14em] text-emerald-300">
          Revisão independente · produto
        </span>
        <h2 className="mt-2 text-xl font-semibold text-white">
          Última prova proposta por concurso
        </h2>
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {snapshot.references
            .filter((reference) => reference.status === "pending_review")
            .map((reference) => {
              const canApprove = reference.initiatedByUserId !== user.id;
              return (
                <article
                  key={reference.publicId}
                  className="rounded-2xl border border-white/8 bg-black/10 p-4"
                >
                  <strong className="text-sm text-white">
                    {productName(reference.productSlug)}
                  </strong>
                  <p className="mt-2 text-xs leading-5 text-slate-400">
                    {reference.examTitle} · {reference.examDate}
                  </p>
                  <a
                    href={reference.documentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-sky-300"
                  >
                    {reference.documentTitle}{" "}
                    <ExternalLink className="size-3.5" />
                  </a>
                  <a
                    href={reference.answerKeyDocumentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-3 mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-violet-300"
                  >
                    {reference.answerKeyDocumentTitle}{" "}
                    <ExternalLink className="size-3.5" />
                  </a>
                  <p className="mt-3 text-[11px] text-slate-600">
                    Identidade verificada em{" "}
                    {formatDate(reference.selectionVerifiedAt)} · proposta por{" "}
                    {reference.initiatorName ?? "rotina interna"}.
                  </p>
                  <ProductExamReferenceReviewControls
                    publicId={reference.publicId}
                    canApprove={canApprove}
                  />
                </article>
              );
            })}
          {snapshot.metrics.referencesPending === 0 ? (
            <p className="rounded-xl border border-dashed border-white/10 p-6 text-sm text-slate-500">
              Nenhum vínculo aguardando decisão.
            </p>
          ) : null}
        </div>
      </section>

      <section className="mt-5 rounded-[1.5rem] border border-white/8 bg-[#09131f] p-5 sm:p-6">
        <h2 className="text-xl font-semibold text-white">Histórico dos vínculos</h2>
        {snapshot.references.length ? (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-xs">
              <thead className="text-slate-600">
                <tr>
                  <th className="pb-3">Produto</th>
                  <th className="pb-3">Edição / caderno</th>
                  <th className="pb-3">Direitos do PDF</th>
                  <th className="pb-3">Situação</th>
                  <th className="pb-3">Revisão</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.references.map((reference) => (
                  <tr key={reference.publicId} className="border-t border-white/7">
                    <td className="py-3 pr-4 font-semibold text-slate-200">
                      {productName(reference.productSlug)}
                    </td>
                    <td className="py-3 pr-4 text-slate-400">
                      {reference.examTitle} · {reference.documentTitle}
                    </td>
                    <td className="py-3 pr-4 text-slate-400">
                      {reference.documentSourcePolicy === "licensed_content"
                        ? "Licença registrada"
                        : "Link externo"}
                    </td>
                    <td className="py-3 pr-4 font-bold text-amber-200">
                      {statusLabel[reference.status] ?? reference.status}
                    </td>
                    <td className="py-3 text-slate-500">
                      {reference.reviewerName ?? "—"} ·{" "}
                      {formatDate(reference.reviewedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-5 rounded-xl border border-dashed border-white/10 p-6 text-sm text-slate-500">
            Ainda não existem vínculos entre produtos e provas anteriores.
          </p>
        )}
      </section>
    </main>
  );
}
