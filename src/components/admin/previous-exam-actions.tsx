"use client";

import { useActionState, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  FileJson2,
  Link2,
  RotateCcw,
} from "lucide-react";

import {
  createExamDocumentAction,
  createProductExamReferenceAction,
  importLicensedPreviousExamBookletAction,
  recordExamLicenseDecisionAction,
  revokeExamDocumentAction,
  revokeProductExamReferenceAction,
  reviewExamDocumentAction,
  reviewLicensedPreviousExamBookletAction,
  reviewProductExamReferenceAction,
  suspendPreviousExamQuestionAction,
  type PreviousExamActionState,
} from "@/app/admin/provas-anteriores/actions";

const initialState: PreviousExamActionState = {
  status: "idle",
  message: "",
};

const field =
  "mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-[#07111d] px-3 text-sm text-slate-200 outline-none focus:border-sky-300/40";

function Feedback({ state }: { state: PreviousExamActionState }) {
  return state.message ? (
    <p
      aria-live="polite"
      className={`mt-3 text-xs leading-5 ${
        state.status === "success" ? "text-emerald-200" : "text-rose-200"
      }`}
    >
      {state.message}
    </p>
  ) : null;
}

export function ExamLicenseDecisionControls({
  publicId,
  canDecide,
}: {
  publicId: string;
  canDecide: boolean;
}) {
  const [state, action, pending] = useActionState(
    recordExamLicenseDecisionAction,
    initialState,
  );
  return (
    <form action={action} className="mt-4 grid gap-3 rounded-xl border border-white/8 p-3 sm:grid-cols-2">
      <input type="hidden" name="publicId" value={publicId} />
      <label className="text-[11px] font-semibold text-slate-400 sm:col-span-2">
        URL HTTPS da resposta ou contrato arquivado
        <input type="url" name="responseReference" required maxLength={2000} className={field} />
      </label>
      <label className="text-[11px] font-semibold text-slate-400 sm:col-span-2">
        SHA-256 do arquivo conferido
        <input
          name="responseChecksumSha256"
          required
          minLength={64}
          maxLength={64}
          pattern="[A-Fa-f0-9]{64}"
          spellCheck={false}
          className={`${field} font-mono`}
        />
      </label>
      <label className="text-[11px] font-semibold text-slate-400">
        Resposta recebida em
        <input type="date" name="responseReceivedAt" required className={field} />
      </label>
      <label className="text-[11px] font-semibold text-slate-400">
        Concedida em
        <input type="date" name="grantedAt" className={field} />
      </label>
      <label className="text-[11px] font-semibold text-slate-400">
        Validade, se houver
        <input type="date" name="expiresAt" className={field} />
      </label>
      <label className="text-[11px] font-semibold text-slate-400 sm:col-span-2">
        Parecer da conferência
        <textarea name="notes" required minLength={20} maxLength={2000} className={`${field} min-h-20 py-3`} />
      </label>
      <label className="flex items-start gap-2 text-[11px] leading-5 text-slate-300 sm:col-span-2">
        <input type="checkbox" name="attestation" className="mt-1 size-4 accent-violet-300" />
        <span>
          Conferi titular, documentos, uso comercial, reprodução, armazenamento,
          atribuição, território, prazo, revogação e integridade do arquivo.
        </span>
      </label>
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <button
          name="decision"
          value="grant"
          disabled={pending || !canDecide}
          className="min-h-9 rounded-lg bg-violet-300 px-3 text-xs font-extrabold text-violet-950 disabled:opacity-50"
        >
          Registrar concessão
        </button>
        <button
          name="decision"
          value="deny"
          disabled={pending || !canDecide}
          className="min-h-9 rounded-lg border border-rose-300/20 bg-rose-300/8 px-3 text-xs font-bold text-rose-100 disabled:opacity-50"
        >
          Registrar negativa
        </button>
      </div>
      {!canDecide ? (
        <p className="text-[11px] text-slate-500 sm:col-span-2">
          Outra conta editorial precisa revisar a resposta deste pedido.
        </p>
      ) : null}
      <div className="sm:col-span-2"><Feedback state={state} /></div>
    </form>
  );
}

