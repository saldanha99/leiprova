# Continuação da produção — 12/10/2026

Pedido do proprietário: continuar sem parar, aproveitando as assinaturas
conectadas e liberando automaticamente o conteúdo elegível. Não remover gates,
transformar proposta em aprovação ou usar API paga. A meta de 1.000 novas
questões válidas publicadas por dia continua sem vazão comprovada.

## Executores e recibos

Guardião e Autor estavam em Codex com limite atingido. A troca pelo preset
Claude Code foi feita no shell real do Maestro, com `maestri recruit --replace`:
IDs, papéis, conexões, posição e rotinas foram preservados. Não foram criados
agentes duplicados nem acrescentadas opções para ignorar permissões.
Guardião recuperou a reserva `legal-change:2760` e bloqueou corretamente a
análise sem corpus, depois passou a mapas do TRF-5. Autor voltou a produzir
inéditas MC5 pelo contrato exato dessa magistratura federal.

Inventário real das rotinas em `.local/maestri/routines-continuation-20261012.txt`:

| ID | Agente | Frequência | Estado |
| --- | --- | --- | --- |
| cc6e9e | Guardião | 1 minuto | enabled, sem data final |
| 56cefb | Autor | 1 minuto | enabled, sem data final |
| 6237b5 | Radar | 5 minutos | enabled, sem data final |

Todas pulam terminal ocupado. Preflight recolhe/valida a resposta antes do
próximo despacho; prepared ainda é proposta. Falha transitória de settlement
às 22h25 UTC foi seguida por sucesso às 22h26; não repetir entrega já recebida.
Há reservas sem pacote local (`author:863`, `mapping:866`) observadas às 22h25;
não foram canceladas nem duplicadas. A expiração auditada permite tentativa
posterior. Reconferir status e recibos antes de recuperar qualquer uma.

Maestro Codex iniciou, mas apresentou erro de refresh de autenticação, associado
à troca/saída de conta. Não houve cópia de credenciais. O mesmo terminal foi
iniciado com Claude Sonnet e fez a conferência delimitada: 21 inéditas aprovadas
pela linha, todas corretas contra o corpus recebido; nenhuma suspensão.
Recibo `.local/maestri/maestro-continuation-20261012.md`; marca d'água
22h22m29 UTC. Conferir as aprovações posteriores na próxima rodada.
Claude chegou ao limite de sessão, com retomada automática indicada para
19h30 BRT. Após a renovação, Guardião voltou a entregar/reservar às 22h32 UTC;
Autor entregou outras cinco inéditas em `author:867`, recolhidas sem falha
pela ponte. A retomada foi conferida na tela e no recibo efetivo.
Assinaturas, host e Maestri continuam condicionando a operação;
cron e documentação não comprovam produção ininterrupta.

## TJ-RS: contrato admitido

A cláusula oficial p.18, item 12.2, usa “das quais apenas 1 (uma) será correta”.
O matcher reconhecia somente outras redações de resposta única. A correção
adiciona essa formulação e preserva os bloqueios para duas respostas,
negação, ausência de correção e mistura com C/E. Não inferir formato por banca.

PDF primário local, checksum SHA-256 conferido:
`5aead3396e649525acbcc1931f583bd2208037efd349a85f9df5e45eabacf8f1`.
Snapshot 355, documento 11, oportunidade 8, edição 26, banca FGV, cargo
Juiz de Direito Substituto, edital 0031/2026-DMAG consolidado no retificativo
0032/2026. Trechos de identidade e formato existem nas páginas indicadas.
O operador revalidou bytes, fonte, atribuição da banca, cargo e edição no banco.

Prévia fingerprint
`2c64354667f64da6c6a021cf452ed116ad8e7061dea03490bbbddf08e2c72e2d`;
aplicação às 22h26m38 UTC, auditoria **13241**,
`editorial.question_contract.approved`, `owner_standing_authorization`,
`humanReview:false`. Contrato
`27cb6ef3ff05456499e7d7ee5c10d64cba2a3095ddbb37aa69b5914920ee8c4d`.
Zero questões/vínculos certificados na admissão; não abriu o produto.
Recibos privados na VPS: `tjrs-contract-preview.json`, `tjrs-contract-apply.json`
em `/opt/leiprova-qa-owner-control-20261012/`.

Lint e tipos passaram. Suíte geral: 1.825 testes passaram, três testes de
wrappers deram timeout sob carga e 290 opcionais foram pulados. Os dois arquivos
afetados foram executados novamente com um worker e timeout de 20s: 9/9
passaram. Nenhum teste ou limite de produção foi alterado. Build passou.
Implantado **d9c3287** pelo fluxo normal com `LEIPROVA_SKIP_SEED=1`; app e
três workers saudáveis, health público respondeu 200/status ok.

Backup antes da implantação:
`/opt/leiprova-qa-owner-control-20261012/before-tjrs-contract.dump`, também
copiado para `.local/editorial/continuation-20261012/` com permissão 600.
SHA-256 conferido nos dois destinos:
`e221f2c53944f0eb5afab2cebe6b7f5fa02e927a3b17b0a03bb6a59c656929fa`.
O catálogo do dump foi validado com `pg_restore --list` no PostgreSQL 17;
uma cópia temporária no container foi removida após essa verificação.
App/worker anteriores preservados com tag `before-tjrs-contract-20261012`.
Sem migração nova de schema; não restaurar esse dump sobre as entregas novas
apenas para retornar código. Contrato é admissão auditada, não abertura comercial.

## Resultado e próximo insumo

Relatório às 22h36m08 UTC: **3/84 abertas**, ENAM 146, ENAC 78 e TC-DF 72
vínculos válidos (296 nas ofertas abertas). **TRF-5: 20 válidas**, ainda draft,
faltando 48 para o piso de abertura. A métrica diária permanece 16 questões
novas em produtos abertos; as 20 do TRF-5 não entram nela enquanto draft.
As linhas de liberação extraordinárias concluíram a avaliação sem falha.
Não atestar compra real ou integralidade do programa por essas quantidades.

Vetor/Antigravity Gemini 3.8 Flash entregou análise de programa do PP-MA,
snapshot 456, distinguindo Inspetor (cargo 1) de Monitor (cargo 2), com
conhecimentos gerais e específicos por página. Arquivos em
`.local/editorial/continuation-20261012/pp-ma-scope-vetor.json` e `.md`.
Proposta, `publicationAllowed:false`, `humanReview:false`; não admitida.
Na reconferência independente, o checksum do PDF coincidiu com a ficha,
o trecho de identidade do Inspetor existe na p.2 e os cabeçalhos comuns,
específicos do Inspetor e do Monitor estão respectivamente nas pp.68, 69 e 71.
Próxima ação: reconferir os trechos contra as páginas oficiais, verificar os
requisitos existentes e excluir qualquer mistura de cargo antes de admitir
contrato/fonte/programa pelo operador próprio. Não liberar perfil C/E herdado.

Continuar os mapas/autoria de edições com contrato atual e disciplinas
confirmadas, preparar insumos do TJ-RS e acompanhar as entregas após o reset.
Não tocar nas reservas em andamento. WhatsApp aguarda integração identificada;
anúncios aguardam contas/orçamento. Não assumir envio ou veiculação.
