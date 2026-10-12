# Editalume — preparação integral do catálogo

## Escopo confirmado pelo proprietário

Em 11/10/2026, o proprietário solicitou todas as 84 preparações prontas, com inéditas e PDFs oficiais de provas anteriores, além de checkout Stripe em produção. Para concursos já realizados e sem edital atual, escolheu: **treino histórico e pré-edital, identificados separadamente, com legislação atualizada**.

A vitrine foi publicada com filtros e 84 preparações planejadas. Um cartão ou produto Stripe não comprova conteúdo pronto. Treino histórico usa a identidade/programa da edição de referência e o corte normativo atual; não deve ser anunciado como reprodução de uma prova antiga. Pré-edital deve mostrar a base adotada e não inventar banca ou programa atual. Esses dois modos ainda precisam ser implementados na elegibilidade comercial, além de preparar seus conteúdos.

## Operação comercial verificada

- Banco sincronizado com os 84 concursos e seus preços LIVE mensal/anual. Master preservado.
- Conta Stripe autorizada: `acct_1TCQvlBkl6797u2u`; conferência independente sem divergências: 85 produtos ativos Editalume e 170 preços ativos Editalume. Quatro preços ativos legados foram preservados.
- Runtime de pagamentos em LIVE; cadastro, checkout por concurso e entrega já estavam habilitados. Nenhuma flag alterada nesta operação. Master segue `auto`, a partir de três produtos elegíveis.
- Fluxo público de checkout do ENAM encaminha para autenticação com retorno ao produto correto. Não houve cobrança ou teste financeiro; compra de controle e estorno continuam sem confirmação.
- Backup anterior à sincronização: `/opt/leiprova/backups/before-all-preparations-20261011.dump`, SHA-256 `7551b0505ca98d1547b12edcb54ea4687777cc6baebaefe91c26508691326c9c`. Credenciais e recibos ficam privados, fora de Git.

## Diagnóstico editorial de entrada

Prévia dos 84 produtos, sem aplicar liberação: 70 sem edição oficial revisada; 73 sem referência aprovada de prova anterior nem dispensa. Déficit inicial mínimo: **5.471 questões** para atingir 68 por preparação, antes das novas rodadas. A meta mínima não demonstra cobertura integral de programa.

Nove produtos novos receberam ordens reais de descoberta e estão bloqueados por fonte oficial ainda não admitida/confirmada. Fontes, cargo, especialidade, edição, banca e programa precisam ser confirmados individualmente. Não ampliar os perfis de banca para outros cargos por conveniência.

Há nove conjuntos de links oficiais aprovados de provas anteriores: ENAM, ENAC, PC-AL, PC-MA Delegado, PC-MA Investigador, SEFAZ-AL, TC-DF, TJ-RS e TRF-5. Os PDFs são externos; não há licença presumida para hospedagem ou incorporação de questões. TCE-MA e SEAP/PP-MA têm dispensas anteriores registradas. Primeira edição ou ausência de arquivo exige indicação honesta, nunca PDF fabricado.

O Autor existente foi recuperado após erro de modelo não suportado: selecionado GPT-6-Astra com raciocínio high no próprio terminal, preservando o nó e as rotinas. A ponte aceita as entregas como rascunhos. Aprovação e vínculos passam exclusivamente pela linha autorizada; o Maestro confere depois.

## Entrega confirmada nesta rodada

A linha de liberação concluiu às 01h05 UTC de 12/10 (22h05 BRT de 11/10):
**TC-DF liberado com 69 inéditas**. API pública confirmou três produtos disponíveis:
ENAM, PC-MA Delegado e TC-DF. As 16 questões novas aprovadas desde a conferência
anterior foram verificadas contra o corpus; nenhum erro identificado, nenhuma
suspensão. Marcador privado atualizado até 01h03min13,313668s UTC.

O Master atingiu a condição de três preparações elegíveis. ENAC segue com 52 e
precisa de mais 16 para o mínimo comercial. O restante ainda não está pronto:
o déficit mínimo remanescente de todo o catálogo é 5.456, considerando as
quantidades válidas desta rodada; além disso faltam fontes e a implementação
comercial dos modos histórico/pré-edital. Não há confirmação de cobertura
integral de programa nem compra financeira de controle.

