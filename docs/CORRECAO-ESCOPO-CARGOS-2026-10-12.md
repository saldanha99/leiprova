# Correção delimitada de cargo e programa — 12/10/2026

O operador `scripts/reconcile-official-role-scope.ts` trata dois incidentes
conhecidos. Não é editor genérico de identidade nem aprovação de programa,
contrato de questão ou produto. Usa a autorização permanente de fontes e
programas, `owner-standing-2026-10-12:official-sources-programs`, registrando
`owner_standing_authorization`, `humanReview:false` e `publicationAllowed:false`.

- `pp-ma-inspetor-2026`: oportunidade12/edição30/documento15/snapshot456.
  O edital confirma Inspetor na p.2, programa comum na p.68, programa do cargo1
  a partir da p.69 e cargo2/Monitor na p.71. O operador prova a literalidade
  dos 84 requisitos, respeitando a divisão dentro da p.71 e textos multipágina;
  suspende somente IDs1381–1404 do Monitor e preserva IDs1321–1380 do Inspetor.
- `pc-ma-investigador-2026`: oportunidade11/edição29/documento14/snapshot458.
  Corrige exclusivamente `contest_opportunities.role_name` de Investigador de
  Polícia para Oficial Investigador de Polícia, pelo cabeçalho e edital exatos
  na p.1. Preserva os71 requisitos. `exam_editions` não possui `role_name`.

Bytes SHA-256, URLs primárias, banca4/atribuição, cargo, edição, ano2026,
especialidade, número do edital, estados e versões são revalidados. Uma fonte
posterior aprovada, programa já revisado, contrato, questão, vínculo ou reserva
running impede a alteração. Reserva expirada ainda running exige o fluxo normal
de recolhimento/expiração; este operador não cancela reservas.

A prévia usa transação somente leitura/repeatable read. A aplicação exige
administrador explícito, banco leiprova com leiprova_owner, fingerprint da
prévia e transação serializable. Travamentos preservam a exclusividade da fila
(advisory621743/37), fonte e requisitos. Trabalhos pending do Monitor são
superados no PP-MA; no PC-MA, apenas pending do contexto da oportunidade corrigida.
Auditoria `editorial.official_role_scope.corrected` guarda evidência, estado
anterior e alteração. No PC-MA, a trava existente de identidade revisada exige retornar a oportunidade
para pending_review antes da correção. O operador revalida somente o nome oficial
e retorna a reviewed dentro da mesma transação, com auditoria explícita das três
etapas e revisão automatizada, sem estado intermediário público nem desativação
de triggers. A gravação direta inicialmente foi recusada/rollback pela trava.
O teste PostgreSQL reproduz a função real de imutabilidade e a guarda de
publicação da migração, e comprova a recusa direta e a transição correta.
Contratos de formato permanecem uma admissão separada.

Execução pelo acesso de manutenção existente, sem imprimir credenciais:

```sh
node node_modules/tsx/dist/cli.mjs --env-file-if-exists=.env \
  scripts/reconcile-official-role-scope.ts \
  --recipe=pp-ma-inspetor-2026 --actor=UUID_DO_ADMINISTRADOR
# Depois de conferir a prévia: mesmos argumentos, --apply --fingerprint=SHA256.
```

Validação:20 testes do recorte e13 cenários reais em PostgreSQL17 isolado,
com fixtures sintéticas e evidência dos dois PDFs oficiais públicos. Nenhum
usuário, questão ou dump de produção foi importado no teste. Exercitados
literalidade multipágina, mistura de cargos na mesma página, preview sem escrita,
fingerprint alterado, dependências, reserva ativa, ator não administrador,
bytes divergentes, programa revisado e preservação de outra oportunidade.
A suíte geral passou com1.848 testes e290 opcionais pulados; lint, tipos e build
passaram. Rodada final após a correção de alias SQL: os mesmos1.848 testes gerais,
20 testes do recorte, lint, tipos e build passaram;13 cenários PostgreSQL
passaram com a versão corrigida.

## Limite dos executores nesta retomada

Mac desbloqueado e Maestro identificado pelo shell do próprio nó. As cinco
notas existentes receberam contexto atual sem mudar nomes, conexões ou acesso.
Codex dos terminais recusou autenticação; o Antigravity Gemini3.8Flash high
iniciou os mesmos nós Autor/Guardião e a tarefa delimitada do Vetor, mas atingiu
cota antes de entregar. Não há recibo novo de autoria dessa tentativa. O Codex
desktop assumiu a implementação após a falha, sem edições concorrentes.

Radar/Claude indicou renovação00h30 BRT de13/10. Preflight privado mantém
recolhimento antes de esperar essa cota, impedindo novas reservas desperdiçadas.
Antigravity não foi incluído na detecção de executores do preflight enquanto o
piloto não entregar resposta válida. Não declarar autoria contínua nem recorrer
a API paga. Conta Pro preparada ainda depende de conexão pelo proprietário.

## Primeiro recibo em produção

`8d4722c` implantado sem seed; saúde pública ok. PP-MA aplicado pelo
fingerprint da prévia, audit14164:24 requisitos Monitor suspensos,60 Inspetor
preservados,24 tarefas pending do Monitor superseded. O PC-MA foi recusado
pela trava de identidade reviewed; nenhuma alteração foi gravada nessa tentativa.
A correção da transição foi validada em13 cenários reais antes de nova publicação.
