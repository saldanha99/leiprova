"use client";

import { useActionState, useMemo, useState } from "react";
import { CheckCircle2, ExternalLink, FileText, Send, ShieldCheck, Sparkles } from "lucide-react";

import {
  createOriginalQuestionAction,
  type EditorialActionState,
} from "@/app/admin/fabrica-autoral/actions";

const initialEditorialActionState: EditorialActionState = { status: "idle", message: "" };

type Profile = {
  bankId: number;
  bankName: string;
  format: string;
  commandStyle: string;
};

type Article = {
  id: number;
  actTitle: string;
  articleRef: string;
  heading: string | null;
  literalText: string;
  sourceUrl: string;
  verifiedAt: Date;
};

type Subject = { id: number; name: string };
type Topic = { id: number; subjectId: number; name: string };

type AuthoringFormProps = {
  profiles: Profile[];
  articles: Article[];
  subjects: Subject[];
  topics: Topic[];
};

const fieldClass =
  "min-h-12 w-full rounded-xl border border-white/10 bg-[#07111d] px-3.5 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-amber-300/45 focus:ring-2 focus:ring-amber-300/10";

const textareaClass = `${fieldClass} min-h-28 resize-y py-3 leading-6`;

function FieldLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-2 block text-xs font-bold uppercase tracking-[.11em] text-slate-400">
      {children}
    </label>
  );
}

