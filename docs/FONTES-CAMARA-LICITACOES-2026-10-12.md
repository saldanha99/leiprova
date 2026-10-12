# Lei 14.133: PDF oficial preparado para revisão

Implementação em 12/10/2026 (BRT), para Edital Lei Seca. Estado: preparação técnica,
sem escrita no banco, aprovação, versão vigente ou autoria nesta tarefa.

## Origem delimitada

[Ficha Câmara, identidade 791222](https://www2.camara.leg.br/legin/fed/lei/2021/lei-14133-1-abril-2021-791222-norma-pl.html)
oferece o [PDF atualizado](https://www2.camara.leg.br/legin/fed/lei/2021/lei-14133-1-abril-2021-791222-normaatualizada-pl.pdf).
Acesso regular previamente verificado: robots e PDF HTTP 200, MIME PDF e assinatura
válida, 412466 bytes, 88 páginas. Sem UA falso, TLS relaxado, contorno ou API paga.
O HTML alternativo devolveu página de erro 504 dentro de HTTP 200; não é aceito.

Monitor e identidade do ato continuam no [Senado, norma 33382036](https://legis.senado.leg.br/norma/33382036).
Slug, URN, `officialUrl` Planalto, IDs e versões existentes são preservados.
Migração `0051` adiciona somente a URL PDF exata acima à restrição textual.
Não libera PDF de outra lei, domínio inteiro, publicação original, queries,
fragmentos ou redirects. Nenhum DDL altera versões, artigos ou permissões.

## Captura e extração

`fetchOfficialConsolidatedLegalText` prefere Câmara somente para LGPD e Lei 14.133.
Provider `planalto` continua explícito; `senado` continua exigindo compilação
monovigente. O caminho novo consulta robots antes do PDF, usa timeout e limite de
15 MB, valida MIME/assinatura e recusa HTML/erro mesmo em HTTP 200.

Parser `camara-procurement-pdf-unpdf1.8.1-v1.0.0`: extração por página, máximo 150
páginas/2 milhões de caracteres, sem OCR automático. Identificação oficial no
início e sequência própria completa dos arts. 1–194, com 44-A/184-A. Rejeita
duplicatas, lacunas, estrangeiros fora dos três blocos alteradores e caracteres
inválidos. Recompõe continuações entre páginas e compostos hifenizados; `art.`
minúsculo que inicia linha física não vira novo artigo. Títulos de capítulo/seção
não são anexados ao corpo normativo.

Remove notas editoriais e marcadores retirados sem texto substantivo. Revogação
explícita de parágrafo é retirada; artigo revogado com texto impresso bloqueia,
para não reatribuir seus parágrafos ao artigo anterior. Arts. 177–179, que alteram
outros códigos, ficam fora; vetados 172/188 não entram como dispositivos ativos.
A seleção resultante é **191 artigos preparados**, não reprodução integral de
dispositivos retirados ou das normas alteradas. Hash vincula URL/parser/corpus.

## Limitações preservadas, sem inferir vigência

- **Valores nominais:** arts. 6, 37, 70, 75, 95 e 184-A trazem dependências de
  decretos anuais. Retirar a nota do literal não atualiza quantias. Não gerar
  perguntas sobre limites monetários atuais usando somente valores-base da lei.
- **ADI:** art. 75 tem referência judicial. A ficha oficial também registra
  interpretação constitucional. Extração de lei literal não resolve esse alcance.
- **Vetos/promulgação:** texto substantivo dos arts. 37, 54, 90, 105, 115, 175,
  184 e 184-A possui anotações sobre dispositivo vetado pelo Presidente e mantido
  pelo Congresso/publicado no DOU. O adaptador conserva esse texto oficial e o
  marca para confronto primário. Não presume que “mantido” signifique manutenção
  do veto, nem remove dispositivo promulgado por interpretação automática.
- **Transição:** arts. 191/193 contêm prazo encerrado em 2023. Não apresentar a
  antiga opção licitatória como disponível atualmente.
- **Outros códigos:** usar CPC/CP/Lei de Concessões vigentes para os dispositivos
  originalmente introduzidos pelos arts. 177–179.

As limitações entram no resultado preparado e na auditoria do loader de captura
pendente. A extensão do proprietário permite revisão automatizada, mas nenhuma
aprovação desta nova fonte está implementada/executada nesta rodada. O CLI
standing LGPD permanece restrito à LGPD; não autoriza o PDF da Lei 14.133.

## Operação a validar pelo root

```sh
pnpm legal:laws:load --capture-only --provider=camara lei=lei-licitacoes-contratos-2021
# Após validar código/migração/prévia, --apply grava somente fotografias pendentes.
```

Rede fora da transação, administrador/referência e reversão da prévia existentes.
Sem `--capture-only`, loader continua recusando essas compilações alternativas.
Não ativa artigos/versão atual, cria questões ou altera produtos/flags.

## Evidência privada e validação

PDF oficial e arquivos de comparação preservados somente sob
`.local/editorial/fontes-alternativas-20261011/`, fora de Git/Docker/provedores.
Inspeção visual de páginas relevantes confirmou notas, transições e limites de
página. Extração com **unpdf e Poppler independentemente**, seguida do mesmo
agrupamento normativo, produziu **191 artigos e corpos normalizados idênticos**,
sem diferenças entre as duas ferramentas. Isso verifica extração; as limitações
jurídicas acima continuam pendentes de revisão.

- PDF bruto: `55643452fd720ee726267f62ad2ee59bff0120c5ec9495b9ee7babc74c5ea026`.
- Corpus canônico: `e622788d8a7da96d4e77deb8a1ea458ca1014fc44a8dd8a86df310d02a598e8a`.
- Fotografia preparada: `27087b4f3c79a0e0cfa77943d2288188f81e86c33d7d6da15e8f14b483f5a20f`.

49 testes direcionados em sete arquivos passaram com dois workers e limite
Node de 384 MB; lint dirigido passou. Fixtures usam texto sintético, sem corpo
oficial integral versionado. Root faz QA integral, publicação e captura real no
destino depois de conferir esta implementação; nenhum recibo de DB é presumido.
