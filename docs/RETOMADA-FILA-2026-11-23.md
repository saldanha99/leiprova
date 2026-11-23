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

## Segunda rodada (tarde de 23/11): decisões do Vinícius para o item 3

Decisões: PC-PR com Agente de Polícia Judiciária e Papiloscopista Policial separados (o edital não tem cargo
"Investigador"); TCE-MA com Analista – Direito (cargo 3) e Técnico (cargo 16); 2 produtos novos no Stripe live
com o preço padrão do catálogo; publicação da migration 0058. Publicações `120dea2` e `fe0ecea` (site 200),
combinadas com o Dev Wise Wolf (redesenho só no front, na `feat/redesenho-els`).

- **PC-DF Delegado** (`d7511cf`): os títulos do edital são "X e Legislação Complementar". 9 disciplinas literais
  admitidas (fingerprint `88a21af7…`) e 190 de 193 requisitos classificados; os 3 restantes têm o título quebrado em
  duas linhas.
- **TJ-PE Juiz Substituto**: Direito do Consumidor e Direito da Criança e do Adolescente admitidos e 26 requisitos
  classificados (57 de Noções Gerais/Formação Humanística ficam fora, como nos outros tribunais; 3 sem prova por
  fragmentos). Contrato MC5 aprovado (`374db105…`, item 10.4, p. 23), porque o gabarito definitivo já existe.
- **PC-PR Agente e Papiloscopista** (`120dea2`, `fe0ecea`, `5a43ed6`, `685557e`): receitas pelo bloco próprio de
  cada cargo no Anexo I (Agente p. 70–73, Papiloscopista p. 73–76, do item 2 em diante; o item 1 não é lei seca).
  Admitidos: oportunidades 38 e 39, 57 requisitos cada (auditorias 145985 e 146001). Prova anterior (caderno Tipo 1 +
  gabarito definitivo) registrada e aprovada; contratos MC5 `a668ef5b…` e `7ec37f37…`; 4 disciplinas penais
  admitidas (`ae07b874…`) e 61 requisitos classificados. A checagem de edição duplicada passou a considerar o título
  (cargo), já que Agente e Papiloscopista têm a mesma carreira e data.
- **Stripe**: `--only=<slug>` no sincronizador cria ou confere só os concursos indicados, sem tocar o Master (o
  sync em lote recusa porque há assinaturas). `pc-pr-papiloscopista-2026` criado em live (produto + 2 preços,
  R$ 67/mês e R$ 347/ano); `pc-pr-agente-2026` renomeado. Catálogo com 85 produtos.
- **TCE-MA** (pendente): prova aplicada em 22/11; a Cebraspe ainda não publicou caderno nem gabarito. Admitir o
  Analista – Direito (cargo 3, p. 48–51) e o Técnico (cargo 16, p. 67–68), com `startLine`/`stopLine` como no
  TCE-RN, assim que sair o gabarito. Os 149 requisitos atuais da oportunidade 14 misturam parte geral, cargo 3 e
  cargo 16.
- **PGM-Manaus** (bloqueado por fonte): o edital só está no DOM de Manaus, que não responde dos servidores, e na FCC,
  cujo robots proíbe `/concursos/` e PDFs. A notícia da Prefeitura não anexa o PDF.
- **legal_change** (`8de3820`): o servidor calcula o diff de parágrafos entre a fotografia aprovada e a pendente mais
  recente de cada lei; o Guardião analisa offline. 16 tarefas, uma por lei; as antigas, repetidas ou sem diff
  ficaram `superseded`. A Constituição Federal tem captura pendente diferente da aprovada desde 30/10 (provável
  emenda nova): revisar no painel.
- **5 leis sem texto no Senado** (`5bab4aa`, migration 0058): texto atualizado da Câmara (IDs pelo LexML), só
  captura `pending_review` para revisão no painel: Lei Geral do Esporte (164 artigos), Henry Borel (34), Software
  (16), Escuta Protegida (29) e LONMP (82).
- Testes: 4 falhas em `tests/fgv-historical-lote1.test.ts` são anteriores a esta rodada (o teste ainda espera o TJPE
  sem gabarito definitivo) e 29 em `cp-reconciliation-preview` dependem da captura privada do CP em `.local`.

## Terceira rodada (noite de 23/11): "tudo autorizado, resolva tudo"

Regra do Vinícius: autorização não é aprovação às cegas; o que não bater com a fonte oficial não é aprovado.

- **5 leis aprovadas** (`2c8fdd3`, `--approve-camara-updated`): texto atualizado da Câmara recapturado na execução e
  conferido por amostragem no Planalto (artigos e último artigo). Versões vigentes: Lei Geral do Esporte v150
  (164 artigos, `dc6d053a…`), Henry Borel v151 (34, `680413d3…`), Software v152 (16, `890f1ce9…`), Escuta
  Protegida v153 (29, `86000b1e…`), LONMP v154 (82, `41bb0cff…`). Backup `before-5-leis-camara-20261123.dump`.
- **PGM-Manaus admitida** (`f101288`, `41776b8`, `dedab0f`): edital do DOM nº 6343 (02/07/2026, Edição Extra),
  `8cb56a3c…`, baixado no navegador pelo Chefe de Gabinete (o WAF do DOM recusa o servidor). URL oficial
  `https://dom.manaus.am.gov.br/pdf/2026/julho/DOM%206343%2002.07.2026%20Edicao%20Extra.pdf`. Oportunidade
  `a48823c2-…`, 179 requisitos (auditoria 147515), 167 classificados (12 de Direito Municipal fora). Sem contrato
  nem prova anterior: caderno e gabarito ficam no portal da FCC, cujo robots proíbe a consulta.
- **Constituição Federal não aprovada.** A captura de texto do Senado (4040, `f5a8b069…`) difere da v65 só nos
  arts. 7, 40, 198 e 201: EC 141/2026 (art. 7º, XIII: 40 horas semanais; § 1º, §§ 2º e 3º) e EC 140/2026 (arts.
  40 § 5º-A, 198 IV/§§ 4º-A, 4º-B e 10, 201 § 8º-A). Esses 4 artigos têm 174 vínculos e 188 questões; 6 questões
  falam em 44 horas. A CF inteira sustenta 6.182 vínculos, 6.136 questões e 28 produtos. O carregador só troca a
  versão, e o filtro da loja exige versão corrente: aprovar agora tiraria todas essas questões das ofertas.
- **legal_change**: das 16 leis, 10 têm o texto consolidado do Senado idêntico ao aprovado (só a página de
  declarações mudou); não aprovadas, porque o texto oficial ainda não reflete as alterações declaradas. CTN (16
  artigos alterados, 20 acrescidos; 130 vínculos e 153 questões nos alterados) e ECA (art. 4º; 9 vínculos) têm
  texto novo e esperam o mesmo operador da CF. CP, LGPD e Lei 14.133 têm fonte própria e ficam fora.
- **Próximo passo**: operador de transição de versão legal (religar os artigos sem mudança, reabrir só os vínculos
  dos artigos alterados, ensaio em clone) para CF, CTN e ECA.
- **TCE-MA**: ainda sem gabarito na Cebraspe em 23/11 à noite.
