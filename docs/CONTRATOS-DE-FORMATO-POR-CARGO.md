# Contratos de formato por cargo, edição e etapa

Preparação técnica de12/10/2026. **Aplicação parcial real:** migrações0052/0053,
contratos ENAM/ENAC e suas certificações aplicados; o app anterior ainda estava
ativo, aguardando a certificação TC-DF e a correção delimitada descrita abaixo.

O formato vem da cláusula da fonte oficial do cargo/edição/etapa. O perfil global
da banca permanece histórico e interno: Cebraspe pode usar cinco alternativas na
PC-MA e certo/errado no TC-DF. O novo perfil MC5 da PC-MA não altera o perfil C/E
global. Instruções internas não são apresentadas como estilo oficial da banca.

A migração `0052_scoped_question_contracts` é aditiva, sem backfill. Cria contratos
imutáveis com fonte, checksum, página, trecho, identidade, organizador da etapa e
perfil interno; uma FK opcional identifica o contrato das novas inéditas. Uma
certificação adicional por vínculo guarda o hash exato de enunciado, opções,
gabarito, explicação e objetivo. A certificação preserva `questions.updated_at`,
as fotografias dos vínculos e as revisões anteriores. Suspensão do contrato,
fonte, identidade ou divergência de conteúdo fecha a elegibilidade.

As cláusulas verificadas no acervo aprovado foram:

| Preparação | Snapshot | Localizador | Formato |
|---|---:|---|---|
| ENAM 2026.2 | 1 | PDF p. 14, item 8.5 | MC5, resposta única |
| ENAC 2026.2 | 5 | PDF p. 13, item 8.5 | MC5, resposta única |
| PC-MA Delegado | 464 | PDF p. 24, item 8.4 | MC5, resposta única |
| TC-DF Analista | 445 | PDF p. 26, item 9.2 | Certo/errado |

Os SHA dos bytes armazenados foram comparados aos checksums das capturas. URL do
portal aprovado e URL do PDF são mantidas separadamente. O operador também
reconfere página/trechos, identidade e atribuição do examinador. Links, cargo,
edição ou formato incertos impedem aplicação. FGV não recebe certificação somente
por ser FGV. Campos atuais de metadados são relidos no preview/aplicação; os
dossiês privados em `.local/editorial/question-contracts-20261012/` não substituem
a leitura atual do banco nem devem entrar no Git/imagem.

O código oficial C/E difere da codificação A/B usada pelo treino e pela fábrica.
O contrato explicita ambos; a importação local normaliza seus códigos C/E para
A/B quando há contrato. Rótulos de certo/errado continuam obrigatórios. Questões
legadas com tipos mecânicos como `literal_exact` não ganham formato por inferência.

## Aplicação controlada

Após QA, publicar a revisão Git e compilar primeiro a imagem do operador. Aplicar
a migração e grants; manter o app antigo ativo enquanto forem certificados os
três cursos corretos. Usar o acesso de manutenção **leiprova_owner / leiprova**
no destino autorizado. Nenhum segredo deve ser passado em argumento ou prompt.

```bash
pnpm exec tsx --env-file-if-exists=.env scripts/review-official-question-contract.ts \
  --input=/caminho/privado/dossie.json --actor=UUID_DO_ADMIN
```

O arquivo contém `{ "contract": { ... }, "productSlug": "..." }`. A cláusula
de formato, a identidade e o perfil devem ser específicos. O preview é read only
e devolve fingerprint da operação, contrato, tipos/chaves legados, IDs de vínculo,
hashes exatos e quantidade distinta elegível. Não publica preparação ou questão.

```bash
pnpm exec tsx --env-file-if-exists=.env scripts/review-official-question-contract.ts \
  --input=/caminho/privado/dossie.json --actor=UUID_DO_ADMIN \
  --apply --fingerprint=SHA256_DA_PREVIA
```

Autorização: `docs/AUTORIZACAO-FONTES-PROGRAMAS-2026-10-12.md`, referência operacional
`owner-standing-2026-10-12:official-sources-programs`, auditoria
`owner_standing_authorization`, `humanReview:false`. A aplicação é transacional,
reconfere as fontes e os hashes, reserva contexto e não reabre contratos ou
certificações suspensas. Novo contrato conflitante exige decisão separada.

Comparar os vínculos exatos dos cursos existentes antes de recriar app/workers.
A leitura preliminar apontou ENAM146, ENAC70 e TC-DF69 (285 questões); o preview
com todos os predicados e a conferência posterior determinam o total real. A guarda
comercial nova é obrigatória para `original_style` e `dry_law`; instalar o app novo
antes de certificar os cursos fecharia sua contagem. Não adicionar fallback por banca.

## Fábrica e demais entradas

Autoria exige contrato atual e perfil do cargo, edição e etapa. A fila não reserva
autoria sem contrato; Guardião pode continuar mapeando fontes legais. Follow-ups
filtram o fingerprint do contrato antes do limite. Hashes do programa/corpus e do
contrato são separados: mudar formato não exige repetir um mapeamento legal já
válido. Na conclusão, contrato, fonte, programa e corpus são relidos sob locks.