type ExamOption = {
  publicId: string;
  title: string;
  examDate: string;
  bankName: string;
  institutionAcronym: string | null;
  jurisdictionCode: string | null;
  careerName: string;
  specializationName: string | null;
};

export function ExamDocumentForm({ exams }: { exams: readonly ExamOption[] }) {
  const [state, action, pending] = useActionState(
    createExamDocumentAction,
    initialState,
  );
  const [sourcePolicy, setSourcePolicy] = useState<
    "metadata_only" | "licensed_content"
  >("metadata_only");
  const [documentType, setDocumentType] = useState<
    "question_booklet" | "answer_key"
  >("question_booklet");

  return (
    <form action={action} className="mt-5 grid gap-4 md:grid-cols-2">
      <label className="text-xs font-semibold text-slate-400 md:col-span-2">
        Edição histórica
        <select name="examPublicId" required className={field}>
          <option value="">Selecione a edição exata</option>
          {exams.map((exam) => (
            <option key={exam.publicId} value={exam.publicId}>
              {exam.examDate} · {exam.bankName} · {exam.careerName}
              {exam.specializationName ? ` / ${exam.specializationName}` : ""} ·{" "}
              {exam.institutionAcronym ?? "órgão pendente"}/
              {exam.jurisdictionCode ?? "UF pendente"} · {exam.title}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs font-semibold text-slate-400">
        Tipo
        <select
          name="documentType"
          required
          className={field}
          value={documentType}
          onChange={(event) =>
            setDocumentType(
              event.target.value as "question_booklet" | "answer_key",
            )
          }
        >
          <option value="question_booklet">Caderno de questões</option>
          <option value="answer_key">Gabarito</option>
        </select>
      </label>
      {documentType === "question_booklet" ? (
        <label className="text-xs font-semibold text-slate-400">
          Total de questões no caderno
          <input
            type="number"
            name="expectedQuestionCount"
            required
            min={1}
            max={300}
            inputMode="numeric"
            className={field}
          />
        </label>
      ) : null}
      <label className="text-xs font-semibold text-slate-400">
        Situação dos direitos
        <select
          name="sourcePolicy"
          required
          className={field}
          value={sourcePolicy}
          onChange={(event) =>
            setSourcePolicy(
              event.target.value as "metadata_only" | "licensed_content",
            )
          }
        >
          <option value="metadata_only">Somente link oficial</option>
          <option value="licensed_content">Licença escrita registrada</option>
        </select>
      </label>
      <label className="text-xs font-semibold text-slate-400 md:col-span-2">
        Título do documento
        <input name="title" required minLength={3} maxLength={500} className={field} />
      </label>
      <label className="text-xs font-semibold text-slate-400 md:col-span-2">
        URL direta no domínio oficial da banca
        <input
          type="url"
          name="sourceUrl"
          required
          maxLength={2000}
          placeholder="https://…/caderno.pdf"
          className={field}
        />
      </label>
      {sourcePolicy === "licensed_content" ? (
        <>
          <label className="text-xs font-semibold text-slate-400">
            Titular que licenciou
            <input name="rightsHolder" required maxLength={500} className={field} />
          </label>
          <label className="text-xs font-semibold text-slate-400">
            Referência documental da licença
            <input
              type="url"
              name="licenseReference"
              required
              maxLength={1000}
              placeholder="https://…/contrato-ou-autorizacao (não será acessada pelo sistema)"
              className={field}
            />
          </label>
          <label className="text-xs font-semibold text-slate-400 md:col-span-2">
            Base e escopo da autorização
            <textarea
              name="licenseBasis"
              required
              maxLength={2000}
              className={`${field} min-h-24 py-3`}
              placeholder="Identifique o contrato e confirme reprodução, área paga, armazenamento e automação."
            />
          </label>
          <label className="text-xs font-semibold text-slate-400">
            Licenciada em
            <input type="date" name="licensedAt" required className={field} />
          </label>
          <label className="text-xs font-semibold text-slate-400">
            Validade (se houver)
            <input type="date" name="licenseExpiresAt" className={field} />
          </label>
          <label className="text-xs font-semibold text-slate-400 md:col-span-2">
            SHA-256 do arquivo de autorização conferido
            <input
              name="licenseEvidenceChecksumSha256"
              required
              minLength={64}
              maxLength={64}
              pattern="[A-Fa-f0-9]{64}"
              spellCheck={false}
              className={`${field} font-mono`}
              placeholder="64 caracteres hexadecimais"
            />
          </label>
          <label className="text-xs font-semibold text-slate-400">
            Evidência conferida em
            <input
              type="date"
              name="licenseEvidenceCheckedAt"
              required
              className={field}
            />
          </label>
        </>
      ) : null}
      <div className="md:col-span-2">
        <button
          disabled={pending}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-sky-300 px-5 text-sm font-extrabold text-sky-950 disabled:opacity-50"
        >
          <Link2 className="size-4" />
          {pending ? "Validando fonte…" : "Registrar para revisão"}
        </button>
        <Feedback state={state} />
      </div>
    </form>
  );
}

function ReviewControls({
  publicId,
  action,
  approveLabel,
  canApprove = true,
  dossierFingerprint,
  requiresLegalAttestation = false,
}: {
  publicId: string;
  action: typeof reviewExamDocumentAction;
  approveLabel: string;
  canApprove?: boolean;
  dossierFingerprint?: string;
  requiresLegalAttestation?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  return (
    <form action={formAction} className="mt-4 rounded-xl border border-white/8 p-3">
      <input type="hidden" name="publicId" value={publicId} />
      {dossierFingerprint ? (
        <input
          type="hidden"
          name="dossierFingerprint"
          value={dossierFingerprint}
        />
      ) : null}
      <label className="text-[11px] font-semibold text-slate-400">
        Nota da conferência humana
        <textarea
          name="notes"
          required
          minLength={20}
          maxLength={2000}
          className={`${field} min-h-20 py-3`}
          placeholder="Registre banca, cargo, data, URL e o que foi conferido nos direitos."
        />
      </label>
      {requiresLegalAttestation ? (
        <label className="mt-3 flex items-start gap-2 text-[11px] leading-5 text-slate-300">
          <input
            type="checkbox"
            name="licenseReviewAttestation"
            className="mt-1 size-4 accent-emerald-300"
          />
          <span>
            Conferi juridicamente o titular, o escopo integral, as datas, a
            referência e o SHA-256 da autorização exibida. Esta declaração é
            obrigatória somente para aprovar.
          </span>
        </label>
      ) : null}
      <Feedback state={state} />
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          name="decision"
          value="approve"
          disabled={pending || !canApprove}
          className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-emerald-300 px-3 text-xs font-extrabold text-emerald-950 disabled:opacity-50"
        >
          <Check className="size-3.5" />
          {approveLabel}
        </button>
        <button
          name="decision"
          value="reject"
          disabled={pending}
          className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-rose-300/20 bg-rose-300/8 px-3 text-xs font-bold text-rose-100 disabled:opacity-50"
        >
          <RotateCcw className="size-3.5" />
          Rejeitar
        </button>
      </div>
      {!canApprove ? (
        <p className="mt-2 text-[11px] text-slate-500">
          Você pode rejeitar esta proposta, mas outra conta administrativa deve
          aprová-la.
        </p>
      ) : null}
    </form>
  );
}

export function ExamDocumentReviewControls({
  publicId,
  dossierFingerprint,
  canApprove,
}: {
  publicId: string;
  dossierFingerprint: string;
  canApprove: boolean;
}) {
  return (
    <ReviewControls
      publicId={publicId}
      action={reviewExamDocumentAction}
      approveLabel="Aprovar documento"
      canApprove={canApprove}
      dossierFingerprint={dossierFingerprint}
      requiresLegalAttestation
    />
  );
}

type ProductOption = {
  slug: string;
  opportunityTitle: string | null;
  opportunityEditorialStatus: string | null;
};

type DocumentOption = {
  publicId: string;
  examPublicId: string;
  examTitle?: string;
  careerTrackId?: number;
  title: string;
  status: string;
  documentType: string;
  sourcePolicy: string;
  expectedQuestionCount?: number | null;
  rightsHolder?: string | null;
  licenseBasis?: string | null;
  licenseReference?: string | null;
  licenseEvidenceChecksumSha256?: string | null;
  licenseEvidenceCheckedAt?: string | null;
  licensedAt?: string | null;
  licenseExpiresAt?: string | null;
};

export function ProductExamReferenceForm({
  products,
  exams,
  documents,
}: {
  products: readonly ProductOption[];
  exams: readonly ExamOption[];
  documents: readonly DocumentOption[];
}) {
  const [state, action, pending] = useActionState(
    createProductExamReferenceAction,
    initialState,
  );
  const [examPublicId, setExamPublicId] = useState("");
  const availableBooklets = useMemo(
    () =>
      documents.filter(
        (document) =>
          document.examPublicId === examPublicId &&
          document.status === "approved" &&
          document.documentType === "question_booklet",
      ),
    [documents, examPublicId],
  );
  const availableAnswerKeys = useMemo(
    () =>
      documents.filter(
        (document) =>
          document.examPublicId === examPublicId &&
          document.status === "approved" &&
          document.documentType === "answer_key",
      ),
    [documents, examPublicId],
  );

  return (
    <form action={action} className="mt-5 grid gap-4 md:grid-cols-2">
      <label className="text-xs font-semibold text-slate-400 md:col-span-2">
        Produto com oportunidade revisada
        <select name="productSlug" required className={field}>
          <option value="">Selecione</option>
          {products.map((product) => (
            <option key={product.slug} value={product.slug}>
              {product.slug} · {product.opportunityTitle ?? "sem oportunidade"} ·{" "}
              {product.opportunityEditorialStatus ?? "não revisada"}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs font-semibold text-slate-400">
        Edição histórica
        <select
          name="examPublicId"
          required
          className={field}
          value={examPublicId}
          onChange={(event) => setExamPublicId(event.target.value)}
        >
          <option value="">Selecione</option>
          {exams.map((exam) => (
            <option key={exam.publicId} value={exam.publicId}>
              {exam.examDate} · {exam.bankName} · {exam.title}
              {exam.institutionAcronym
                ? ` · ${exam.institutionAcronym}/${exam.jurisdictionCode ?? "?"}`
                : ""}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs font-semibold text-slate-400">
        Caderno principal aprovado
        <select name="documentPublicId" required className={field}>
          <option value="">Selecione</option>
          {availableBooklets.map((document) => (
            <option key={document.publicId} value={document.publicId}>
              {document.title} ·{" "}
              {document.sourcePolicy === "licensed_content"
                ? "licença registrada"
                : "link externo"}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs font-semibold text-slate-400">
        Gabarito oficial exato e aprovado
        <select name="answerKeyDocumentPublicId" required className={field}>
          <option value="">Selecione</option>
          {availableAnswerKeys.map((document) => (
            <option key={document.publicId} value={document.publicId}>
              {document.title} ·{" "}
              {document.sourcePolicy === "licensed_content"
                ? "licença registrada"
                : "link externo"}
            </option>
          ))}
        </select>
      </label>
      <div className="md:col-span-2">
        <button
          disabled={pending}
          className="min-h-11 rounded-xl bg-amber-300 px-5 text-sm font-extrabold text-amber-950 disabled:opacity-50"
        >
          {pending ? "Conferindo identidade…" : "Propor vínculo exato"}
        </button>
        <Feedback state={state} />
      </div>
    </form>
  );
}

export function ProductExamReferenceReviewControls({
  publicId,
  canApprove,
}: {
  publicId: string;
  canApprove: boolean;
}) {
  return (
    <ReviewControls
      publicId={publicId}
      action={reviewProductExamReferenceAction}
      approveLabel="Confirmar última prova"
      canApprove={canApprove}
    />
  );
}

type CareerSubjectOption = {
  careerTrackId: number;
  subjectId: number;
  subjectName: string;
};

const licensedImportExample = JSON.stringify(
  {
    schemaVersion: 1,
    booklet: "Tipo 1",
    questions: [
      {
        order: 1,
        number: "1",
        subjectId: 123,
        topic: "Tema conferido pelo importador",
        prompt: "Enunciado integral da questão licenciada, com pelo menos vinte caracteres.",
        explanation: "Explicação editorial conferida, com fundamento e pelo menos vinte caracteres.",
        difficulty: 3,
        type: "multiple_choice",
        correctOption: "A",
        options: [
          { key: "A", text: "Alternativa A", rationale: "Justificativa da alternativa A." },
          { key: "B", text: "Alternativa B", rationale: "Justificativa da alternativa B." },
          { key: "C", text: "Alternativa C", rationale: "Justificativa da alternativa C." },
          { key: "D", text: "Alternativa D", rationale: "Justificativa da alternativa D." },
          { key: "E", text: "Alternativa E", rationale: "Justificativa da alternativa E." },
        ],
      },
    ],
  },
  null,
  2,
);

export function LicensedPreviousExamImportForm({
  documents,
  subjects,
}: {
  documents: readonly DocumentOption[];
  subjects: readonly CareerSubjectOption[];
}) {
  const [state, action, pending] = useActionState(
    importLicensedPreviousExamBookletAction,
    initialState,
  );
  const [documentPublicId, setDocumentPublicId] = useState("");
  const [answerKeyDocumentPublicId, setAnswerKeyDocumentPublicId] =
    useState("");
  const selectedDocument = documents.find(
    (document) => document.publicId === documentPublicId,
  );
  const availableAnswerKeys = useMemo(
    () =>
      documents.filter(
        (document) =>
          document.examPublicId === selectedDocument?.examPublicId &&
          document.documentType === "answer_key" &&
          document.status === "approved" &&
          document.sourcePolicy === "licensed_content",
      ),
    [documents, selectedDocument?.examPublicId],
  );
  const selectedAnswerKey = availableAnswerKeys.find(
    (document) => document.publicId === answerKeyDocumentPublicId,
  );
  const compatibleSubjects = useMemo(
    () =>
      subjects.filter(
        (subject) => subject.careerTrackId === selectedDocument?.careerTrackId,
      ),
    [selectedDocument?.careerTrackId, subjects],
  );

  return (
    <form action={action} className="mt-5 grid gap-4">
      <label className="text-xs font-semibold text-slate-400">
        Caderno integral licenciado e aprovado
        <select
          name="documentPublicId"
          required
          className={field}
          value={documentPublicId}
          onChange={(event) => {
            setDocumentPublicId(event.target.value);
            setAnswerKeyDocumentPublicId("");
          }}
        >
          <option value="">Selecione</option>
          {documents
            .filter((document) => document.documentType === "question_booklet")
            .map((document) => (
            <option key={document.publicId} value={document.publicId}>
              {document.examTitle ? `${document.examTitle} · ` : ""}
              {document.title} · {document.expectedQuestionCount ?? "?"} questões
            </option>
            ))}
        </select>
      </label>

      <label className="text-xs font-semibold text-slate-400">
        Gabarito oficial licenciado da mesma edição
        <select
          name="answerKeyDocumentPublicId"
          required
          className={field}
          value={answerKeyDocumentPublicId}
          onChange={(event) =>
            setAnswerKeyDocumentPublicId(event.target.value)
          }
        >
          <option value="">Selecione</option>
          {availableAnswerKeys.map((document) => (
            <option key={document.publicId} value={document.publicId}>
              {document.title}
            </option>
          ))}
        </select>
      </label>

      {selectedDocument ? (
        <div className="rounded-xl border border-violet-300/15 bg-violet-300/[.035] p-3 text-[11px] leading-5 text-slate-400">
          <p>
            <strong className="text-violet-200">Titular:</strong>{" "}
            {selectedDocument.rightsHolder ?? "não informado"}
          </p>
          <p className="break-all">
            <strong className="text-violet-200">Evidência:</strong>{" "}
            {selectedDocument.licenseReference ?? "não informada"}
          </p>
          <p>
            <strong className="text-violet-200">Versão da evidência:</strong>{" "}
            {selectedDocument.licenseEvidenceChecksumSha256 ?? "não informada"}
          </p>
          <p>
            <strong className="text-violet-200">Gabarito vinculado:</strong>{" "}
            {selectedAnswerKey?.title ?? "selecione o gabarito exato"}
          </p>
          <p className="break-all">
            <strong className="text-violet-200">Versão do gabarito:</strong>{" "}
            {selectedAnswerKey?.licenseEvidenceChecksumSha256 ?? "não informada"}
          </p>
          <p className="mt-2">
            <strong className="text-slate-300">Matérias permitidas no JSON:</strong>{" "}
            {compatibleSubjects.length
              ? compatibleSubjects
                  .map((subject) => `${subject.subjectId} · ${subject.subjectName}`)
                  .join("; ")
              : "nenhuma matéria ativa vinculada à carreira"}
          </p>
        </div>
      ) : null}

      <label className="text-xs font-semibold text-slate-400">
        JSON completo do caderno
        <textarea
          name="payload"
          required
          maxLength={700_000}
          spellCheck={false}
          className={`${field} min-h-80 py-3 font-mono text-[11px] leading-5`}
          placeholder={licensedImportExample}
        />
      </label>
      <p className="text-[11px] leading-5 text-slate-500">
        O lote precisa ter exatamente o total do documento, ordens contínuas de
        1 até o fim, uma resposta correta e alternativas justificadas: duas em
        certo/errado ou quatro/cinco em múltipla escolha. A Editalume não baixa
        nem raspa o PDF neste fluxo.
      </p>
      <label className="flex items-start gap-3 rounded-xl border border-amber-300/15 bg-amber-300/[.035] p-3 text-xs leading-5 text-amber-100">
        <input
          type="checkbox"
          name="attestation"
          required
          className="mt-1 size-4 accent-amber-300"
        />
        <span>
          Confirmo que este é o caderno completo, que a transcrição foi
          conferida e que a licença escrita registrada cobre a reprodução na
          área paga. Esta confirmação importa somente itens pendentes; não é uma
          aprovação editorial.
        </span>
      </label>
      <div>
        <button
          disabled={
            pending ||
            !selectedDocument ||
            !selectedAnswerKey ||
            compatibleSubjects.length === 0
          }
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-violet-300 px-5 text-sm font-extrabold text-violet-950 disabled:opacity-50"
        >
          <FileJson2 className="size-4" />
          {pending ? "Validando lote integral…" : "Importar para revisão"}
        </button>
        <Feedback state={state} />
      </div>
    </form>
  );
}

type LicensedReviewBatch = {
  batchPublicId: string;
  documentPublicId: string;
  documentTitle: string;
  answerKeyDocumentPublicId: string;
  answerKeyDocumentTitle: string;
  canApprove: boolean;
  expectedQuestionCount: number | null;
  rightsHolder: string;
  licenseEvidenceUrl: string;
  licenseEvidenceVersion: string;
  answerKeyLicenseEvidenceUrl: string;
  answerKeyLicenseEvidenceVersion: string;
  fingerprint: string;
  questions: readonly {
    id: number;
    publicId: string;
    type: string;
    prompt: string;
    explanation: string;
    topic: string;
    difficulty: number;
    originalQuestionNumber: string | null;
    originalQuestionOrder: number | null;
    subjectId: number | null;
  }[];
  options: readonly {
    questionId: number;
    optionKey: string;
    text: string;
    isCorrect: boolean;
    rationale: string | null;
    sortOrder: number;
  }[];
};

export function LicensedPreviousExamReviewControls({
  batch,
}: {
  batch: LicensedReviewBatch;
}) {
  const [state, action, pending] = useActionState(
    reviewLicensedPreviousExamBookletAction,
    initialState,
  );
  const optionsByQuestion = useMemo(() => {
    const grouped = new Map<number, LicensedReviewBatch["options"]>();
    for (const option of batch.options) {
      const current = grouped.get(option.questionId) ?? [];
      grouped.set(option.questionId, [...current, option]);
    }
    return grouped;
  }, [batch.options]);

  return (
    <form action={action} className="mt-4">
      <input type="hidden" name="batchPublicId" value={batch.batchPublicId} />
      <input
        type="hidden"
        name="dossierFingerprint"
        value={batch.fingerprint}
      />
      <div className="space-y-3">
        {batch.questions.map((question) => (
          <details
            key={question.publicId}
            className="rounded-xl border border-white/8 bg-[#07111d]"
          >
            <summary className="cursor-pointer px-3 py-3 text-xs font-bold text-slate-200">
              Questão {question.originalQuestionNumber ?? question.originalQuestionOrder} ·{" "}
              matéria {question.subjectId} · {question.type === "true_false" ? "Certo/errado" : "Múltipla escolha"}
            </summary>
            <div className="space-y-3 border-t border-white/7 p-3 text-xs leading-5 text-slate-400">
              <p>{question.prompt}</p>
              <ol className="space-y-2">
                {(optionsByQuestion.get(question.id) ?? []).map((option) => (
                  <li
                    key={`${question.id}-${option.optionKey}`}
                    className={`rounded-lg border p-2.5 ${
                      option.isCorrect
                        ? "border-emerald-300/20 bg-emerald-300/[.045]"
                        : "border-white/7 bg-black/10"
                    }`}
                  >
                    <strong className="text-slate-200">{option.optionKey}.</strong>{" "}
                    {option.text}
                    <p className="mt-1 text-[11px] text-slate-600">
                      {option.rationale}
                    </p>
                  </li>
                ))}
              </ol>
              <p>
                <strong className="text-sky-200">Explicação:</strong>{" "}
                {question.explanation}
              </p>
              <p>
                <strong className="text-slate-300">Tema:</strong> {question.topic} ·
                dificuldade {question.difficulty}/5
              </p>
            </div>
          </details>
        ))}
      </div>
      <label className="mt-4 block text-xs font-semibold text-slate-400">
        Nota única da revisão integral
        <textarea
          name="notes"
          required
          minLength={20}
          maxLength={1500}
          className={`${field} min-h-24 py-3`}
          placeholder="Registre a conferência do enunciado, alternativas, gabarito, explicações, matéria, numeração e licença do lote completo."
        />
      </label>
      <label className="mt-3 flex items-start gap-3 rounded-xl border border-emerald-300/15 bg-emerald-300/[.035] p-3 text-xs leading-5 text-emerald-100">
        <input
          type="checkbox"
          name="reviewAttestation"
          className="mt-1 size-4 accent-emerald-300"
        />
        <span>
          Conferi pessoalmente todas as {batch.expectedQuestionCount} questões e
          a evidência da licença. Para aprovar, declaro ser pessoa diferente de
          quem importou este lote e reconheço que a aprovação não libera produto
          nem Stripe.
        </span>
      </label>
      <Feedback state={state} />
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          name="decision"
          value="approve"
          disabled={pending || !batch.canApprove}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-emerald-300 px-4 text-xs font-extrabold text-emerald-950 disabled:opacity-50"
        >
          <Check className="size-3.5" />
          {pending ? "Revalidando lote…" : "Aprovar lote completo"}
        </button>
        <button
          name="decision"
          value="reject"
          disabled={pending}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-rose-300/20 bg-rose-300/8 px-4 text-xs font-bold text-rose-100 disabled:opacity-50"
        >
          <RotateCcw className="size-3.5" />
          Suspender lote completo
        </button>
      </div>
      {!batch.canApprove ? (
        <p className="mt-2 text-[11px] text-slate-500">
          Você pode suspender o lote que importou, mas outra conta administrativa
          precisa revisá-lo para aprovação.
        </p>
      ) : null}
    </form>
  );
}

type RevocationAction =
  | typeof revokeExamDocumentAction
  | typeof revokeProductExamReferenceAction
  | typeof suspendPreviousExamQuestionAction;

function RevocationControls({
  publicId,
  action,
  label,
}: {
  publicId: string;
  action: RevocationAction;
  label: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  return (
    <form
      action={formAction}
      className="mt-3 rounded-xl border border-rose-300/15 bg-rose-300/[.035] p-3"
    >
      <input type="hidden" name="publicId" value={publicId} />
      <label className="text-[11px] font-semibold text-rose-100">
        Motivo operacional ou jurídico
        <textarea
          name="notes"
          required
          minLength={20}
          maxLength={2000}
          className={`${field} min-h-20 py-3`}
          placeholder="Registre a retirada da fonte, rescisão, expiração ou outra causa verificável."
        />
      </label>
      <Feedback state={state} />
      <button
        disabled={pending}
        className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-lg bg-rose-300 px-3 text-xs font-extrabold text-rose-950 disabled:opacity-50"
      >
        <AlertTriangle className="size-3.5" />
        {pending ? "Bloqueando…" : label}
      </button>
    </form>
  );
}

export function RevokeExamDocumentControls({ publicId }: { publicId: string }) {
  return (
    <RevocationControls
      publicId={publicId}
      action={revokeExamDocumentAction}
      label="Retirar documento agora"
    />
  );
}

export function RevokeProductExamReferenceControls({
  publicId,
}: {
  publicId: string;
}) {
  return (
    <RevocationControls
      publicId={publicId}
      action={revokeProductExamReferenceAction}
      label="Retirar vínculo agora"
    />
  );
}

export function SuspendPreviousExamQuestionForm() {
  const [state, action, pending] = useActionState(
    suspendPreviousExamQuestionAction,
    initialState,
  );
  return (
    <form action={action} className="mt-5 grid gap-4 md:grid-cols-2">
      <label className="text-xs font-semibold text-slate-400">
        Identificação pública da questão
        <input name="publicId" required maxLength={200} className={field} />
      </label>
      <label className="text-xs font-semibold text-slate-400 md:col-span-2">
        Motivo da suspensão
        <textarea
          name="notes"
          required
          minLength={20}
          maxLength={2000}
          className={`${field} min-h-20 py-3`}
        />
      </label>
      <div className="md:col-span-2">
        <button
          disabled={pending}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-rose-300 px-5 text-sm font-extrabold text-rose-950 disabled:opacity-50"
        >
          <AlertTriangle className="size-4" />
          {pending ? "Suspendendo…" : "Suspender questão real"}
        </button>
        <Feedback state={state} />
      </div>
    </form>
  );
}
