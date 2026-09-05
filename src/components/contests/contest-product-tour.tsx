"use client";

import {
  BarChart3,
  BookOpen,
  Check,
  ChevronRight,
  Layers3,
  Monitor,
  RotateCcw,
  Smartphone,
  Target,
} from "lucide-react";
import { useId, useState } from "react";

import styles from "./contest-landing.module.css";

const VIEWS = [
  {
    id: "rotina",
    name: "Sua rotina",
    icon: BookOpen,
    description: "Encontre o próximo passo sem recomeçar do zero.",
  },
  {
    id: "revisao",
    name: "Suas revisões",
    icon: RotateCcw,
    description: "Retome os pontos que ainda precisam de atenção.",
  },
  {
    id: "progresso",
    name: "Seu progresso",
    icon: BarChart3,
    description: "Veja o que você estudou e onde concentrar energia.",
  },
] as const;

export function ContestProductTour() {
  const [view, setView] = useState<(typeof VIEWS)[number]["id"]>("rotina");
  const [mobile, setMobile] = useState(false);
  const panelId = useId();
  const selected = VIEWS.find((item) => item.id === view) ?? VIEWS[0];

  return (
    <div className={styles.tour}>
      <div
        className={styles.tourChoices}
        role="group"
        aria-label="Explorar a plataforma por dentro"
      >
        {VIEWS.map(({ id, name, icon: Icon, description }, index) => (
          <button
            key={id}
            type="button"
            aria-pressed={view === id}
            aria-controls={panelId}
            onClick={() => setView(id)}
          >
            <span className={styles.tourChoiceNumber}>0{index + 1}</span>
            <span>
              <strong>
                <Icon size={18} aria-hidden="true" />
                {name}
              </strong>
              <small>{description}</small>
            </span>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        ))}
        <p className={styles.tourNote}>
          Explore as três visões. Esta é uma apresentação ilustrativa, com dados
          fictícios — não o histórico de um aluno nem a cobertura deste
          concurso.
        </p>
      </div>
      <div className={styles.tourStage}>
        <div className={styles.tourToolbar}>
          <span>
            <span className={styles.liveDot} /> Tour da plataforma
          </span>
          <div role="group" aria-label="Tamanho da prévia">
            <button
              type="button"
              aria-pressed={!mobile}
              aria-label="Prévia em computador"
              onClick={() => setMobile(false)}
            >
              <Monitor size={17} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-pressed={mobile}
              aria-label="Prévia em celular"
              onClick={() => setMobile(true)}
            >
              <Smartphone size={17} aria-hidden="true" />
            </button>
          </div>
        </div>
        <div
          className={`${styles.preview} ${mobile ? styles.previewMobile : ""}`}
          id={panelId}
          role="region"
          aria-label={`Prévia: ${selected.name}`}
          aria-live="polite"
        >
          <div className={styles.previewHeader}>
            <span className={styles.previewLogo}>
              edita<span>lume</span>
            </span>
            <span>Modo ilustrativo</span>
          </div>
          <div className={styles.previewBody}>
            <span className={styles.eyebrow}>SEU ESPAÇO DE ESTUDO</span>
            <h3>
              {view === "rotina"
                ? "Um passo de cada vez."
                : view === "revisao"
                  ? "Revisar também é avançar."
                  : "Torne seu esforço visível."}
            </h3>
            {view === "rotina" ? (
              <>
                <div className={styles.previewHighlight}>
                  <Target aria-hidden="true" size={22} />
                  <div>
                    <small>Foco da sessão · exemplo</small>
                    <strong>Direito Constitucional</strong>
                    <span>Leitura, prática e retomada dos erros.</span>
                  </div>
                </div>
                <div className={styles.previewRows}>
                  {[
                    {
                      label: "Ler o dispositivo",
                      detail: "Biblioteca de leis",
                      Icon: BookOpen,
                    },
                    {
                      label: "Praticar com questões",
                      detail: "Feedback e referência legal",
                      Icon: Target,
                    },
                    {
                      label: "Revisar os pontos difíceis",
                      detail: "Fila de revisão",
                      Icon: RotateCcw,
                    },
                  ].map(({ label, detail, Icon }, index) => (
                    <div key={label}>
                      <span className={styles.previewRowIcon}>
                        <Icon size={17} aria-hidden="true" />
                      </span>
                      <span>
                        <strong>{label}</strong>
                        <small>{detail}</small>
                      </span>
                      <span className={styles.previewRowIndex}>
                        0{index + 1}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : view === "revisao" ? (
              <>
                <p className={styles.previewDescription}>
                  Sua fila reúne os dispositivos que precisam de uma nova
                  leitura.
                </p>
                <div className={styles.previewRows}>
                  {[
                    { title: "Direitos e garantias", label: "Revisar hoje" },
                    {
                      title: "Princípios constitucionais",
                      label: "Revisar hoje",
                    },
                    { title: "Organização do Estado", label: "Próxima sessão" },
                  ].map(({ title, label }) => (
                    <div key={title}>
                      <span className={styles.previewRowIcon}>
                        <Layers3 size={17} aria-hidden="true" />
                      </span>
                      <span>
                        <strong>{title}</strong>
                        <small>Constituição Federal · exemplo</small>
                      </span>
                      <span className={styles.previewDue}>{label}</span>
                    </div>
                  ))}
                </div>
                <div className={styles.previewHint}>
                  <RotateCcw size={16} aria-hidden="true" /> Retome, responda e
                  atualize seu histórico.
                </div>
              </>
            ) : (
              <>
                <p className={styles.previewDescription}>
                  O histórico ajuda a orientar a próxima sessão. Os valores
                  abaixo são apenas demonstrativos.
                </p>
                <div className={styles.previewStats}>
                  <div>
                    <strong>24</strong>
                    <span>respostas no exemplo</span>
                  </div>
                  <div>
                    <strong>18</strong>
                    <span>acertos no exemplo</span>
                  </div>
                </div>
                <div
                  className={styles.previewChart}
                  aria-label="Exemplo ilustrativo: 18 acertos em 24 respostas, 75%"
                >
                  <span>
                    Acertos nesta sessão <strong>75%</strong>
                  </span>
                  <div>
                    <i />
                  </div>
                </div>
                <div className={styles.previewHint}>
                  <Check size={16} aria-hidden="true" /> Progresso de estudo,
                  não previsão de aprovação.
                </div>
              </>
            )}
          </div>
          <div className={styles.previewFooter}>
            Leitura <span /> Prática <span /> Revisão
          </div>
        </div>
      </div>
    </div>
  );
}
