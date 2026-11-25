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
