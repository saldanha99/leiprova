"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  MapPin,
  Search,
  X,
} from "lucide-react";
import { contestCategories } from "@/lib/opportunities/categories";
import { opportunityJurisdictions } from "@/lib/opportunities/jurisdictions";
import {
  CONTEST_CATALOG,
  catalogContestPath,
  contestTitle,
} from "@/lib/commerce/catalog";
import styles from "./contest-catalog.module.css";
import { useReleasedContests } from "./use-released-contests";

export function ContestMegaMenu() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const released = useReleasedContests(open);
  const [category, setCategory] = useState("carreiras-policiais");
  const [state, setState] = useState("all");
  const [search, setSearch] = useState("");
  const categoryContests = CONTEST_CATALOG.filter(
    (contest) => contest.categorySlug === category,
  );
  const states = opportunityJurisdictions.filter((jurisdiction) =>
    categoryContests.some((contest) =>
      contest.jurisdictionCodes.includes(jurisdiction.code),
    ),
  );
  const query = search
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
  const contests = categoryContests.filter(
    (contest) =>
      (state === "all" || contest.jurisdictionCodes.includes(state)) &&
      `${contestTitle(contest)} ${contest.editionLabel}`
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase("pt-BR")
        .includes(query),
  );
  const categoryName = contestCategories.find(
    (item) => item.slug === category,
  )?.name;

  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => {
          dialog.current?.showModal();
          setOpen(true);
        }}
        aria-haspopup="dialog"
      >
        Concursos <ChevronDown size={15} aria-hidden="true" />
      </button>
      <dialog
        ref={dialog}
        className={styles.dialog}
        aria-label="Encontre seu concurso"
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) dialog.current?.close();
        }}
      >
        <div className={styles.menuSurface}>
          <div className={styles.menuHeading}>
            <div>
              <span className={styles.eyebrow}>SEU PRÓXIMO CAPÍTULO</span>
              <h2>Qual é o seu concurso?</h2>
            </div>
            <button
              className={styles.close}
              type="button"
              aria-label="Fechar menu de concursos"
              onClick={() => dialog.current?.close()}
            >
              <X aria-hidden="true" />
            </button>
          </div>
          <div className={styles.menuColumns}>
            <section
              className={styles.careers}
              aria-label="1. Escolha a carreira"
            >
              <p className={styles.columnLabel}>01 / Carreira</p>
              {contestCategories.map((item) => (
                <button
                  key={item.slug}
                  type="button"
                  aria-pressed={category === item.slug}
                  onClick={() => {
                    setCategory(item.slug);
                    setState("all");
                    setSearch("");
                  }}
                >
                  <span>{item.name}</span>
                  <ChevronRight size={15} aria-hidden="true" />
                </button>
              ))}
            </section>
            <section className={styles.states} aria-label="2. Escolha o estado">
              <p className={styles.columnLabel}>02 / Onde você quer chegar</p>
              <button
                type="button"
                aria-pressed={state === "all"}
                onClick={() => setState("all")}
              >
                Todos os locais
              </button>
              {states.map((item) => (
                <button
                  key={item.code}
                  type="button"
                  aria-pressed={state === item.code}
                  onClick={() => setState(item.code)}
                >
                  {item.code === "BR" ? "Nacional" : item.name}
                </button>
              ))}
            </section>
            <section
              className={styles.results}
              aria-label="3. Escolha o concurso"
            >
              <p className={styles.columnLabel}>03 / {categoryName}</p>
              <label className={styles.search}>
                <Search aria-hidden="true" size={18} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Busque órgão ou cargo"
                  aria-label="Buscar concurso nesta carreira"
                />
              </label>
              <p className={styles.resultCount} aria-live="polite">
                {contests.length}{" "}
                {contests.length === 1
                  ? "concurso encontrado"
                  : "concursos encontrados"}
              </p>
              <div className={styles.resultList}>
                {contests.map((contest) => (
                  <Link
                    prefetch={false}
                    key={contest.slug}
                    href={catalogContestPath(contest)}
                    onClick={() => dialog.current?.close()}
                  >
                    <span>
                      <strong>{contest.acronym}</strong>
                      <small>{contest.role}</small>
                      <span className={styles.itemMeta}>
                        <MapPin size={11} aria-hidden="true" />{" "}
                        {contest.jurisdictionCodes.join(" / ")} ·{" "}
                        {contest.editionLabel}
                      </span>
                    </span>
                    <span className={styles.draftBadge}>
                      {released.includes(contest.slug)
                        ? "Conteúdo liberado"
                        : "Em preparação"}{" "}
                      <ArrowUpRight size={12} aria-hidden="true" />
                    </span>
                  </Link>
                ))}
                {contests.length === 0 && (
                  <p className={styles.empty}>
                    Nenhum resultado neste recorte. Tente outro estado ou termo.
                  </p>
                )}
              </div>
            </section>
          </div>
          <div className={styles.menuFooter}>
            <p>Uma edição. Um produto. Seu estudo no lugar certo.</p>
            <Link href="/concursos" onClick={() => dialog.current?.close()}>
              Explorar catálogo <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
            <Link href="/#planos" onClick={() => dialog.current?.close()}>
              Conhecer o Master
            </Link>
          </div>
        </div>
      </dialog>
    </>
  );
}
