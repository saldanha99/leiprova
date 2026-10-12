# PGE-AC VIII/2026: edição-base e links oficiais externos

Operador delimitado ao produto `pge-ac-procurador-do-estado-reta-final`, oportunidade pública `f16c8847-9d0d-4c47-84f8-752f3a72562d`, Procurador do Estado — Classe I, AC, edição VIII/2026. O treino histórico mantém legislação atual e programa composto previamente admitido; o registro não muda programa, vínculos legais, questões, flags, preços ou liberação.

## Evidências e identidade

O edital original aprovado é [26/02/2026, PDF40p](https://conhecimento.fgv.br/sites/default/files/concursos/pge-ac-edital-26.02.v.final_.pdf), SHA256 `954c921cf9e5601accbf688e7f29697bfdae4257f1f264862aed3efaa9bbfac4`. Página14, §9.1, identifica cargo Classe I e data provável24/05/2026; §10.1 declara100 questões de múltipla escolha, cinco alternativas e uma resposta correta. A aplicação24/05 foi corroborada pelo cabeçalho do gabarito definitivo, observado pelo operador do projeto em12/10. Este operador não extrai novamente o cabeçalho, respostas ou texto de questões; registra essa procedência em metadata e confere a acessibilidade dos links.

A inspeção somente de HTML/robots do [portal FGV PGE-AC](https://conhecimento.fgv.br/concursos/pgeac) confirmou os anchors:

- [Caderno Tipo1, publicado27/05/2026](https://conhecimento.fgv.br/sites/default/files/concursos/procurador-do-estado-do-acre-cns001-tipo-1.pdf).
- [Gabarito Oficial Definitivo da Prova Objetiva, publicado29/06/2026](https://conhecimento.fgv.br/sites/default/files/concursos/gabarito-definitivo-pge-ac.pdf).

Publicação de PDF não equivale à data de aplicação. O anchor atual do edital no portal é a [versão retificada23/03/2026](https://conhecimento.fgv.br/sites/default/files/concursos/pge-ac-edital-23.03.pdf); sua presença apenas confirma o portal/edição. A fonte do operador continua o snapshot original aprovado e a admissão composta com retificações já existente, sem converter a nova URL em fonte/programa automaticamente.

O módulo admite apenas os dois URLs de prova exatos, labels, datas de publicação, órgão/cargo/etapa e MIME PDF. Respeita robots, timeouts, limites de HTML e o verificador transitório de assinatura limitada. Nenhum PDF de questões/gabarito é armazenado, extraído, hospedado ou usado para autoria. URLs redirecionadas, indisponíveis, ambíguas ou preliminares bloqueiam o registro.

## Prévia e aplicação separadas

CLI `scripts/register-pgeac-previous-exam-links.ts`, executada com `tsx --env-file-if-exists=.env` pelo serviço de manutenção. Sem identidade explícita, a prévia é pública/sem conexão com o banco. Com identidade/hash, a prévia do registro usa `BEGIN ... READ ONLY`, sem locks de escrita ou DML. O papel/projeto da manutenção são `leiprova_owner`/`leiprova`, e a referência operacional é `owner-standing-2026-10-12:official-sources-programs`, documentada em [autorização do proprietário](AUTORIZACAO-FONTES-PROGRAMAS-2026-10-12.md).

A prévia do banco exige administrador único, produto draft/historical_training e stamp de revisão atual, oportunidade/cargo/UF/ciclo/edital/data exatos, audit da admissão composta, carreira `procurador`, banca FGV ativa, examinador revisado único ligado à fonte, snapshot aprovado40p e hash dos próprios bytes. Edição-base já preenchida, edição duplicada ou realizada mais recente na mesma identidade bloqueiam a aplicação. O fingerprint inclui identidade/stamp, snapshot/fonte/examinador, operador, portal/robots e os metadados dos links; timestamps de verificação não fabricam mudanças de conteúdo.

Exemplo conceitual na VPS, usando somente ambiente de manutenção já configurado e pasta privada gravável pelo executor:

```sh
pnpm exec tsx --env-file-if-exists=.env scripts/register-pgeac-previous-exam-links.ts \
  --opportunity=f16c8847-9d0d-4c47-84f8-752f3a72562d \
  --expected-notice-sha256=954c921cf9e5601accbf688e7f29697bfdae4257f1f264862aed3efaa9bbfac4 \
  --output=pgeac-db-preview-nova
```

Somente depois da conferência dessa prévia, repetir com `--apply --expected-fingerprint=<hash da prévia>` e nome de saída novo. A fonte/estado/metadados são verificados novamente; divergência reverte tudo. `--output` admite apenas basename minúsculo, números/hífens; diretórios existentes/symlinks/sobrescrita são recusados. Artefatos ficam em `.local/editorial/pgeac-previous-exam-previews/`, diretórios700 e arquivos600; jamais Git/Docker/Autor.

Aplicação serializável cria `pgeac-procurador-classe-i-viii-2026-objetiva` como `held/metadata_only`, dois documentos `pending_review/external_link`, e atribui a edição somente se `opportunity.exam_edition_id IS NULL`. Atualiza o stamp do produto para o mesmo `updated_at` efetivo da oportunidade; exige exatamente uma linha de retorno de cada UPDATE e reverte inserts/atribuição/audit se qualquer guard falhar. Preserva IDs existentes. Audit `editorial.previous_exam.pgeac_metadata_registered`, `owner_standing_authorization`, `humanReview:false`, zero referências aprovadas, questões importadas ou produtos liberados.

## Aprovação posterior somente dos links

`approve-previous-exam-links.ts --standing` continua permitindo o par MPMT existente e passa a admitir exclusivamente este par PGE-AC, uma edição por execução:

```sh
pnpm exec tsx --env-file-if-exists=.env scripts/approve-previous-exam-links.ts \
  --standing pge-ac-procurador-do-estado-reta-final=pgeac-procurador-classe-i-viii-2026-objetiva
```

Essa prévia é uma transação desfeita; `--apply` permanece separado. Exige os dois documentos pendentes e suas URLs oficiais exatas, identidade/data/portal, audit do registro correspondente à oportunidade histórica e os guards completos de referência/última edição. Não aprova conteúdo das provas, licenciamento de reprodução, Qcert, questões inéditas ou produto. MPRJ com apenas gabarito preliminar não foi incluído. O módulo/operador MPMT não foi alterado.

A admissão do contrato MC5 por cargo/edição/etapa e a autoria inédita permanecem passos próprios. O registro desta documentação não é recibo de aplicação em produção; IDs/audits reais deverão ser registrados após executar o operador. Não haverá corte, cron ou API paga implícitos.

## QA efetiva do operador, antes de aplicar

Cópia isolada base16ff5c5 mais os arquivos PGE-AC delimitados, sem migração0054: lint, Next typegen e tipos globais passaram;1.771 testes gerais passaram,280 opcionais foram pulados. Os11 testes PostgreSQL reais passaram em base sintética própria, incluindo aplicação positiva com rollback, perda do vínculo/edição, snapshot rejeitado, mais de um administrador, edição mais recente, fingerprint alterado e guards que impedem retorno dos UPDATEs. Build QA aprovado: `sha256:232db620cf5835b8a3cab7b65e1a7d096842fa2ffa829630efea5546e12d9d2d`. Logs privados em `/opt/leiprova-qa-pgeac-previous-20261012/`.

As rodadas anteriores detectaram coluna inexistente no registro de fonte, fixtures sem datas/comissão e comparação que perdia microssegundos ao serializar parâmetro timestamptz. A fonte passou a ter fingerprint SHA da fotografia completa; comparações de stamps existentes usam representação TEXT exata, preservando precisão e recusando mudanças. Fixtures e variável/rede do teste foram corrigidas, e a base sintética foi recriada antes da rodada positiva; nenhuma falha ou caso pulado é evidência de aplicação. Mantidos logs anteriores. Produção ainda não executou este operador.

## Aplicação efetiva dos metadados e links

Ferramentas d84ccf3 na VPS Everglades; app/worker permaneciam5f895e1. Backup anterior validado `before-pgeac-baseline-20261012.dump`. Registro efetivamente aplicado: edição40, oportunidade21, auditoria8146, fingerprint `256181a2ba392c9c17be9fb9ad094764ec0b5d97c86889b393ac44e15cec56c7`. Uma aplicação com preview anterior foi recusada por fingerprint e não cadastrou edição; o registro posterior usou uma verificação oficial fresca e preview/apply consecutivos na mesma função auditada, mantendo todos os guards e separação read-only/serializable.

Às12:41:25.883463UTC, a conferência read-only confirmou documentos53/caderno e54/gabarito, ambos approved/external_link/metadata_only, audits8151/8152 com humanReview:false. A referência aprovada é `99673938-48fd-4b27-823a-33fde69e34f3`, proposta8153/aprovada8154, também humanReview:false. Nenhuma questão de prova foi copiada, importada ou aprovada. Recibos privados em `/opt/leiprova/.local/editorial/pgeac-previous-exam-previews/`.

Auditoria geral posterior às12:46:42.120UTC preservou três preparações/285 questões válidas. PGE-AC continua draft/zero questões; o registro dos PDFs oficiais e da edição não é recibo de curso pronto. O contrato MC5 e a autoria própria seguem etapas separadas.
