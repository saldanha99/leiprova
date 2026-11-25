# Fila dos 55 produtos em rascunho (24/11/2026)

Pedido do Vinícius (24/11, via Chefe de Gabinete): levantar o que falta a cada preparação em
rascunho, priorizar as que vendem mais rápido e começar pelas que dependem só do motor.
**Nada vai à venda sem avisar o Chefe antes.** Atenção: a linha automática
(`deploy/editorial-release-chain.sh`, a cada 10 min) libera sozinha o rascunho que passar em todos
os gates (abertura progressiva de 12/10). Por isso a correção do item 1 ficou numa branch.

O catálogo tem 55 rascunhos (o "57" do pedido não bate com o banco). Só 3 têm edital (oportunidade).

| Prioridade | Produto(s) | Falta | Tipo | Situação |
|---|---|---|---|---|
| 1 | `pc-pr-agente-2026` | só a prova anterior | técnico (bug) | Corrigido na branch `fix/prova-anterior-mesma-data` (84cbed1). Agente (edição 58) e Papiloscopista (59) têm a mesma carreira e data; o desempate pelo id fazia a 59 "mais nova" e escondia a prova do Agente. Ao entrar no deploy, o produto **vai à venda sozinho**: merge só com OK. |
| 2 | `pgm-manaus-procurador-do-municipio-2026` | 68 questões; prova anterior | motor | Edital admitido em 23/11; 12 de 179 itens revisados; mapeamento e autoria na fila. |
| 3 | `mpe-ms-promotor-de-justica-2026`, `tj-ce-analista-e-tecnico-2026`, `tj-ce-cartorios-reta-final`, `tj-rs-cartorios-reta-final`, `trt-ms-analista-e-tecnico-2024-2025` | admitir o edital (oportunidade, programa, banca) | técnico/editorial | Identidade confirmada pelo Radar em set/2026 (`course-intake` `prepared`), admissão nunca feita. Próximo trabalho: admitir pelo caminho auditado, como PGM-Manaus e PC-PR em 23/11. |
| 4 | `camara-camara-dos-deputados-2026`, `pgm-rj-procurador-do-municipio-reta-final` | escolher o cargo/concurso | decisão do Vinícius | Cada oferta cobre dois concursos distintos (Câmara: dois certames Cebraspe; PGM-RJ: Procurador do Município x Procurador da Câmara). |
| 5 | `tst-magistratura-do-trabalho-pre-edital`, `tce-sp-auditor-dipe-direito-2026` | edital | fonte | TST: sem edital novo; cabe pré-edital com o edital anterior (regra de 19/11) se houver edital anterior oficial. TCE-SP: só notícia institucional. |
| 6 | `tce-ma-analista-e-tecnico-2026` | prova já aplicada (22/11) | decisão | Fora do catálogo público. Opção: treino histórico (como PC-MA) depois do caderno e do gabarito do Cebraspe. |
| 7 | demais 43 (TJs, MPs, DPEs, SEFAZ, PCs, ALs, TRTs…) | identidade e fonte oficial do edital | motor (Radar) | Voltaram à fila do Radar em 24/11 (`manual.agent_work.requeued`): 40 sem fonte oficial acessível, 1 sem identidade (PC-BA Delegado), 2 com reserva expirada. O Radar ganhou fontes novas em 23/11 (API do Cebraspe, links da FCC). Backup: `/opt/leiprova/.local/backups/vinculos-20261124/intake-backup-20261125.csv`. |

Bloqueios comuns aos 52 sem edital: "sem edital oficial revisado", "categoria do catálogo diferente
da do edital", "0 de 68 questões" e "sem prova anterior". Todos saem juntos quando o edital é
admitido; não há trabalho útil antes disso.

## Decisões do Vinícius (25/11/2026, via Chefe de Gabinete)

- **PC-PR Agente:** aprovado à venda. A rotina do deploy de 24/11 às 23h faz o merge de
  `fix/prova-anterior-mesma-data` na main antes do deploy e confere o produto à venda.
- **TCE-MA:** treino histórico (`historical_training`) com a prova real, posicionado para o próximo concurso.
- **TST e TCE-SP:** pré-edital (`pre_notice`) pelo último edital oficial, marcado como tal e atualizado quando o novo sair.
- **Câmara e PGM-RJ:** dividir cada oferta em 2 produtos, um por cargo, cada um com suas questões.
- Execução no fluxo normal (admissão, mapeamento e motor) a partir de 25/11 às 14h, junto com o item 3.
  Nada vai à venda sem avisar o Chefe antes, exceto o PC-PR Agente.

