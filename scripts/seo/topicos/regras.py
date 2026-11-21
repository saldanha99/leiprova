"""Regras estrutura oficial -> tema (quiz_topics). Cada regra cita o bloco da lei.

Ordem importa: a primeira regra que casar vence. Regex aplicada ao caminho
estrutural do artigo (cabeçalhos unidos por " > "), sem acento-sensibilidade no
"I" de TÍTULO/CAPÍTULO (o texto oficial usa as duas grafias).
"""
import re

# (slug da lei, regex no caminho, matéria, tema)
RULES: list[tuple[str, str, str, str]] = [
    # Constituição
    ("constituicao-federal-1988", r"T.TULO II\b.*CAP.TULO IV\b", "Direito Eleitoral", "Direitos políticos"),
    ("constituicao-federal-1988", r"T.TULO II\b.*CAP.TULO V\b", "Direito Eleitoral", "Partidos políticos"),
    ("constituicao-federal-1988", r"T.TULO II\b", "Direito Constitucional", "Direitos e garantias fundamentais"),
    ("constituicao-federal-1988", r"T.TULO III\b.*CAP.TULO VII\b", "Direito Constitucional", "Administração pública"),
    ("constituicao-federal-1988", r"T.TULO IV\b.*CAP.TULO II\b", "Direito Constitucional", "Poder Executivo"),
    ("constituicao-federal-1988", r"T.TULO V\b.*CAP.TULO III\b", "Direito Constitucional", "Segurança pública"),
    ("constituicao-federal-1988", r"T.TULO VI\b.*CAP.TULO I\b", "Direito Tributário", "Sistema Tributário Nacional"),
    # Código Penal
    ("codigo-penal", r"PARTE GERAL", "Direito Penal", "Parte geral"),
    ("codigo-penal", r"T.TULO I\b", "Direito Penal", "Crimes contra a pessoa"),
    ("codigo-penal", r"T.TULO II\b", "Direito Penal", "Crimes contra o patrimônio"),
    ("codigo-penal", r"T.TULO XI\b", "Direito Penal", "Crimes contra a Administração Pública"),
    # Código de Processo Penal (Livro I)
    ("codigo-processo-penal", r"LIVRO I\b.*T.TULO II\b", "Direito Processual Penal", "Inquérito policial"),
    ("codigo-processo-penal", r"LIVRO I\b.*T.TULO III\b", "Direito Processual Penal", "Ação penal"),
    ("codigo-processo-penal", r"LIVRO I\b.*T.TULO VII\b", "Direito Processual Penal", "Provas"),
    ("codigo-processo-penal", r"LIVRO I\b.*T.TULO IX\b", "Direito Processual Penal", "Prisões e medidas cautelares"),
    # Código Civil
    ("codigo-civil-2002", r"PARTE GERAL", "Direito Civil", "Parte geral"),
    ("codigo-civil-2002", r"LIVRO I\b.*T.TULO (V|VI)\b", "Direito Civil", "Contratos"),
    ("codigo-civil-2002", r"LIVRO I\b.*T.TULO VIII\b", "Direito Empresarial", "Títulos de crédito"),
    ("codigo-civil-2002", r"LIVRO I\b.*T.TULO IX\b", "Direito Civil", "Responsabilidade civil"),
    ("codigo-civil-2002", r"LIVRO I\b", "Direito Civil", "Obrigações"),
    ("codigo-civil-2002", r"LIVRO II\b", "Direito Empresarial", "Empresário e sociedades"),
    ("codigo-civil-2002", r"LIVRO (IV|V)\b", "Direito Civil", "Família e sucessões"),
    # Código de Processo Civil
    ("codigo-processo-civil-2015", r"PARTE GERAL", "Direito Processual Civil", "Parte geral"),
    ("codigo-processo-civil-2015", r"PARTE ESPECIAL.*LIVRO I\b.*T.TULO I\b", "Direito Processual Civil", "Procedimento comum"),
    ("codigo-processo-civil-2015", r"PARTE ESPECIAL.*LIVRO II\b", "Direito Processual Civil", "Execução"),
    ("codigo-processo-civil-2015", r"PARTE ESPECIAL.*LIVRO III\b.*T.TULO II\b", "Direito Processual Civil", "Recursos"),
    # CTN
    ("codigo-tributario-nacional", r"LIVRO PRIMEIRO", "Direito Tributário", "Sistema Tributário Nacional"),
    ("codigo-tributario-nacional", r"T.TULO II\b.*OBRIGA", "Direito Tributário", "Obrigação tributária"),
    ("codigo-tributario-nacional", r"T.TULO III\b.*CR.DITO", "Direito Tributário", "Crédito tributário"),
    # CLT
    ("consolidacao-leis-trabalho", r"T.TULO II\b.*CAP.TULO II\b", "Direito do Trabalho", "Duração do trabalho"),
    ("consolidacao-leis-trabalho", r"T.TULO IV\b", "Direito do Trabalho", "Contrato de trabalho"),
    ("consolidacao-leis-trabalho", r"T.TULO X\b.*CAP.TULO VI\b", "Direito Processual do Trabalho", "Recursos"),
    ("consolidacao-leis-trabalho", r"T.TULO X\b", "Direito Processual do Trabalho", "Procedimentos"),
    ("consolidacao-leis-trabalho", r"T.TULO VIII\b", "Direito Processual do Trabalho", "Competência"),
    # Leis inteiras com tema próprio
    ("lei-falencias-recuperacao-2005", r".*", "Direito Empresarial", "Recuperação e falência"),
    ("lei-licitacoes-contratos-2021", r".*", "Direito Administrativo", "Licitações e contratos"),
    ("regime-juridico-servidores-federais", r".*", "Direito Administrativo", "Agentes públicos"),
    ("lei-processo-administrativo-1999", r".*", "Direito Administrativo", "Atos administrativos"),
    ("codigo-eleitoral-1965", r".*", "Direito Eleitoral", "Processo eleitoral"),
    ("lei-eleicoes-1997", r".*", "Direito Eleitoral", "Processo eleitoral"),
    ("lei-inelegibilidades-1990", r".*", "Direito Eleitoral", "Direitos políticos"),
]