export function AuthoringForm({ profiles, articles, subjects, topics }: AuthoringFormProps) {
  const [state, formAction, pending] = useActionState(
    createOriginalQuestionAction,
    initialEditorialActionState,
  );
  const [bankId, setBankId] = useState(String(profiles[0]?.bankId ?? ""));
  const [articleId, setArticleId] = useState(String(articles[0]?.id ?? ""));
  const [subjectId, setSubjectId] = useState(String(subjects[0]?.id ?? ""));
  const [authorshipMethod, setAuthorshipMethod] = useState("human");

  const profile = profiles.find((item) => String(item.bankId) === bankId) ?? profiles[0];
  const article = articles.find((item) => String(item.id) === articleId) ?? articles[0];
  const availableTopics = useMemo(
    () => topics.filter((topic) => String(topic.subjectId) === subjectId),
    [subjectId, topics],
  );
  const optionKeys = profile?.format === "true_false" ? ["C", "E"] : ["A", "B", "C", "D", "E"];

  if (!profiles.length || !articles.length || !subjects.length || !topics.length) {
    return (
      <div className="rounded-2xl border border-amber-300/20 bg-amber-300/8 p-5 text-sm leading-6 text-amber-100">
        A fábrica precisa de perfis ativos, fonte legal revisada, matérias e assuntos antes de receber uma questão.
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-7">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <FieldLabel htmlFor="styleBankId">Perfil editorial</FieldLabel>
          <select
            id="styleBankId"
            name="styleBankId"
            value={bankId}
            onChange={(event) => setBankId(event.target.value)}
            className={fieldClass}
            required
          >
            {profiles.map((item) => (
              <option key={item.bankId} value={item.bankId}>
                {item.bankName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel htmlFor="difficulty">Dificuldade</FieldLabel>
          <select id="difficulty" name="difficulty" className={fieldClass} defaultValue="2" required>
            <option value="1">1 — introdutória</option>
            <option value="2">2 — objetiva</option>
            <option value="3">3 — intermediária</option>
            <option value="4">4 — avançada</option>
            <option value="5">5 — especialista</option>
          </select>
        </div>
      </div>

      <input type="hidden" name="type" value={profile?.format ?? "multiple_choice"} />
      {profile ? (
        <div className="rounded-2xl border border-sky-300/12 bg-sky-300/[.055] p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-[.12em] text-sky-200">
              {profile.format === "true_false" ? "Certo ou errado" : "Múltipla escolha"}
            </span>
            <span className="text-xs text-slate-500">•</span>
            <span className="text-xs text-slate-400">perfil abstrato v1</span>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-300">{profile.commandStyle}</p>
        </div>
      ) : null}

      <div>
        <FieldLabel htmlFor="legalArticleId">Fonte oficial obrigatória</FieldLabel>
        <select
          id="legalArticleId"
          name="legalArticleId"
          value={articleId}
          onChange={(event) => setArticleId(event.target.value)}
          className={fieldClass}
          required
        >
          {articles.map((item) => (
            <option key={item.id} value={item.id}>
              {item.actTitle} — {item.articleRef}{item.heading ? ` · ${item.heading}` : ""}
            </option>
          ))}
        </select>
        {article ? (
          <div className="mt-3 rounded-2xl border border-white/8 bg-black/15 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-200">
                <FileText aria-hidden="true" className="size-3.5" />
                Texto oficial revisado em {new Intl.DateTimeFormat("pt-BR").format(new Date(article.verifiedAt))}
              </span>
              <a
                href={article.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-300 hover:text-amber-200"
              >
                Abrir fonte
                <ExternalLink aria-hidden="true" className="size-3.5" />
              </a>
            </div>
            <p className="mt-3 max-h-32 overflow-y-auto whitespace-pre-line pr-2 text-xs leading-5 text-slate-400">
              {article.literalText}
            </p>
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <FieldLabel htmlFor="subjectId">Matéria</FieldLabel>
          <select
            id="subjectId"
            name="subjectId"
            value={subjectId}
            onChange={(event) => setSubjectId(event.target.value)}
            className={fieldClass}
            required
          >
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel htmlFor="topicId">Assunto</FieldLabel>
          <select id="topicId" name="topicId" className={fieldClass} key={subjectId} required>
            <option value="">Selecione</option>
            {availableTopics.map((topic) => (
              <option key={topic.id} value={topic.id}>
                {topic.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <FieldLabel htmlFor="learningObjective">Objetivo de aprendizagem</FieldLabel>
        <input
          id="learningObjective"
          name="learningObjective"
          className={fieldClass}
          placeholder="Ex.: identificar a condição legal para..."
          minLength={12}
          maxLength={500}
          required
        />
      </div>

      <div>
        <FieldLabel htmlFor="prompt">Enunciado inédito</FieldLabel>
        <textarea
          id="prompt"
          name="prompt"
          className={textareaClass}
          placeholder="Redija do zero, usando apenas a fonte oficial e o perfil abstrato acima."
          minLength={30}
          maxLength={4000}
          required
        />
      </div>

      <fieldset>
        <legend className="mb-3 text-xs font-bold uppercase tracking-[.11em] text-slate-400">
          Respostas
        </legend>
        <div className="space-y-3">
          {optionKeys.map((key) => {
            const fixedText = profile?.format === "true_false" ? (key === "C" ? "Certo" : "Errado") : null;
            return (
              <div
                key={`${profile?.format}-${key}`}
                className="grid gap-3 rounded-xl border border-white/8 bg-white/[.025] p-3 sm:grid-cols-[auto_1fr] sm:items-start"
              >
                <label className="flex min-h-11 items-center gap-2 text-xs font-bold text-slate-300">
                  <input
                    type="radio"
                    name="correctOption"
                    value={key}
                    className="size-4 accent-emerald-400"
                    required
                  />
                  {key}
                </label>
                {fixedText ? (
                  <input type="hidden" name={`option_${key}`} value={fixedText} />
                ) : (
                  <textarea
                    name={`option_${key}`}
                    aria-label={`Alternativa ${key}`}
                    className={`${fieldClass} min-h-20 resize-y py-3`}
                    minLength={2}
                    maxLength={1200}
                    required
                  />
                )}
                {fixedText ? <p className="self-center text-sm font-semibold text-slate-200">{fixedText}</p> : null}
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs leading-5 text-slate-500">Marque à esquerda a única resposta correta.</p>
      </fieldset>

      <div>
        <FieldLabel htmlFor="explanation">Justificativa editorial</FieldLabel>
        <textarea
          id="explanation"
          name="explanation"
          className={textareaClass}
          placeholder="Explique a resposta com base no dispositivo oficial selecionado."
          minLength={30}
          maxLength={5000}
          required
        />
      </div>

      <div className="rounded-2xl border border-white/8 bg-white/[.025] p-4">
        <FieldLabel htmlFor="authorshipMethod">Método de autoria</FieldLabel>
        <select
          id="authorshipMethod"
          name="authorshipMethod"
          value={authorshipMethod}
          onChange={(event) => setAuthorshipMethod(event.target.value)}
          className={fieldClass}
          required
        >
          <option value="human">Autoria humana</option>
          <option value="ai_assisted">Autoria assistida por IA</option>
        </select>
        {authorshipMethod === "ai_assisted" ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel htmlFor="generatorModel">Modelo utilizado</FieldLabel>
              <input id="generatorModel" name="generatorModel" className={fieldClass} maxLength={120} required />
            </div>
            <div>
              <FieldLabel htmlFor="promptVersion">Versão do prompt</FieldLabel>
              <input id="promptVersion" name="promptVersion" className={fieldClass} maxLength={120} required />
            </div>
          </div>
        ) : null}
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-emerald-300/15 bg-emerald-300/[.055] p-4">
        <input
          type="checkbox"
          name="cleanRoomAttestation"
          className="mt-1 size-4 shrink-0 accent-emerald-400"
          required
        />
        <span>
          <strong className="flex items-center gap-2 text-sm text-emerald-100">
            <ShieldCheck aria-hidden="true" className="size-4" />
            Declaração de autoria limpa
          </strong>
          <span className="mt-1 block text-xs leading-5 text-slate-400">
            Confirmo que esta questão foi criada do zero a partir da fonte oficial selecionada e do perfil abstrato,
            sem consultar, copiar ou parafrasear uma questão de terceiros.
          </span>
        </span>
      </label>

      {state.message ? (
        <div
          aria-live="polite"
          className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${
            state.status === "success"
              ? "border-emerald-300/20 bg-emerald-300/8 text-emerald-100"
              : "border-rose-300/20 bg-rose-300/8 text-rose-100"
          }`}
        >
          {state.status === "success" ? (
            <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          ) : (
            <Sparkles aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          )}
          {state.message}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 text-sm font-extrabold text-slate-950 transition hover:bg-amber-300 disabled:cursor-wait disabled:opacity-60 sm:w-auto"
      >
        <Send aria-hidden="true" className="size-4" />
        {pending ? "Enviando..." : "Enviar para revisão independente"}
      </button>
    </form>
  );
}