## Execução de 25/11/2026 (14h–15h BRT, rotina do Dev Next.js)

Caminho auditado de 12/10 (`owner_standing_authorization`, `humanReview:false`). Operadores rodados na VPS pelo
contêiner de ferramentas com o código da `main` montado de uma cópia separada (`/opt/leiprova-ops-20261125`);
o app e as imagens publicadas não mudaram (sem deploy). Carga abaixo de 6 antes de cada gravação.

| Item | Produto | Resultado | Falta para vender |
|---|---|---|---|
| C | `tst-magistratura-do-trabalho-pre-edital` | **Admitido como pré-edital.** Base: II CNU da Magistratura do Trabalho (CSJT, FGV, Edital nº 1/2023, `62549d7a…`). Oportunidade 42 (`8f7ab61c-…`), 255 requisitos (programa `fa4c0a88…`), 121 classificados; prova anterior (caderno Tipo 1 + gabarito definitivo de 22/06/2023) registrada e aprovada; modo `pre_notice` gravado (auditoria 252436); contrato MC5 `c879eb86…`. Backup `backups/before-tst-pre-edital-20261125.dump` (`1ba4dd9b…`). | 68 questões (motor); deploy de `374278b` (a regra da prova anterior só aceitava a da própria edição base no treino histórico). Direito Individual, Coletivo e Constitucional do Trabalho não têm disciplina exata no catálogo (134 requisitos sem classificação). Preço: o do catálogo, já cadastrado no Stripe live. |
| C | `tce-sp-auditor-dipe-direito-2026` | Não admitido. Existe o Edital nº 001/2026 (Vunesp, DOE-TCE de 04/07/2026, prova em 11/10/2026): não é caso de "sem edital novo". | Origem `doe.tce.sp.gov.br` na política e banca Vunesp na admissão composta (código); caderno e gabarito só na Vunesp, bloqueada por política: sem prova anterior, só com dispensa. Confirmar com o Vinícius se fica pré-edital ou treino histórico. |
| B | `tce-ma-analista-e-tecnico-2026` | Aguardando o Cebraspe: em 25/11 às 14h a API (`TCE_MA_26`) só tem a prova e o padrão preliminar das discursivas (24/11); caderno e gabarito da objetiva não saíram. | Caderno/gabarito; escolha do cargo (23/11: Analista – Direito, cargo 3, e Técnico, cargo 16 = 2 produtos). |
| A | `tj-rs-cartorios-reta-final` | Não admitido: prova ainda não aplicada, a admissão composta só grava treino histórico. | Admissão de edital vigente (`current_notice`) pelo edital FGV retificado em 01/09/2026. |
| A | `tj-ce-cartorios-reta-final` | Pulado: concurso suspenso (Cebraspe `TJ_CE_25_NOTARIOS`, Edital nº 7, 24/10/2025), sem prova aplicada. | Retomada do certame. |
| A | `tj-ce-analista-e-tecnico-2026` | Pulado: edital só no DJEA (`djea-con.tjce.jus.br`, fora da política) e na FCC (robots proíbe); 9 cargos no mesmo edital. | Fonte oficial acessível e escolha do cargo. |
| A | `trt-ms-analista-e-tecnico-2024-2025` | Pulado: nulidade do Edital nº 01/2024 declarada em 18/08/2025 (efeito suspensivo parcial, recurso sem julgamento final localizado). | Decisão final sobre a nulidade. |
| A | `mpe-ms-promotor-de-justica-2026` | Não admitido: banca FAPEC fora das bancas da admissão composta; `mpms.mp.br` fora da política. | Código (banca e origem) e caderno/gabarito oficiais da preambular. |
| D | Câmara (2 produtos) e PGM-RJ (2 produtos) | Não iniciado. Câmara: `CD_25_NS` (Analista e Técnico, encerrado) e `CD_26_PL` (Policial Legislativo); a Cebraspe abriu também `CD_26_ANALISTA` (edital de 02/10/2026). PGM-RJ: 9º Procurador do Município e 4º Procurador da Câmara Municipal (FGV), fase escrita discursiva. | Produtos novos no catálogo exigem deploy e cadastro no Stripe (fora desta rotina). PGM-RJ não tem objetiva com gabarito. |

