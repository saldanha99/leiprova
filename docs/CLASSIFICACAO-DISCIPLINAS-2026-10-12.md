# Disciplinas dos programas: operador e QA

## Retomada aplicada — 12/10/2026, após 12h27 BRT

Mais **332 requisitos classificados**, após o cadastro das 20 disciplinas:

| Programa | Novos requisitos | Auditorias |
| --- | ---: | --- |
| TRF-5 | 79 | 8687–8765 |
| MPMT | 101 | 8434–8534 |
| MPRJ | 112 | 8535–8646 |
| PGE-AC | 40 | 8647–8686 |

Seis lotes com até 100 itens, prévias e aplicações separadas com fingerprints
coincidentes. Todos foram reconferidos no banco: disciplina igual à auditoria,
estado `draft`, revisão anterior limpa, mapas/tópicos nulos e `humanReview:false`.
As 579 classificações preexistentes foram preservadas: total 911 de 1.101
requisitos nos cinco escopos. Esses números não representam questões publicadas.

**190 itens continuam bloqueados**: sete TRF-5, 26 SEFAZ-AL, 56 MPMT e 101 MPRJ.
São divergências de cabeçalho/localizador, texto integral não demonstrado pelas
páginas ou posição ambígua. Não aprovar por aproximação nem dividir disciplinas
compostas para preencher quantidade. Revisão material dos mapas legais permanece
necessária antes de autoria/liberação.

Código/ferramentas `9cdbf0c`; QA final: 1.813 testes gerais, 35 específicos
(incluindo nove PostgreSQL), lint, tipagem e build aprovados. Recibos privados
na VPS em `.local/editorial/classification-resumed-20261012/`, com seis entradas,
prévias e aplicações. Backup anterior e hash no documento de admissão.

A comparação integral antes/depois confirmou exatamente 332 requisitos
alterados, os outros 769 intactos e as 579 classificações anteriores preservadas.
A primeira preparação da fila examinou 100 requisitos e atualizou 39 pacotes de
mapeamento, sem autoria; `hasMore:true` indica pendência de atualização integral.
A conferência comercial posterior preservou três preparações/285 questões
válidas, com saúde do site `ok`.

## Histórico anterior à retomada

O operador classifica somente cinco oportunidades/cargos exatos: TRF-5 Juiz Federal, SEFAZ-AL Auditor Fiscal, MPMT/MPRJ Promotor Substituto e PGE-AC Procurador Classe I. Não escolhe artigos, fontes novas, questões ou produtos. O catálogo atual comporta429 candidatas com evidência: MPMT197, MPRJ176 e PGE56. As150 classificações anteriores de TRF/SEFAZ são preservadas. Quantidade candidata não significa aplicação.

Cada item revalida texto integral, localizador/páginas, SHA dos bytes, snapshot/fonte aprovados, cargo/edição e disciplina canônica ativa. Fragmentos separados exigem offsets UTF-16 explícitos, ordem, ausência de sobreposição e mesma seção/ponto; todo o requisito deve ser reconstruído, sem inferência de trecho contíguo. Cabeçalho de Processual Civil na mesma linha do Ponto1 é aceito com sua linha integral. Disciplinas compostas não são divididas ou convertidas em genéricas; proposta privada separada contém20 disciplinas ainda não cadastradas.

Prévia é read-only/repeatable-read. Apply exige o fingerprint fresco e roda serializable, com travas da reserva/fila, oportunidade, requisitos, fontes/snapshots e disciplinas. Reserva running, questão/vínculo existente, artigo adicional ou contexto alterado bloqueia. Requisito reviewed sem mapa retorna a draft, com campos de revisão limpos e fotografia anterior preservada no novo audit; a revisão material do mapa legal ainda é obrigatória. Auditoria registra autorização permanente12/10, humanReview:false e zero questões/produtos aprovados. A fábrica não prepara autoria sem disciplina definida e rejeita resultados de contexto anterior.

QA em cópia isolada16ff5c5 mais atualização da auditoria/fábrica e sete arquivos delimitados, sem migração0054: lint/tipos passaram;1.777 testes gerais passaram,274 opcionais foram pulados;28 testes PostgreSQL reais passaram, incluindo três do operador e um da autoria sem disciplina. Build QA aprovado, imagem `sha256:563fb855aa6a61708b56fe0389792ed3a53dfcf358e2e2afc96f0533455f7d5e`. Logs privados em `/opt/leiprova-qa-programme-classifier-20261012/`.

As primeiras rodadas detectaram alias SQL reservado e coluna source.updated_at inexistente; corrigidos antes da aprovação do lote. A fonte agora participa do fingerprint por SHA da fotografia completa do registro. Erros anteriores e fixtures acumuladas foram preservados em logs; nova base sintética confirmou os28 casos. Uma rodada geral herdou URL de homologação incompatível com quatro testes que usam URL padrão; a repetição sem essa variável passou integralmente. Nenhuma dessas falhas foi contada como aprovação.

A seção seguinte registra a aplicação efetiva em produção. Entradas/propostas privadas e comandos ficam em `.local/editorial/programme-classification-design-20261012/`. As candidatas não resolvem os requisitos sem evidência integral ou disciplina correspondente, nem substituem novas questões válidas por cargo/banca/edição.

## Aplicação efetiva

App/worker publicados em5f895e1, imagem app `sha256:90746d171139295b24fe286be047f87dd115447d162d8d53a7f5805369b8942a`, seed não executado, saúde200/zero reinícios. Backup anterior validado `before-programme-classification-20261012.dump`. Conferência read-only às12:27:25.440037UTC confirmou429 requisitos classificados/draft, mapas legais/tópicos nulos e revisão anterior limpa, todos com humanReview:false: MPMT197/audits7717–7913; MPRJ176/audits7914–8089; PGE56/audits8090–8145. Nenhuma questão, vínculo legal ou venda liberada.

Cinco lotes aplicados com a função auditada, cada um após preview fresco e com seu fingerprint. O primeiro apply separado foi recusado e não alterou requisitos. A execução privada subsequente fez preview e apply consecutivos, com as mesmas verificações/transaction serializable/locks, sem remover bloqueios; produziu recibos reais. Fingerprints: `a4806a5ecdefbde9c419de8f57824b8bfdfde69baef8c981229fc6fe4cc09e50`, `43ee4feb92cb5207105f5f845508fdb748e0db597074af38f336258e60db9b81`, `d871f582c80ca162a72372bbde206b980c3e3d46c51a92d35e3bad7e3f581ada`, `5e65861515e860d3f456efc7d973b2632cc0bb2f8c134af8d364813d5457d530`, `3cea9a78697096d3cccabea2a9b9f4356b32a66bb8cb9ab2315d19c5ea177617`. Recibos privados em `/opt/leiprova/.local/editorial/programme-classification-applied-20261012/`. As20 disciplinas propostas e demais itens sem evidência continuam pendentes.
