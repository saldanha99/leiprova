# Cadastro de disciplinas oficiais: operador verificado

Vinte nomes ausentes no catálogo atual foram confrontados com24 provas de rótulos literais em páginas oficiais aprovadas, nas oportunidades TRF-5/SEFAZ-AL/MPMT/MPRJ/PGE-AC. São disciplinas próprias, incluindo nomes compostos; não equivalem a cobertura legal, mapas aprovados, questões ou cursos disponíveis. Entradas como Direito Civil e Empresarial e Direito Civil e Direito Empresarial permanecem distintas. PrefixosF)/H) do programa ficam na prova literal, enquanto o nome de catálogo identifica a disciplina.

A conferência read-only efetiva às13:52:22UTC validou os20 nomes, páginas/linhas completas, cargo, edição atual e SHA dos bytes. Fonte de portal pode ser metadata_only; o snapshot do PDF é necessariamente official_document/aprovado. Nenhum corpo de prova de questões foi utilizado. A primeira consulta de diagnóstico escolheu a sobrecarga TEXT do operador JSON e retornou páginas nulas; corrigida para índice INTEGER, antes de qualquer cadastro. O diagnóstico anterior foi preservado.

O operador admite somente esses20 nomes/slugs e cinco escopos exatos, em2026, com administrador explícito e autorização permanente12/10. Revalida documento/snapshot/bytes/página, cargo/slug/edição, políticas/URLs oficiais e colisões do catálogo. Não renomeia, divide, mescla nem reativa disciplinas. Prévia read-only/repeatable-read; apply serializable exige fingerprint fresco e trava brevemente catálogo e fontes. Cria apenas quiz_subjects e audit JSONB com humanReview:false; questões, requisitos, mapas e produtos têm zero aprovações nesse passo.

QA em cópia privada base261ed11 mais quatro arquivos delimitados, sem dados de produção: lint/tipos passaram;1.802 testes gerais passaram e292 opcionais sem ambiente foram pulados. Dez casos focados passaram, incluindo quatro PostgreSQL reais em banco sintético loopback55446: preview sem writes, cadastro idempotente/auditJSONB, recusa de contexto alterado, entrada inativa e bytes divergentes. Build QA aprovado, imagem `sha256:9adfcea672205e9bab2c113116c8779165730af860e1cd9267ceda921d916a23`. Logs privados em `/opt/leiprova-qa-subject-admission-20261012/`.

As primeiras fixtures tinham Date em coluna DATE, não criavam a oportunidade7 ausente no seed e entregavam Date cru a SQL parametrizado. Somente fixtures foram corrigidas, com alvo sintético estritamente guardado, rótulo de teste e datas tipadas; nenhum guard produtivo foi reduzido. Rodada positiva focused-v4 executou todos os dez casos. Código/QA ainda não comprovam cadastro em produção.

CLI: `tsx --env-file-if-exists=.env scripts/admit-standing-programme-subjects.ts --input=ARQUIVO_PRIVADO --actor=UUID_ADMIN`; aplicação separada acrescenta `--apply --fingerprint=SHA_DA_PREVIA`. Entrada privada preparada em `.local/editorial/subject-admission-20261012/input.json`, com edições25/31/39/null/40 atualizadas e24 provas. A classificação dos432 requisitos candidatos depende de cadastro efetivo e evidência integral própria, em etapa distinta.


## Retomada conferida em 12/10/2026

O chat anterior terminou com falhas de capacidade e conexão depois dos testes,
antes da aplicação. As seis alterações locais coincidem por SHA-256 com a cópia
que passou na VPS: 1.804 testes gerais (294 opcionais ignorados), 26 testes
específicos, incluindo nove PostgreSQL reais, lint, tipagem e build.
Logs: `/opt/leiprova-qa-classifier-expanded-20261012/{general-v2,focused-v2,build-v2}.log`.

A correção distingue um PDF oficial direto aprovado de uma página de portal.
Mantém a validação da banca, URL, política, identidade, bytes e página. A
classificação passa a reconhecer os 20 nomes exatos, preservando disciplinas
compostas. Estes checks ainda não são recibo de aplicação em produção.