LAW_LEVEL_SPECIAL = {
    # Legislação Especial: só quando a matéria da questão for essa (é tema de agrupamento).
    "Estatutos": {"estatuto-crianca-adolescente", "estatuto-pessoa-idosa-2003", "estatuto-pessoa-deficiencia-2015",
                  "estatuto-terra-1964", "estatuto-desarmamento-2003"},
    "Leis penais especiais": {"lei-drogas-2006", "lei-crimes-hediondos-1990", "lei-abuso-autoridade-2019",
                              "lei-organizacoes-criminosas-2013", "lei-lavagem-dinheiro-1998", "lei-maria-da-penha-2006",
                              "lei-tortura-1997", "lei-crimes-ambientais-1998", "lei-crimes-ordem-tributaria-1990",
                              "lei-crimes-raciais-1989"},
    "Normas institucionais": {"lei-organica-magistratura-1979", "lei-notarios-registradores-1994"},
}

# Encaixe largo (o bloco da lei cabe no tema, mas o tema não o descreve bem): confiança
# no máximo "media".
BROAD = {
    ("consolidacao-leis-trabalho", "Competência"),
    ("lei-processo-administrativo-1999", "Atos administrativos"),
    ("codigo-eleitoral-1965", "Processo eleitoral"),
}

_COMPILED = [(slug, re.compile(rx, re.IGNORECASE), subj, topic) for slug, rx, subj, topic in RULES]


def is_broad(slug: str, topic: str) -> bool:
    return (slug, topic) in BROAD


def classify(slug: str, path: list[str]) -> tuple[str, str, str] | None:
    """Devolve (matéria, tema, regra) ou None."""
    joined = " > ".join(path)
    for rule_slug, rx, subj, topic in _COMPILED:
        if rule_slug == slug and rx.search(joined):
            return subj, topic, f"{slug}: /{rx.pattern}/"
    for topic, slugs in LAW_LEVEL_SPECIAL.items():
        if slug in slugs:
            return "Legislação Especial", topic, f"{slug}: lei inteira"
    return None
