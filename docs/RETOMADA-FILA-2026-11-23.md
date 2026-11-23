# Retomada da fila do Lei Prova — 23/11/2026

Prioridade do Vinícius (via Chefe de Gabinete): Código Penal, Guardião (descoberta de editais), leis que faltam e
5 concursos quase prontos. O redesenho do Edital Lei Seca saiu desta fila (branch `feat/redesenho-els`, outro agente).

## 1. Código Penal v112 de volta (feito)

Causa: às 20h47 UTC de 12/10, uma única captura da Câmara falhou (rawSha nulo). O verificador fecha por segurança:
suspendeu o recibo 1, rejeitou os snapshots 2757/1660 e pôs a v112 em `pending_review`. Nada a reabria; o banco
proíbe restaurar um recibo encerrado (trigger `preserve_cp_correction_evidence`).

- `8960f8c`/`3c3c2bd`: `scripts/apply-cp-reconciliation.ts fingerprint=<prévia> [--rehearse]` sobre
  `validateCpReconciliationContext` (mesma conferência integral da prévia, agora também em modo escrita). Cria um
  recibo NOVO, reaprova os snapshots 2757/1660 só se o conteúdo bate byte a byte com a recaptura (o índice
  `(legal_act_id, checksum)` impede snapshot novo do mesmo texto), promove a v112 a `current` e audita. Recibo 1,
  versão 63 e os 27 artigos suspensos ficam como estavam. Questões, vínculos e requisito 667 não são escritos.
- A prévia passou a aceitar o hash novo das questões 1285/1287, reescritas pela limpeza de jargão de 21/11
  (auditorias 133274/133275), desde que o certificado acompanhe; gabarito e alternativas seguem conferidos.
- Verificador horário: 3 tentativas de captura, 30 s entre elas, antes de suspender (continua fechando por
  segurança se as 3 falharem).
- Aplicado em produção às ~13h07 UTC, depois de ensaio com rollback no banco real e do backup
  `/opt/leiprova/backups/before-cp-reconciliation-20261123.dump`: fingerprint `cf034588…3e06`, recibo 3,
  auditoria 141057, ENAC 111 → 116 questões válidas, as outras 26 ofertas sem variação.
- Recibo fixado do cron trocado (`.local/editorial/cp-current-receipt.json`; o anterior ficou em
  `cp-current-receipt.before-reconciliation-20261123.json`). Verificações: manual (auditoria 141058) e agendada
  das 13h47 (auditoria 142413), ambas `verified`.
- A preparação recalcula os mapeamentos sozinha, porque o fingerprint do corpus mudou (100 requisitos a cada
  5 min); os bloqueados por falta do CP voltam como pendentes aos poucos.

## 2. Guardião / descoberta de editais (feito)

Causa: desde ~25/10 nada reservava `discovery`. Quem consumia era a ponte Maestri (com navegador), que parou; o
motor da VPS só reserva mapeamento e autoria e roda a IA sem rede, por desenho. Cada radar diário ficava com
0 tentativas até o do dia seguinte substituí-lo.

- `58633d1`/`f6ddd7c`/`a4eb65f`: o servidor captura o índice público de cada portal uma vez por dia
  (`captureOfficialDiscoveryPage`: robots do host respeitado, redirecionamentos e links validados por
  `validateDiscoveryUrl`) e põe texto e links em `context.pages`. A Cebraspe é uma casca React; a lista vem da API
  pública `apis.cebraspe.org.br/cebraspe/eventos/tipo/concursos/` (sem robots: 404). A FCC lista os concursos em
  `/concursos/`, caminho que o robots proíbe: esses links entram só como texto, nunca acessados nem citáveis.
- Novo papel Radar no worker (`EDITORIAL_SLOTS_RADAR`, padrão 1), só `discovery`, sem rede. O contrato recusa
  descoberta com URL que não estava na captura.
- Corrigida a corrida do arquivo temporário do heartbeat entre vagas do mesmo processo (apareceu com a 9ª vaga).
- Descoberta completa de 23/11: FGV 8, Cebraspe 20, FCC 3 propostas (`prepared`, para revisão em /admin/motores).
  A Vunesp continua `portal_access_denied` por política (Akamai/CAPTCHA, não contornar).
- `legal_change` (26 pendentes) continua sem consumidor: pede consultar a fonte normativa; é o próximo passo pelo
  mesmo caminho (captura no servidor e análise offline).

## 3. Leis que faltam e 5 concursos (parcial)

- `58b979c`: 18 leis no registro (norma e data pela API de dados abertos do Senado; página do Planalto conferida).
  13 carregadas com `LEGAL_LOAD_REFERENCE=owner-priority-2026-11-23:missing-laws`, depois do backup
  `before-missing-laws-20261123.dump`: CTB (388 artigos), Lei 6.766 (67), Anticorrupção (31), Lei 9.807 (22),
  Propriedade Industrial (247), Biossegurança (42), Lei 4.591 (79), DL 201 (9), Mediação (48), Estatuto da
  Cidade (61), Inquilinato (91), Lei 9.296 (14) e Código Florestal (91): 1.190 artigos, 60 atos vigentes.
- Sem compilação em texto no Senado (o carregador recusa): Lei Geral do Esporte (14.597), Henry Borel (14.344),
  Software (9.609), Escuta Protegida (13.431) e LONMP (8.625). Caminho: `--capture-only` pelo Planalto/Câmara e
  revisão no painel.
- Os 5 concursos (estado em 23/11):
  - pc-df (opp. 37): 193 requisitos sem disciplina. O operador `classify-standing-programme-subjects` só cobre
    5 cargos; falta estendê-lo ao pc-df.
  - tj-pe (opp. 24): 331 requisitos, 86 sem disciplina; contrato viável.
  - pgm-manaus (opp. 6): nenhum requisito extraído.
  - tce-ma (opp. 14) e pc-pr agente (opp. 5): o contrato é de um cargo só e o edital cobre vários. Falta a
    escolha do cargo (decisão do Vinícius).