Item E: as 34 falhas eram de teste (fixture privada ausente do CP, expectativas do TJPE de antes de 18 e 23/11,
marcos Cebraspe conferidos contra a política da FGV). Commit `ab4adfa`; suíte com 2.315 testes passando.

## Decisões do Vinícius de 25/11 à tarde (via Chefe de Gabinete) e execução (16h–20h BRT)

- **TCE-SP** (`tce-sp-auditor-dipe-direito-2026`): exceção da fonte Vunesp **só para a prova e o gabarito oficiais
  do TCE-SP** (Edital 001/2026, prova de 11/10/2026); treino histórico (`historical_training`), página dizendo que a
  prova já foi aplicada; à venda quando passar nos gates, preço do catálogo.
- **Câmara** (`camara-camara-dos-deputados-2026`): pelo concurso novo do Cebraspe `CD_26_ANALISTA` (edital de
  02/10/2026); um produto pela P1 de Conhecimentos Básicos, comum aos 11 cargos (escolha do Vinícius nesta tarde).
- **PGM-RJ** (`pgm-rj-procurador-do-municipio-reta-final`): **parada** até existir prova objetiva com gabarito oficial
  (9º Procurador do Município e 4º Procurador da Câmara Municipal só têm a fase escrita discursiva).

| Produto | Resultado | Falta para vender |
|---|---|---|
| `tce-sp-auditor-dipe-direito-2026` | **Admitido como treino histórico.** Oportunidade `1ae7487a-2fef-43ca-9039-09c43329962b` (auditoria 254301): edital do site do TCE-SP (`f0bd1ce6…`) + 1ª rerratificação em texto, espelhamento da Vunesp (`7a02c823…`, download do operador); 10 disciplinas, 481 requisitos (programa `6324a4f5…`). Prova anterior registrada e aprovada (auditoria 254354, edição `tcesp-auditor-dipe-direito-001-2026-objetiva`): caderno 004 da Vunesp (`f59bb4da…`) e gabarito definitivo do DOE-TCESP de 05/11/2026 (questão 18 anulada). Contrato MC5 `3a467272…`. Backup `backups/before-tcesp-historico-20261125.dump` (`5e0ead3d…`). Commits `5e165ab`, `86c3326`, `e1f9647`. | 68 questões (motor). 458 de 481 requisitos com disciplina (os 22 dos gerais e 1 sem prova literal ficaram de fora). **Caderno da Vunesp precisa de novo download pelo navegador a cada ≤30 dias** (o WAF recusa o servidor): sem isso a conferência automática do link falha e a venda fecha sozinha ao passar dos 30 dias. Ajuste de código: `programmeLiteralHeadingName` aceita título em caixa mista só quando idêntico a disciplina cadastrada (`807bdaf`). |
| `camara-camara-dos-deputados-2026` | **Edital vigente aprovado e produto ligado.** Oportunidade 44 `camara-analista-legislativo-2026` (Cebraspe `CD_26_ANALISTA`, prova 17/01/2027, `current_notice`), aprovada só ela (`OPPORTUNITY_APPROVAL_ONLY_SLUG`, ref. `owner-decision-2026-11-25:camara-analista-legislativo`); carga das 2 edições (`AVAILABLE_REAL_DATA_ONLY`): edital vigente e prova anterior P1 do `CD_25_NS` (08/03/2026, 90 itens C/E, gabarito definitivo, documentos propostos). Produto e preços já existem no Stripe (preço único do catálogo). Backup `backups/before-camara-analista-20261125.dump` (`4e7d623c…`). Commits `537c323`, `76c9e60`, `5d902bc`. | Captura do edital pelo worker (ciclo de 6 h; próximo ~22h20 UTC), depois `editorial:notices:approve` só do Edital nº 1 atualizado até o nº 7 (`aef00900…`); extração no ciclo seguinte e revisão só dos requisitos da P1 (bloco 14.2.3); aprovar caderno/gabarito do CD_25_NS (`exams:links:approve`); 68 questões (motor). |
| `pgm-rj-procurador-do-municipio-reta-final` | Parado por decisão do Vinícius. | Prova objetiva com gabarito oficial. |