Leases existentes não são substituídos. Resposta `blocked` sem questões pode
concluir com a limitação verdadeira e fontes válidas mesmo sem contrato legado;
resposta com questões sem contrato é recusada antes da importação. `prepared`
continua sendo proposta. Aprovação da fábrica, aprovação individual/em lote e
geração por regra passam pelas guardas compartilhadas. Importação local para um
escopo comercial usa mapping `schemaVersion:3` com `contracts` explícitos por banca;
pacotes antigos permanecem rascunhos genéricos e não recebem escopo por presunção.

Seleção, resposta/revisão do treino e cobertura por banca também revalidam o
contrato das inéditas. Questão legada sem FK só entra nesse treino por certificação
exata e vínculo válido; não há grandfather pela banca. O recorte de edição exige
contrato da mesma edição. Treino literal genérico sem promessa de formato de
concurso continua independente. O formulário editorial descreve o perfil global
como genérico, sem afirmar que todo concurso Cebraspe use certo/errado.

As 82 questões C/E da PC-MA permanecem suspensas. Reautoria deve criar enunciados
e cinco alternativas novos a partir de fontes legais oficiais independentes;
não acrescentar alternativas aos itens antigos ou usar questões de terceiros.

TCE-MA está fora deste operador: os 16 cargos precisam de trilhas, programas,
etapas, filas e acessos próprios. Não selecionar Direito implicitamente. Os itens
constitucionais gerais e específicos não podem ser transferidos entre cargos.
Históricos cuja edição ainda é nula precisam primeiro de vínculo com a edição
oficial confirmada; não inventar ID ou certificar uma preparação genérica.

Rollback preserva contratos/auditoria e bloqueia os escopos afetados. Não restaura
inferência por banca nem reabre PC-MA. A suspensão posterior pelo Maestro continua
obrigatória quando encontrar erro.

## QA efetivamente executado antes da aplicação

Na VPS, a suíte geral aprovou 1.733 testes, com267 testes opcionais sem execução;
lint e typecheck integrais passaram. O build Docker de produção Next16/Turbopack
passou após a correção de correlação. Em cluster PostgreSQL17 sintético isolado,
os **21 testes da fábrica/contratos e12 de fontes complementares passaram, sem
skips ou OOM**. Os seis testes do monitor Bash/Python também passaram na VPS.
Isso comprova o QA do código, não aplicação no banco de produção.

O teste de suspensão encontrou shadowing de alias SQL: a guarda interna usava
o mesmo alias qc do chamador e podia aceitar outro contrato ativo. Todos os
aliases internos agora são exclusivos; a regressão mantém explicitamente um
segundo contrato ativo enquanto suspende o alvo. O operador real também foi
testado por preview read only, fingerprint divergente, página/bytes/examinador
incorretos, aplicação e reaplicação, sem alterar a fotografia de questão legada.
O teste concorrente verifica bloqueio efetivo no PostgreSQL e conclusão sem
ciclo de locks, preservando o rascunho. Fixtures cumprem os triggers existentes;
nenhum trigger foi desligado para obter aprovação dos testes.

Recibos privados de QA estão em `.local/qa-agent-20261012/`. Tentativas anteriores
com falhas foram preservadas e não representam validações aprovadas.

## Conferência da aplicação parcial

Código234daeb aplicado primeiro às ferramentas, às migrações e aos grants no
destino Everglades, preservando o app8017e64. Backup prévio validado em
`/opt/leiprova/backups/before-question-contracts-0052-0053-20261012.dump`.
ENAM e ENAC receberam seus contratos e certificações adicionais. A conferência
encontrou ENAM225 certificados de formato, correspondentes a146 questões;
192 vínculos estão approved e33 continuam pending_review. Certificação de formato
não aprova o vínculo pendente nem libera seu acesso. ENAC tem70 certificados e70
questões. A fotografia de estado/timestamps das655 questões permaneceu idêntica:
SHA256 `3a73a6350df1aa32eccd77f1626959d79ef1e98477d3de132f4b7ee3a2af3460`.

A aplicação PC-MA foi recusada e desfeita por divergência de fingerprint: depois
de existir outro produto certificado, a prévia passou incorretamente de0 para82.
O helper comercial também repetia o alias binding do chamador. A correção usa
aliases exclusivos em todas as tabelas e passa a questão explicitamente à guarda
da certificação. Um teste PostgreSQL com dois produtos mantém B em0 antes/depois
de certificar A, confirma ausência de contrato/certificados B e nega vínculo
alheio. A normalização de alternativas usa `[[:space:]]+`, evitando perder a barra
de escape no template JavaScript. A regressão real rejeita duplicatas com newline.

QA posterior:1.747 testes gerais aprovados,269 opcionais não executados; lint,
typecheck e build de produção passaram. Os **23 testes PostgreSQL reais passaram**,
sem skips ou OOM. A permissão de fonte recebeu somente o caminho exato do edital
MPMT compilado já admitido, com teste negativo para caderno/outros PDFs. Esses
recibos não comprovam aplicação da correção, certificação TC-DF/PC-MA ou troca
do app; registrar essas execuções separadamente.
