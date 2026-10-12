# Revisão automatizada delimitada da LGPD

Base: decisão explícita do proprietário em 12/10/2026, registrada em
`AUTORIZACAO-FONTES-PROGRAMAS-2026-10-12.md`. Este operador cobre somente a LGPD
da Câmara e o monitoramento da mesma norma no Senado. Não altera o loader de
captura, o painel de revisão ou a autorização de quaisquer outros atos.

## Correção encontrada antes de ativar

A revisão posterior à captura inicial encontrou **14 títulos de seção** em
capitalização normal anexados ao artigo anterior, por exemplo “Das Regras” ao
art. 22. O parser `camara-lgpd-consolidated-v1.0.0` e a fotografia de hash
`71f77103cbbe70b19a0f05d0060f34fbe8f51eb3f6c3e109182a0ec8d219741c` não devem ser
aprovados. A nova autorização não transforma texto mal extraído em conteúdo válido.

Parser **v1.0.1** trata o título que segue o identificador de seção/capítulo,
inclusive notas editoriais entre eles. Regressão adicionada. Comparação privada
das duas preparações do mesmo HTML oficial confirmou: 72 artigos antes/depois,
remoção dos 14 títulos e nenhuma mudança substantiva inesperada nos demais
parágrafos. Nova fotografia preparada:
`2189954871b10f2cdec1609149aa12ab2cd836343407fb8c26f2b1429c0fb490`.
Isso não é recibo de aprovação ou de carga no banco.

Arquivos integrais e comparação estão privados em
`.local/editorial/fontes-alternativas-20261011/`, fora de Git/Docker/provedores.
Antes da operação, capturar novamente a fonte em acesso regular com o novo parser.
Conferir/rejeitar o rascunho anterior preservando seu histórico. Este comando não
rejeita fotografias antigas, não faz limpeza de dados nem restaura versões.

## Preparar inspeção e prévia

```sh
pnpm legal:law:review:standing --inspect snapshot=<UUID da nova fotografia>
```

A inspeção lê somente a fotografia exata e retorna checksum, fingerprint, parser,
URL, monitor vinculado, estados e contagem. Não inclui corpo legal ou dados de
conta no relatório. Rejeita fonte/parser fora do escopo, incluindo v1.0.0.

Para revisar, ambiente de manutenção protegido na VPS:
`MIGRATION_DATABASE_URL` do banco `leiprova`, usuário `leiprova_owner`, administrador
único (configurado por `ADMIN_EMAILS` ou único admin no banco) e referência exata:

```text
LEGAL_STANDING_REVIEW_REFERENCE=owner-standing-2026-10-12:official-sources-programs
```

```sh
pnpm legal:law:review:standing --standing snapshot=<UUID> checksum=<SHA256> fingerprint=<SHA256>
# Após conferir a prévia, o mesmo comando com --apply aplica a decisão.
```

Sem `--apply`, nenhuma escrita/transação de ativação é executada. `--inspect`
não pode ser combinado com `--apply` ou parâmetros de aprovação. UUID, checksum,
fingerprint e `--standing` são obrigatórios para revisão; argumentos desconhecidos,
duplicados, outras leis, rejeitados/superados e páginas alternativas são bloqueados.

## Conferências e execução

O fingerprint vincula ato, IDs das fotografias, monitor, origem, parser, conteúdos,
contagem e datas imutáveis; estados de revisão não o modificam, permitindo retry
delimitado. O corpus precisa corresponder ao checksum ligado a URL/parser e à
seleção exata de 72 artigos substantivos, sem vetados/revogados, art. 60, títulos ou
notas editoriais. Nenhuma conclusão sobre fontes de outros atos é presumida.

Cada execução de revisão busca **de novo** o monitor Senado e o texto Câmara em
acesso regular. URLs, checksum, conteúdo, parser e contagem devem coincidir
integralmente com as fotografias indicadas. Conferência de no máximo cinco minutos,
sem aceitar relógio futuro relevante. Falha de rede/robots, alteração oficial ou
qualquer diferença bloqueia, sem usar HTML privado/cached para substituir a rede.

Rede fica fora da transação. A aplicação trava primeiro o ato, depois as duas
fotografias, refaz todas as verificações e confere o admin. Transação serializável,
um cliente, timeout de lock de 5 s e de comando de 30 s; rollback integral em falha.
Não cria papéis, credenciais ou grants, e não usa a conexão da aplicação.

Aprova primeiro monitor pendente, depois fotografia textual; supera somente
versões/aprovações anteriores da mesma LGPD e insere a versão atual e os 72 artigos.
Preserva IDs do ato. Não cria questões, vínculos, produtos ou flags comerciais.
Auditoria: `owner_standing_authorization`, referência estável, `humanReview:false`,
checksum/fingerprint/parser/URLs/datas do confronto fresco. Identificar o admin
não é declarar que ele revisou pessoalmente o texto.

Retry de fotografia aprovada aceita somente recibo permanente exato e versão atual
correspondente com todos os artigos idênticos, revisados e de texto oficial. Caso
contrário, falha; não reativa versão retirada ou repara silenciosamente conteúdo
suspenso. Prévia de uma fotografia já aprovada também confere esse recibo.

Maestro deve conferir depois e suspender inconsistências conforme a nova decisão.
Um relatório de prévia ou uma captura pendente não comprova execução/aprovação.
Root valida o código/prévia e registra os recibos reais quando executar na VPS.
