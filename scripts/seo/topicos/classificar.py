"""Classifica topic_id das questões reviewed sem tema pela estrutura oficial da lei.

Somente leitura: lê os CSVs exportados (ver README.md) e escreve um CSV com a
proposta (question_id, topic_id, origem, confiança). Nada é gravado no banco.

Uso: python3 -I classificar.py <dir_csv> <saida.csv> [--amostra N --semente S]
"""
import csv
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from estrutura import article_ref_key, load_structures  # noqa: E402
from regras import classify, is_broad  # noqa: E402

VERSION = "estrutura-oficial-v1"


def main() -> None:
    src, out = Path(sys.argv[1]), Path(sys.argv[2])
    sample = int(sys.argv[sys.argv.index("--amostra") + 1]) if "--amostra" in sys.argv else 0
    seed = int(sys.argv[sys.argv.index("--semente") + 1]) if "--semente" in sys.argv else 20261121

    structures, snap_status = load_structures(str(src / "snap.csv"))
    subjects = {r["name"]: int(r["id"]) for r in csv.DictReader(open(src / "subjects.csv", encoding="utf-8"))}
    subject_name = {v: k for k, v in subjects.items()}
    topics = {(r["subject"], r["name"]): int(r["id"]) for r in csv.DictReader(open(src / "topics.csv", encoding="utf-8"))}
    topic_name = {v: f"{k[0]} › {k[1]}" for k, v in topics.items()}
    articles = {int(r["id"]): (r["slug"], r["article_ref"]) for r in csv.DictReader(open(src / "art.csv", encoding="utf-8"))}
    questions = list(csv.DictReader(open(src / "q.csv", encoding="utf-8")))

    def propose(q: dict[str, str]) -> dict[str, str] | None:
        if not q["legal_article_id"]:
            return None
        art = articles.get(int(q["legal_article_id"]))
        if not art:
            return None
        slug, ref = art
        key = article_ref_key(ref)
        path = structures.get(slug, {}).get(key) if key else None
        if path is None:
            return None
        hit = classify(slug, path)
        if not hit:
            return None
        subj, topic, rule = hit
        topic_id = topics.get((subj, topic))
        if topic_id is None:
            raise SystemExit(f"Tema inexistente na taxonomia: {subj} › {topic}")
        q_subject = subject_name.get(int(q["subject_id"])) if q["subject_id"] else None
        # Alta: a matéria da questão é a do tema. Média: matéria diferente (ex.: questão de
        # Administrativo sobre o art. 37 da CF). Versão da lei não aprovada rebaixa um nível.
        confidence = "alta" if q_subject == subj else "media"
        if is_broad(slug, topic) and confidence == "alta":
            confidence = "media"
        if snap_status.get(slug) != "approved":
            confidence = "media" if confidence == "alta" else "baixa"
        return {
            "question_id": q["id"], "topic_id": str(topic_id), "tema": topic_name[topic_id],
            "materia_questao": q_subject or "", "origem": f"{VERSION} | {rule} | {' > '.join(path)}",
            "confianca": confidence, "artigo": f"{slug} {ref}", "enunciado": q["prompt"],
        }

    # Conferência com as questões que já têm tema (rótulo editorial existente).
    labeled = [q for q in questions if q["topic_id"]]
    hits = misses = uncovered = 0
    for q in labeled:
        p = propose(q)
        if not p:
            uncovered += 1
        elif p["topic_id"] == q["topic_id"]:
            hits += 1
        else:
            misses += 1
    print(f"rotuladas={len(labeled)} acerto={hits} erro={misses} sem_regra={uncovered}")

    pending = [q for q in questions if not q["topic_id"]]
    proposals = [p for p in (propose(q) for q in pending) if p]
    by_conf: dict[str, int] = {}
    for p in proposals:
        by_conf[p["confianca"]] = by_conf.get(p["confianca"], 0) + 1
    print(f"sem_tema={len(pending)} classificadas={len(proposals)} por_confianca={by_conf}")

    rows = proposals
    if sample:
        rows = random.Random(seed).sample(proposals, min(sample, len(proposals)))
    with open(out, "w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
    print(f"gravado {out} ({len(rows)} linhas)")


if __name__ == "__main__":
    main()
