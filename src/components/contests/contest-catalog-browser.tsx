"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, BookOpen, Sparkles } from "lucide-react";
import { contestCategories } from "@/lib/opportunities/categories";
import { opportunityJurisdictions } from "@/lib/opportunities/jurisdictions";
import type { ShowcaseCard } from "@/lib/commerce/contest-showcase";
import styles from "./contest-catalog.module.css";

const tabs = [
  ["all", "Todas"], ["available", "Disponíveis"], ["new", "Novidades"],
  ["open", "Inscrições abertas"], ["upcoming", "Edital publicado"],
  ["forecast", "Pré-edital"], ["closed", "Encerrados"], ["planning", "Em planejamento"],
] as const;
const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function ContestCatalogBrowser({ cards }: { cards: ShowcaseCard[] }) {
  const [category, setCategory] = useState("all");
  const [state, setState] = useState("all");
  const [bank, setBank] = useState("all");
  const [phase, setPhase] = useState("all");
  const [query, setQuery] = useState("");
  const matchesTab = (card: ShowcaseCard, key: string) => key === "all"
    || (key === "available" ? card.available : key === "new" ? card.isNew : card.phase === key);
  const banks = [...new Map(cards.filter((card) => card.bankSlug && card.bankName)
    .map((card) => [card.bankSlug!, card.bankName!])).entries()].sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
  const matches = cards.filter((card) => matchesTab(card, phase)
    && (category === "all" || card.categorySlug === category)
    && (state === "all" || card.jurisdictionCodes.includes(state))
    && (bank === "all" || (bank === "unconfirmed" ? !card.bankSlug : card.bankSlug === bank))
    && normalize(`${card.acronym} ${card.role} ${card.edition} ${card.bankName ?? ""}`).includes(normalize(query.trim())));
  return (
    <section id="catalogo-planejado" aria-labelledby="catalogo-planejado-title">
      <p className={styles.eyebrow}>ENCONTRE SUA PREPARAÇÃO</p>
      <h2 id="catalogo-planejado-title" className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
        Seu edital. Sua próxima conquista.
      </h2>
      <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-400">
        Explore as carreiras e acompanhe cada concurso. A situação do edital e a
        disponibilidade da preparação aparecem em cada card. Novidades são edições
        publicadas nos últimos 30 dias; datas e bancas vêm de fontes oficiais revisadas.
      </p>
      <div className={styles.phaseTabs} role="group" aria-label="Situação das preparações">
        {tabs.map(([key, label]) => (
          <button key={key} type="button" aria-pressed={phase === key} onClick={() => setPhase(key)}>
            {label} <span>{cards.filter((card) => matchesTab(card, key)).length}</span>
          </button>
        ))}
      </div>
      <div className={styles.catalogFilters}>
        <label>Carreira
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="all">Todas as carreiras</option>
            {contestCategories.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}
          </select>
        </label>
        <label>Banca
          <select value={bank} onChange={(event) => setBank(event.target.value)}>
            <option value="all">Todas as bancas</option>
            {banks.map(([slug, name]) => <option key={slug} value={slug}>{name}</option>)}
            <option value="unconfirmed">Banca a confirmar</option>
          </select>
        </label>
        <label>Estado / abrangência
          <select value={state} onChange={(event) => setState(event.target.value)}>
            <option value="all">Todos os locais</option>
            {opportunityJurisdictions.filter((item) => cards.some((card) => card.jurisdictionCodes.includes(item.code)))
              .map((item) => <option key={item.code} value={item.code}>{item.code === "BR" ? "Nacional" : item.name}</option>)}
          </select>
        </label>
        <label>Órgão ou cargo
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ex.: PC-MA, juiz, auditor" />
        </label>
      </div>
      <div className={styles.resultsHeading}>
        <p className={styles.catalogCount} aria-live="polite">{matches.length} preparações encontradas</p>
        <button type="button" onClick={() => { setCategory("all"); setState("all"); setBank("all"); setPhase("all"); setQuery(""); }}>Limpar filtros</button>
      </div>
      <div className={styles.grid}>
        {matches.map((card) => (
          <article className={`${styles.card} ${card.available ? styles.availableCard : ""} ${card.phase === "closed" ? styles.closedCard : ""}`} key={card.slug}>
            <div className={styles.cardTop}>
              <span className={styles.eyebrow}>{contestCategories.find((item) => item.slug === card.categorySlug)?.name}</span>
              {card.isNew && <span className={styles.newBadge}><Sparkles size={12} aria-hidden="true" /> Novo</span>}
            </div>
            <h3>{card.acronym}</h3>
            <p className={styles.cardRole}>{card.role}</p>
            <p>{card.jurisdictionCodes.join(" / ")} · {card.edition}</p>
            <div className={styles.cardFacts}>
              <span className={styles.phaseBadge}>{card.phaseLabel}</span>
              <p>Banca: {card.bankName ?? "a confirmar"}</p>
              {card.examDate && <p>Prova: {card.examDate.split("-").reverse().join("/")}</p>}
            </div>
            <p className={card.available ? styles.availableText : ""}>
              {card.available ? <><BookOpen size={15} aria-hidden="true" /> Preparação disponível</>
                : card.phase === "closed" ? "Edição encerrada · consulte o histórico"
                : "Material em preparação"}
            </p>
            <Link prefetch={false} href={card.href}>
              {card.available ? "Ver preparação" : card.phase === "closed" ? "Ver histórico" : "Conhecer a preparação"}
              <ArrowUpRight size={16} aria-hidden="true" />
              <span className="sr-only"> · {card.acronym} · {card.role}</span>
            </Link>
          </article>
        ))}
      </div>
      {!matches.length && <p className={styles.empty}>Nenhuma preparação corresponde aos filtros. Experimente outra banca, carreira ou estado.</p>}
    </section>
  );
}
