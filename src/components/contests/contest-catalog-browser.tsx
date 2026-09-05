"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import {
  CONTEST_CATALOG,
  catalogContestPath,
  CONTEST_ACCESS_OPTIONS,
} from "@/lib/commerce/catalog";
import { contestCategories } from "@/lib/opportunities/categories";
import { opportunityJurisdictions } from "@/lib/opportunities/jurisdictions";
import { formatBRL } from "@/lib/plans";
import styles from "./contest-catalog.module.css";
import { useReleasedContests } from "./use-released-contests";

export function ContestCatalogBrowser() {
  const released = useReleasedContests();
  const [category, setCategory] = useState("all");
  const [state, setState] = useState("all");
  const [query, setQuery] = useState("");
  const normalize = (text: string) =>
    text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const matches = CONTEST_CATALOG.filter(
    (contest) =>
      (category === "all" || contest.categorySlug === category) &&
      (state === "all" || contest.jurisdictionCodes.includes(state)) &&
      normalize(
        `${contest.acronym} ${contest.role} ${contest.editionLabel}`,
      ).includes(normalize(query.trim())),
  );
  return (
    <section id="catalogo-planejado" aria-labelledby="catalogo-planejado-title">
      <p className={styles.eyebrow}>ESCOLHA SEU DESTINO</p>
      <h2
        id="catalogo-planejado-title"
        className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl"
      >
        Um concurso. Um caminho só seu.
      </h2>
      <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-400">
        Explore as frentes do nosso planejamento. Estas ofertas estão em
        preparação, ainda sem venda. A presença nesta lista não confirma edital
        aberto, banca ou material pronto.
      </p>
      <div className={styles.catalogFilters}>
        <label>
          Carreira
          <select
            value={category}
            onChange={(event) => {
              setCategory(event.target.value);
              setState("all");
            }}
          >
            <option value="all">Todas as carreiras</option>
            {contestCategories.map((item) => (
              <option key={item.slug} value={item.slug}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Estado / abrangência
          <select
            value={state}
            onChange={(event) => setState(event.target.value)}
          >
            <option value="all">Todos os locais</option>
            {opportunityJurisdictions
              .filter((item) =>
                CONTEST_CATALOG.some(
                  (contest) =>
                    (category === "all" || contest.categorySlug === category) &&
                    contest.jurisdictionCodes.includes(item.code),
                ),
              )
              .map((item) => (
                <option key={item.code} value={item.code}>
                  {item.code === "BR" ? "Nacional" : item.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          Órgão ou cargo
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ex.: PC-BA, juiz, auditor"
          />
        </label>
      </div>
      <p className={styles.catalogCount} aria-live="polite">
        {matches.length} concursos em planejamento · assinatura individual
        prevista a partir de {formatBRL(CONTEST_ACCESS_OPTIONS[0].amountCents)}
        /mês
      </p>
      {contestCategories.map((item) => {
        const contests = matches.filter(
          (contest) => contest.categorySlug === item.slug,
        );
        if (!contests.length) return null;
        return (
          <section
            className={styles.catalogGroup}
            key={item.slug}
            id={`catalogo-${item.slug}`}
          >
            <h2>
              {item.name}
              <span>{contests.length} concursos</span>
            </h2>
            <div className={styles.grid}>
              {contests.map((contest) => (
                <article className={styles.card} key={contest.slug}>
                  <span className={styles.eyebrow}>
                    {contest.jurisdictionCodes.join(" / ")} ·{" "}
                    {contest.editionLabel}
                  </span>
                  <h3>{contest.acronym}</h3>
                  <p>{contest.role}</p>
                  <p>
                    {released.includes(contest.slug)
                      ? "Conteúdo liberado"
                      : "Em preparação editorial"}
                  </p>
                  <Link prefetch={false} href={catalogContestPath(contest)}>
                    Conhecer a proposta{" "}
                    <ArrowUpRight size={16} aria-hidden="true" />
                  </Link>
                </article>
              ))}
            </div>
          </section>
        );
      })}
      {!matches.length && (
        <p className={styles.empty}>
          Nenhum concurso corresponde aos filtros. Tente outra carreira ou
          estado.
        </p>
      )}
    </section>
  );
}
