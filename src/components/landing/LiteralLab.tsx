"use client";

import { BookOpenText, Check, ExternalLink, RotateCcw, Sparkles, X } from "lucide-react";
import { useState } from "react";

type LabExample = {
  id: string;
  tab: string;
  discipline: string;
  article: string;
  prefix: string;
  suffix: string;
  options: string[];
  correct: string;
  explanation: string;
  source: string;
  sourceUrl: string;
  verifiedAt: string;
};

export const LITERAL_LAB_EXAMPLES: LabExample[] = [
  {
    id: "constitucional",
    tab: "Constitucional",
    discipline: "Direito Constitucional",
    article: "Constituição Federal • art. 5º, LIV",
    prefix: "Ninguém será privado da liberdade ou de seus",
    suffix: "sem o devido processo legal.",
    options: ["bens", "direitos", "recursos"],
    correct: "bens",
    explanation:
      "A redação constitucional usa “bens”. A alternativa troca uma palavra familiar por outra juridicamente plausível — exatamente o tipo de detalhe que merece revisão ativa.",
    source: "Constituição Federal compilada",
    sourceUrl: "https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm",
    verifiedAt: "17/08/2026",
  },
  {
    id: "administrativo",
    tab: "Administrativo",
    discipline: "Direito Administrativo",
    article: "Constituição Federal • art. 37, caput",
    prefix:
      "A administração pública direta e indireta de qualquer dos Poderes da União, dos Estados, do Distrito Federal e dos Municípios obedecerá aos princípios de legalidade, impessoalidade, moralidade,",
    suffix: "e eficiência e, também, ao seguinte:",
    options: ["publicidade", "transparência", "probidade"],
    correct: "publicidade",
    explanation:
      "“Publicidade” integra a enumeração expressa do caput. Transparência e probidade são conceitos relevantes, mas não ocupam esse ponto da literalidade.",
    source: "Constituição Federal compilada",
    sourceUrl: "https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm",
    verifiedAt: "17/08/2026",
  },
  {
    id: "penal",
    tab: "Penal",
    discipline: "Direito Penal",
    article: "Código Penal • art. 1º",
    prefix: "Não há crime sem lei",
    suffix: "que o defina. Não há pena sem prévia cominação legal.",
    options: ["anterior", "prévia", "expressa"],
    correct: "anterior",
    explanation:
      "O primeiro período usa “anterior”; “prévia” aparece no segundo. A proximidade entre os termos transforma a ordem das palavras em um ponto de prova.",
    source: "Código Penal compilado",
    sourceUrl: "https://www.planalto.gov.br/ccivil_03/decreto-lei/del2848compilado.htm",
    verifiedAt: "17/08/2026",
  },
];

export function LiteralLab() {
  const [activeId, setActiveId] = useState(LITERAL_LAB_EXAMPLES[0].id);
  const [selected, setSelected] = useState<string | null>(null);

  const example =
    LITERAL_LAB_EXAMPLES.find((item) => item.id === activeId) ?? LITERAL_LAB_EXAMPLES[0];
  const answered = selected !== null;
  const correct = selected === example.correct;

  function selectExample(id: string) {
    setActiveId(id);
    setSelected(null);
  }

  return (
    <div className="literal-lab">
      <div className="literal-lab__tabs" role="tablist" aria-label="Escolha uma disciplina">
        {LITERAL_LAB_EXAMPLES.map((item) => (
          <button
            key={item.id}
            id={`lab-tab-${item.id}`}
            className={item.id === activeId ? "is-active" : undefined}
            type="button"
            role="tab"
            aria-selected={item.id === activeId}
            aria-controls="literal-lab-panel"
            onClick={() => selectExample(item.id)}
          >
            {item.tab}
          </button>
        ))}
      </div>

      <div
        className="literal-lab__grid"
        id="literal-lab-panel"
        role="tabpanel"
        aria-labelledby={`lab-tab-${example.id}`}
      >
        <div className="lab-question-card">
          <div className="lab-question-card__topline">
            <span>
              <BookOpenText aria-hidden="true" size={16} />
              {example.discipline}
            </span>
            <span>Demonstração 01/03</span>
          </div>

          <div className="lab-question-card__prompt">
            <span className="lab-question-card__label">Complete a literalidade</span>
            <p>
              {example.prefix}{" "}
              <mark className={answered ? (correct ? "is-correct" : "is-wrong") : undefined}>
                {selected ?? "__________"}
              </mark>{" "}
              {example.suffix}
            </p>
          </div>

          <div className="lab-options" aria-label="Alternativas">
            {example.options.map((option, index) => {
              const isSelected = selected === option;
              const revealCorrect = answered && option === example.correct;

              return (
                <button
                  key={option}
                  className={`${isSelected ? "is-selected" : ""}${
                    revealCorrect ? " is-correct" : ""
                  }`}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setSelected(option)}
                >
                  <span>{String.fromCharCode(65 + index)}</span>
                  {option}
                  {revealCorrect && <Check aria-hidden="true" size={18} />}
                  {isSelected && !correct && <X aria-hidden="true" size={18} />}
                </button>
              );
            })}
          </div>

          <div className="lab-question-card__footer">
            <span>Selecione a palavra exata usada pela lei.</span>
            {answered && (
              <button type="button" onClick={() => setSelected(null)}>
                <RotateCcw aria-hidden="true" size={15} />
                Tentar novamente
              </button>
            )}
          </div>
        </div>

        <aside className="lab-feedback" aria-live="polite">
          <span className="lab-feedback__eyebrow">
            <Sparkles aria-hidden="true" size={15} />
            Correção com contexto
          </span>

          {!answered ? (
            <div className="lab-feedback__empty">
              <span className="lab-feedback__radar" aria-hidden="true">
                <i />
              </span>
              <h3>Uma palavra muda a resposta.</h3>
              <p>
                Escolha uma alternativa para ver como o LeiProva transforma o erro em uma pista de
                memória.
              </p>
            </div>
          ) : (
            <div className={`lab-feedback__result ${correct ? "is-correct" : "is-wrong"}`}>
              <span className="lab-feedback__icon" aria-hidden="true">
                {correct ? <Check size={24} /> : <X size={24} />}
              </span>
              <div>
                <h3>{correct ? "Literalidade reconhecida." : "Boa armadilha. Vamos fixar."}</h3>
                <p>{example.explanation}</p>
              </div>
            </div>
          )}

          <div className="lab-feedback__source">
            <span>Fonte de demonstração</span>
            <strong>{example.article}</strong>
            <a href={example.sourceUrl} target="_blank" rel="noreferrer">
              {example.source}
              <ExternalLink aria-hidden="true" size={14} />
            </a>
          </div>

          <p className="lab-feedback__note">
            Microexemplo ilustrativo assistido por IA · fonte conferida em {example.verifiedAt} · revisão humana independente pendente. Trecho meramente informativo e não oficial; não substitui o DOU.
          </p>
        </aside>
      </div>
    </div>
  );
}
