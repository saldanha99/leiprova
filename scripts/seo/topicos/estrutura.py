"""Extrai o caminho estrutural (Parte/Livro/Título/Capítulo/Seção) de cada artigo
a partir do texto oficial aprovado (legal_text_snapshots.normalized_content).

Somente leitura: recebe CSVs exportados do banco e devolve um dicionário
{(slug, numero_normalizado): [cabeçalhos]}.
"""
import csv
import re
import sys

csv.field_size_limit(sys.maxsize)

HEADER = re.compile(
    r"^(PARTE\s+(?:GERAL|ESPECIAL)|LIVRO\s+(?:[IVXLC]+\b|PRIMEIRO|SEGUNDO|TERCEIRO|QUARTO|QUINTO|COMPLEMENTAR)|T[IÍ]TULO\s+[IVXLC]+(?:-[A-Z])?"
    r"|CAP[IÍ]TULO\s+[IVXLC]+(?:-[A-Z])?|SE[CÇ][AÃ]O\s+[IVXLC]+(?:-[A-Z])?|ATO DAS DISPOSI[CÇ][OÕ]ES)",
    re.IGNORECASE,
)
LEVELS = ["parte", "livro", "titulo", "capitulo", "secao"]
ARTICLE = re.compile(r"^Art\.\s*(\d{1,3}(?:\.\d{3})+|\d+)\s*(?:º|o|°)?\s*(?:-\s*([A-Z]))?(?=[\s.\-–])")


def level_of(header: str) -> str:
    h = header.upper()
    if h.startswith("PARTE") or h.startswith("ATO DAS"):
        return "parte"
    if h.startswith("LIVRO"):
        return "livro"
    if h.startswith("T"):
        return "titulo"
    if h.startswith("CAP"):
        return "capitulo"
    return "secao"


def norm_ref(number: str, letter: str | None) -> str:
    n = int(number.replace(".", ""))
    return f"{n}-{letter.lower()}" if letter else str(n)


def parse(content: str) -> dict[str, list[str]]:
    """Mapeia número do artigo -> cabeçalhos vigentes (com o nome do bloco)."""
    lines = [ln.strip() for ln in content.splitlines()]
    current: dict[str, str] = {}
    out: dict[str, list[str]] = {}
    adct = False
    i = 0
    while i < len(lines):
        line = lines[i]
        m = HEADER.match(line)
        if m and len(line) < 120:
            lvl = level_of(m.group(1))
            if m.group(1).upper().startswith("ATO DAS"):
                adct = True
            name = line
            nxt = lines[i + 1] if i + 1 < len(lines) else ""
            if nxt and not HEADER.match(nxt) and not ARTICLE.match(nxt) and len(nxt) < 160:
                name = f"{line} — {nxt}"
                i += 1
            current[lvl] = name
            for deeper in LEVELS[LEVELS.index(lvl) + 1:]:
                current.pop(deeper, None)
        else:
            a = ARTICLE.match(line)
            if a and not adct:
                ref = norm_ref(a.group(1), a.group(2))
                if ref not in out:  # primeira ocorrência = dispositivo principal
                    out[ref] = [current[k] for k in LEVELS if k in current]
        i += 1
    return out


def article_ref_key(article_ref: str) -> str | None:
    m = re.match(r"^Art\.\s*(\d{1,3}(?:\.\d{3})+|\d+)\s*(?:º|o|°)?\s*(?:-\s*([A-Z]))?", article_ref.strip(), re.IGNORECASE)
    if not m:
        return None
    return norm_ref(m.group(1), m.group(2).upper() if m.group(2) else None)


def load_structures(snap_csv: str) -> tuple[dict[str, dict[str, list[str]]], dict[str, str]]:
    structures: dict[str, dict[str, list[str]]] = {}
    status: dict[str, str] = {}
    with open(snap_csv, newline="", encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            structures[row["slug"]] = parse(row["normalized_content"])
            status[row["slug"]] = row["status"]
    return structures, status