## Bloqueios por preparação na prévia inicial

| Preparação técnica | Bloqueios iniciais |
| --- | --- |
| sefaz-sc-auditor-area-direito-2026 | sem edital oficial revisado; categoria do catálogo diferente da do edital; 0 de 68 questões aprovadas; sem prova anterior oficial aprovada nem dispensa registrada |
| enac-exame-nacional-dos-cartorios-2026-2 | 52 de 68 questões aprovadas |
| tj-rs-juiz-de-direito-2026 | 0 de 68 questões aprovadas |
| sefaz-al-auditor-fiscal-2026 | 0 de 68 questões aprovadas |
| enam-exame-nacional-da-magistratura-2026-2 | Já liberada; a prévia recusa nova liberação. |
| trf-5-juiz-federal-5-regiao | 0 de 68 questões aprovadas |
| pc-ba-delegado-2026 | sem edital oficial revisado; categoria do catálogo diferente da do edital; 0 de 68 questões aprovadas; sem prova anterior oficial aprovada nem dispensa registrada |
| pc-ba-escrivao-e-investigador-2026 | sem edital oficial revisado; categoria do catálogo diferente da do edital; 0 de 68 questões aprovadas; sem prova anterior oficial aprovada nem dispensa registrada |
| pc-ma-delegado-2026 | Já liberada; a prévia recusa nova liberação. |
| pc-ma-oficial-investigador-2026 | 0 de 68 questões aprovadas |
| tc-df-analista-2026 | 53 de 68 questões aprovadas |
| tce-ma-analista-e-tecnico-2026 | 0 de 68 questões aprovadas |
| tce-sp-auditor-dipe-direito-2026 | sem edital oficial revisado; categoria do catálogo diferente da do edital; 0 de 68 questões aprovadas; sem prova anterior oficial aprovada nem dispensa registrada |
| pc-al-agente-e-escrivao-2026 | 0 de 68 questões aprovadas |
| pgm-manaus-procurador-do-municipio-2026 | edital fora do catálogo público (fase ou data vencida); 0 de 68 questões aprovadas; sem prova anterior oficial aprovada nem dispensa registrada |
| tj-pe-juiz-de-direito-2026 | sem edital oficial revisado; categoria do catálogo diferente da do edital; 0 de 68 questões aprovadas; sem prova anterior oficial aprovada nem dispensa registrada |
| pge-al-procurador-do-estado-reta-final | sem edital oficial revisado; categoria do catálogo diferente da do edital; 0 de 68 questões aprovadas; sem prova anterior oficial aprovada nem dispensa registrada |
| tj-dft-juiz-de-direito-reta-final | sem edital oficial revisado; categoria do catálogo diferente da do edital; 0 de 68 questões aprovadas; sem prova anterior oficial aprovada nem dispensa registrada |
| pc-rj-delegado-2026 | sem edital oficial revisado; categoria do catálogo diferente da do edital; 0 de 68 questões aprovadas; sem prova anterior oficial aprovada nem dispensa registrada |
| pp-ma-inspetor-2026 | 0 de 68 questões aprovadas |
| pc-pr-delegado-2026 | 0 de 68 questões aprovadas; sem prova anterior oficial aprovada nem dispensa registrada |
| pc-pr-agente-2026 | 0 de 68 questões aprovadas; sem prova anterior oficial aprovada nem dispensa registrada |
| pp-rn-policia-penal-2026 | sem edital oficial revisado; categoria do catálogo diferente da do edital; 0 de 68 questões aprovadas; sem prova anterior oficial aprovada nem dispensa registrada |
| prf-policial-rodoviario-federal-2026 | sem edital oficial revisado; categoria do catálogo diferente da do edital; 0 de 68 questões aprovadas; sem prova anterior oficial aprovada nem dispensa registrada |
| tj-rs-cartorios-reta-final | sem edital oficial revisado; categoria do catálogo diferente da do edital; 0 de 68 questões aprovadas; sem prova anterior oficial aprovada nem dispensa registrada |
| tj-pr-cartorios-reta-final | sem edital oficial revisado; categoria do catálogo diferente da do edital; 0 de 68 questões aprovadas; sem prova anterior oficial aprovada nem dispensa registrada |
| tj-ce-cartorios-reta-final | sem edital oficial revisado; categoria do catálogo diferente da do edital; 0 de 68 questões aprovadas; sem prova anterior oficial aprovada nem dispensa registrada |
| tj-mg-cartorios-reta-final | sem edital oficial revisado; categoria do catálogo diferente da do edital; 0 de 68 questões aprovadas; sem prova anterior oficial aprovada nem dispensa registrada |
| tj-mt-cartorios-reta-final | sem edital oficial revisado; categoria do catálogo diferente da do edital; 0 de 68 questões aprovadas; sem prova anterior oficial aprovada nem dispensa registrada |
| agu-advocacia-geral-da-uniao-pre-edital | sem edital oficial revisado; categoria do catálogo diferente da do edital; 0 de 68 questões aprovadas; sem prova anterior oficial aprovada nem dispensa registrada |
| mpt-procurador-do-trabalho-2024 | sem edital oficial revisado; categoria do catálogo diferente da do edital; 0 de 68 questões aprovadas; sem prova anterior oficial aprovada nem dispensa registrada |
| tst-magistratura-do-trabalho-pre-edital | sem edital oficial revisado; categoria do catálogo diferente da do edital; 0 de 68 questões aprovadas; sem prova anterior oficial aprovada nem dispensa registrada |
| pge-rj-procurador-do-estado-reta-final | sem edital oficial revisado; categoria do catálogo diferente da do edital; 0 de 68 questões aprovadas; sem prova anterior oficial aprovada nem dispensa registrada |
| tj-ce-analista-e-tecnico-2026 | sem edital oficial revisado; categoria do catálogo diferente da do edital; 0 de 68 questões aprovadas; sem prova anterior oficial aprovada nem dispensa registrada |
| mpe-mt-promotor-de-justica-2026 | sem edital oficial revisado; categoria do catálogo diferente da do edital; 0 de 68 questões aprovadas; sem prova anterior oficial aprovada nem dispensa registrada |
| mpe-rj-promotor-de-justica-2026 | sem edital oficial revisado; categoria do catálogo diferente da do edital; 0 de 68 questões aprovadas; sem prova anterior oficial aprovada nem dispensa registrada |
| dpe-ba-defensor-publico-2026 | sem edital oficial revisado; categoria do catálogo diferente da do edital; 0 de 68 questões aprovadas; sem prova anterior oficial aprovada nem dispensa registrada |
| pc-df-delegado-de-policia-reta-final | sem edital oficial revisado; categoria do catálogo diferente da do edital; 0 de 68 questões aprovadas; sem prova anterior oficial aprovada nem dispensa registrada |
| tj-mg-juiz-de-direito-2026 | sem edital oficial revisado; categoria do catálogo diferente da do edital; 0 de 68 questões aprovadas; sem prova anterior oficial aprovada nem dispensa registrada |
| dpe-ma-defensor-publico-2026 | sem edital oficial revisado; categoria do catálogo diferente da do edital; 0 de 68 questões aprovadas; sem prova anterior oficial aprovada nem dispensa registrada |
| sefa-pa-auditor-fiscal-e-analista-reta-final | sem edital oficial revisado; categoria do catálogo diferente da do edital; 0 de 68 questões aprovadas; sem prova anterior oficial aprovada nem dispensa registrada |
| tj-go-juiz-de-direito-2026 | sem edital oficial revisado; categoria do catálogo diferente da do edital; 0 de 68 questões aprovadas; sem prova anterior oficial aprovada nem dispensa registrada |
| pc-sc-agente-e-escrivao-2025-2026 | sem edital oficial revisado; categoria do catálogo diferente da do edital; 0 de 68 questões aprovadas; sem prova anterior oficial aprovada nem dispensa registrada |
| mpe-sc-promotor-de-justica-2025-2026 | sem edital oficial revisado; categoria do catálogo diferente da do edital; 0 de 68 questões aprovadas; sem prova anterior oficial aprovada nem dispensa registrada |
| tj-pr-juiz-de-direito-2025-2026 | sem edital oficial revisado; categoria do catálogo diferente da do edital; 0 de 68 questões aprovadas; sem prova anterior oficial aprovada nem dispensa registrada |
| alerj-assembleia-legislativa-do-rj-reta-final | sem edital oficial revisado; categoria do catálogo diferente da do edital; 0 de 68 questões aprovadas; sem prova anterior oficial aprovada nem dispensa registrada |
| trt-sp-analista-e-tecnico-2-regiao | sem edital oficial revisado; categoria do catálogo diferente da do edital; 0 de 68 questões aprovadas; sem prova anterior oficial aprovada nem dispensa registrada |
| trt-rj-analista-e-tecnico-2025 | sem edital oficial revisado; categoria do catálogo diferente da do edital; 0 de 68 questões aprovadas; sem prova anterior oficial aprovada nem dispensa registrada |
| trt-10-analista-e-tecnico-df-to | sem edital oficial revisado; categoria do catálogo diferente da do edital; 0 de 68 questões aprovadas; sem prova anterior oficial aprovada nem dispensa registrada |
| tj-ba-juiz-de-direito-2026 | sem edital oficial revisado; categoria do catálogo diferente da do edital; 0 de 68 questões aprovadas; sem prova anterior oficial aprovada nem dispensa registrada |
| mp-sp-promotor-de-justica-97-concurso | sem edital oficial revisado; categoria do catálogo diferente da do edital; 0 de 68 questões aprovadas; sem prova anterior oficial aprovada nem dispensa registrada |
| trf-2-juiz-federal-2-regiao | sem edital oficial revisado; categoria do catálogo diferente da do edital; 0 de 68 questões aprovadas; sem prova anterior oficial aprovada nem dispensa registrada |
| dpe-mt-defensor-publico-2026 | sem edital oficial revisado; categoria do catálogo diferente da do edital; 0 de 68 questões aprovadas; sem prova anterior oficial aprovada nem dispensa registrada |
| mpe-go-promotor-de-justica-2025 | sem edital oficial revisado; categoria do catálogo diferente da do edital; 0 de 68 questões aprovadas; sem prova anterior oficial aprovada nem dispensa registrada |
| mpe-ms-promotor-de-justica-2026 | sem edital oficial revisado; categoria do catálogo diferente da do edital; 0 de 68 questões aprovadas; sem prova anterior oficial aprovada nem dispensa registrada |
| pp-rs-policial-analista-e-tecnico-2026 | sem edital oficial revisado; categoria do catálogo diferente da do edital; 0 de 68 questões aprovadas; sem prova anterior oficial aprovada nem dispensa registrada |
| tj-ms-cartorios-reta-final | sem edital oficial revisado; categoria do catálogo diferente da do edital; 0 de 68 questões aprovadas; sem prova anterior oficial aprovada nem dispensa registrada |
| sefaz-ce-auditor-fiscal-2026 | sem edital oficial revisado; categoria do catálogo diferente da do edital; 0 de 68 questões aprovadas; sem prova anterior oficial aprovada nem dispensa registrada |
| sefaz-mt-fiscal-de-tributos-estaduais-reta-final | sem edital oficial revisado; categoria do catálogo diferente da do edital; 0 de 68 questões aprovadas; sem prova anterior oficial aprovada nem dispensa registrada |
| sefaz-rn-auditor-fiscal-reta-final | sem edital oficial revisado; categoria do catálogo diferente da do edital; 0 de 68 questões aprovadas; sem prova anterior oficial aprovada nem dispensa registrada |
| sefaz-sp-auditor-fiscal-reta-final | sem edital oficial revisado; categoria do catálogo diferente da do edital; 0 de 68 questões aprovadas; sem prova anterior oficial aprovada nem dispensa registrada |
| sefaz-go-auditor-fiscal-reta-final | sem edital oficial revisado; categoria do catálogo diferente da do edital; 0 de 68 questões aprovadas; sem prova anterior oficial aprovada nem dispensa registrada |
| tce-rn-auditor-2026 | sem edital oficial revisado; categoria do catálogo diferente da do edital; 0 de 68 questões aprovadas; sem prova anterior oficial aprovada nem dispensa registrada |
| pgm-rj-procurador-do-municipio-reta-final | sem edital oficial revisado; categoria do catálogo diferente da do edital; 0 de 68 questões aprovadas; sem prova anterior oficial aprovada nem dispensa registrada |
| pge-ac-procurador-do-estado-reta-final | sem edital oficial revisado; categoria do catálogo diferente da do edital; 0 de 68 questões aprovadas; sem prova anterior oficial aprovada nem dispensa registrada |
| trt-pe-analista-e-tecnico-2024-2025 | sem edital oficial revisado; categoria do catálogo diferente da do edital; 0 de 68 questões aprovadas; sem prova anterior oficial aprovada nem dispensa registrada |
| trt-ms-analista-e-tecnico-2024-2025 | sem edital oficial revisado; categoria do catálogo diferente da do edital; 0 de 68 questões aprovadas; sem prova anterior oficial aprovada nem dispensa registrada |
| trt-15-analista-e-tecnico-campinas | sem edital oficial revisado; categoria do catálogo diferente da do edital; 0 de 68 questões aprovadas; sem prova anterior oficial aprovada nem dispensa registrada |
| tj-go-analista-judiciario-reta-final | sem edital oficial revisado; categoria do catálogo diferente da do edital; 0 de 68 questões aprovadas; sem prova anterior oficial aprovada nem dispensa registrada |
| tj-rj-analista-e-tecnico-2025 | sem edital oficial revisado; categoria do catálogo diferente da do edital; 0 de 68 questões aprovadas; sem prova anterior oficial aprovada nem dispensa registrada |
| tj-ms-analista-judiciario-area-fim-reta-final | sem edital oficial revisado; categoria do catálogo diferente da do edital; 0 de 68 questões aprovadas; sem prova anterior oficial aprovada nem dispensa registrada |
| camara-camara-dos-deputados-2026 | sem edital oficial revisado; categoria do catálogo diferente da do edital; 0 de 68 questões aprovadas; sem prova anterior oficial aprovada nem dispensa registrada |
| alems-assembleia-legislativa-do-ms-reta-final | sem edital oficial revisado; categoria do catálogo diferente da do edital; 0 de 68 questões aprovadas; sem prova anterior oficial aprovada nem dispensa registrada |
| alego-assembleia-legislativa-de-goias-reta-final | sem edital oficial revisado; categoria do catálogo diferente da do edital; 0 de 68 questões aprovadas; sem prova anterior oficial aprovada nem dispensa registrada |
| al-es-analista-consultor-e-policial-legislativo-2025 | sem edital oficial revisado; categoria do catálogo diferente da do edital; 0 de 68 questões aprovadas; sem prova anterior oficial aprovada nem dispensa registrada |
| pc-pe-delegado-2026 | sem edital oficial revisado; categoria do catálogo diferente da do edital; 0 de 68 questões aprovadas; sem prova anterior oficial aprovada nem dispensa registrada |
| trt-8-analista-e-tecnico-2026 | sem edital oficial revisado; categoria do catálogo diferente da do edital; 0 de 68 questões aprovadas; sem prova anterior oficial aprovada nem dispensa registrada |
| alepa-assembleia-legislativa-do-para-2026 | sem edital oficial revisado; categoria do catálogo diferente da do edital; 0 de 68 questões aprovadas; sem prova anterior oficial aprovada nem dispensa registrada |
| tce-go-tecnico-de-controle-externo-2026 | sem edital oficial revisado; categoria do catálogo diferente da do edital; 0 de 68 questões aprovadas; sem prova anterior oficial aprovada nem dispensa registrada |
| pgm-curitiba-procurador-do-municipio-2026 | sem edital oficial revisado; categoria do catálogo diferente da do edital; 0 de 68 questões aprovadas; sem prova anterior oficial aprovada nem dispensa registrada |
| dpe-pb-analista-e-tecnico-2026 | sem edital oficial revisado; categoria do catálogo diferente da do edital; 0 de 68 questões aprovadas; sem prova anterior oficial aprovada nem dispensa registrada |
| dpe-sp-defensor-publico-2026 | sem edital oficial revisado; categoria do catálogo diferente da do edital; 0 de 68 questões aprovadas; sem prova anterior oficial aprovada nem dispensa registrada |
| pc-ap-delegado-2026 | sem edital oficial revisado; categoria do catálogo diferente da do edital; 0 de 68 questões aprovadas; sem prova anterior oficial aprovada nem dispensa registrada |
| enap-exame-nacional-da-advocacia-publica-1 | sem edital oficial revisado; categoria do catálogo diferente da do edital; 0 de 68 questões aprovadas; sem prova anterior oficial aprovada nem dispensa registrada |
