"use client";

import {
  BarChart3,
  BookMarked,
  CheckCircle2,
  Clock3,
  Flame,
  Laptop,
  ListChecks,
  RefreshCcw,
  Smartphone,
  Tablet,
  Target,
} from "lucide-react";
import { useState } from "react";

const DEVICES = [
  { id: "notebook", label: "Notebook", icon: Laptop },
  { id: "tablet", label: "Tablet", icon: Tablet },
  { id: "celular", label: "Celular", icon: Smartphone },
] as const;

const VIEWS = [
  { id: "roteiro", label: "Roteiro", icon: ListChecks },
  { id: "revisao", label: "Revisão", icon: RefreshCcw },
  { id: "dominio", label: "Domínio", icon: BarChart3 },
] as const;

type DeviceId = (typeof DEVICES)[number]["id"];
type ViewId = (typeof VIEWS)[number]["id"];

function StudyRouteView() {
  return (
    <div className="app-view app-view--route">
      <div className="app-view__hero-card">
        <div>
          <span className="app-mini-label">Sessão de hoje</span>
          <h4>Direito Constitucional</h4>
          <p>Literalidade, prazos e revisão dos seus erros recentes.</p>
        </div>
        <span className="app-session-time">
          <Clock3 aria-hidden="true" size={16} />
          24 min
        </span>
      </div>

      <div className="app-task-list">
        <div className="app-task is-done">
          <span>
            <CheckCircle2 aria-hidden="true" size={17} />
          </span>
          <div>
            <strong>Leitura dirigida</strong>
            <small>CF • arts. 5º a 7º</small>
          </div>
          <em>Concluído</em>
        </div>
        <div className="app-task is-current">
          <span>
            <Target aria-hidden="true" size={17} />
          </span>
          <div>
            <strong>Mutação literal</strong>
            <small>8 de 15 itens</small>
          </div>
          <em>Continuar</em>
        </div>
        <div className="app-task">
          <span>
            <BookMarked aria-hidden="true" size={17} />
          </span>
          <div>
            <strong>Fila de revisão</strong>
            <small>6 artigos no ponto</small>
          </div>
          <em>Depois</em>
        </div>
      </div>
    </div>
  );
}

function ReviewView() {
  return (
    <div className="app-view app-view--review">
      <div className="app-view__heading">
        <div>
          <span className="app-mini-label">Memória ativa</span>
          <h4>Revisões no ponto certo</h4>
        </div>
        <span className="app-status-pill">6 para hoje</span>
      </div>

      <div className="review-stack">
        {[
          ["CF • art. 5º, LIV", "Agora", "92%"],
          ["CF • art. 37, caput", "Hoje", "76%"],
          ["CP • art. 1º", "Hoje", "64%"],
          ["LINDB • art. 2º", "Amanhã", "51%"],
        ].map(([article, due, level]) => (
          <div className="review-row" key={article}>
            <span className="review-row__icon">
              <RefreshCcw aria-hidden="true" size={15} />
            </span>
            <div>
              <strong>{article}</strong>
              <small>Próxima revisão: {due}</small>
            </div>
            <span className="review-row__level">{level}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MasteryView() {
  const subjects = [
    ["Constitucional", 86],
    ["Administrativo", 72],
    ["Penal", 64],
    ["Processo Penal", 48],
  ] as const;

  return (
    <div className="app-view app-view--mastery">
      <div className="app-view__heading">
        <div>
          <span className="app-mini-label">Mapa de domínio</span>
          <h4>Seu progresso por matéria</h4>
        </div>
        <span className="app-streak">
          <Flame aria-hidden="true" size={16} />
          12 dias
        </span>
      </div>

      <div className="mastery-grid">
        {subjects.map(([subject, value]) => (
          <div className="mastery-row" key={subject}>
            <div>
              <strong>{subject}</strong>
              <span>{value}%</span>
            </div>
            <span className="mastery-bar">
              <i style={{ width: `${value}%` }} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProductShowcase() {
  const [device, setDevice] = useState<DeviceId>("notebook");
  const [view, setView] = useState<ViewId>("roteiro");

  return (
    <div className="product-showcase">
      <div className="product-showcase__topbar">
        <div className="showcase-view-tabs" role="tablist" aria-label="Escolha uma visão da plataforma">
          {VIEWS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={view === item.id}
                className={view === item.id ? "is-active" : undefined}
                onClick={() => setView(item.id)}
              >
                <Icon aria-hidden="true" size={17} />
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="showcase-device-tabs" role="group" aria-label="Visualizar em outro dispositivo">
          {DEVICES.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={device === item.id}
                aria-label={`Visualizar no ${item.label}`}
                className={device === item.id ? "is-active" : undefined}
                onClick={() => setDevice(item.id)}
              >
                <Icon aria-hidden="true" size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className={`device-preview device-preview--${device}`}>
        <div className="device-preview__camera" aria-hidden="true" />
        <div className="study-app">
          <aside className="study-app__sidebar" aria-label="Menu ilustrativo da plataforma">
            <span className="study-app__mini-brand">
              <i aria-hidden="true">L</i>
              Editalume
            </span>
            <nav>
              <span className={view === "roteiro" ? "is-active" : undefined}>
                <ListChecks aria-hidden="true" size={16} />
                Estudos
              </span>
              <span className={view === "revisao" ? "is-active" : undefined}>
                <RefreshCcw aria-hidden="true" size={16} />
                Revisões
              </span>
              <span className={view === "dominio" ? "is-active" : undefined}>
                <BarChart3 aria-hidden="true" size={16} />
                Desempenho
              </span>
            </nav>
            <span className="study-app__sidebar-note">Sessão sincronizada</span>
          </aside>

          <div className="study-app__main">
            <div className="study-app__header">
              <div>
                <span>Boa tarde, Ana</span>
                <strong>Vamos fixar a lei de hoje?</strong>
              </div>
              <span className="study-app__avatar">AS</span>
            </div>

            {view === "roteiro" && <StudyRouteView />}
            {view === "revisao" && <ReviewView />}
            {view === "dominio" && <MasteryView />}
          </div>
        </div>
      </div>

      <div className="product-showcase__caption">
        <span>Interface demonstrativa</span>
        <p>Seu roteiro, suas revisões e seu domínio acompanham você em qualquer tela.</p>
      </div>
    </div>
  );
}
