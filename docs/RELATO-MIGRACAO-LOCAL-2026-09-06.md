# Migração local aplicada fora do sandbox pretendido

Em 06/09/2026, durante a implementação de curadoria por produto, uma chamada de `drizzle-kit migrate` recebeu `DATABASE_URL` apontando para o sandbox exclusivo `127.0.0.1:55441/leiprova_binding_test`, mas não fixou `MIGRATION_DATABASE_URL`. O carregamento de `.env` pelo Drizzle forneceu esta última variável, que tem precedência em `drizzle.config.ts`. O destino efetivo foi o banco **local** `127.0.0.1:5432/leiprova`, não a VPS.

O desvio foi comunicado imediatamente ao agente principal. Nenhuma reversão, remoção de tabela ou escrita adicional de negócio foi feita nesse banco. Consultas posteriores usaram transações explicitamente somente leitura.

## Evidências da leitura após o evento

- `current_database() = leiprova`, `inet_server_addr() = 127.0.0.1`, `inet_server_port() = 5432`.
- Histórico Drizzle: IDs 1–12 na transação `xmin=3293`; IDs 13–34 na transação `xmin=4008`. Assim, a chamada aplicou as **22 migrações pendentes 0012–0033**, não somente a nova 0033.
- Último registro: ID 34, `created_at=1788661476686`, SHA256 `bd16b337a1819a3e9d070948a35f2fd3d3ad837f3cc066c3a988ec4d1542b9e2`, correspondente a `0033_product_question_curation.sql`.
- `contest_product_question_bindings`: **0** registros.
- `audit_logs` com ação `editorial.product_binding.proposed`: **0** registros.
- `question_opportunities`: **0** vínculos legados.
- `questions`: **12**, todas `pending_review` e com `xmin=4008`; `legal_articles`: **12**, todas `pending_review` e com `xmin=4008`. A migração preexistente **0020** rebaixou esses registros para revisão pendente, por não haver revisão humana atribuída nas questões. Ela muda status e `updated_at`, não enunciados, alternativas ou texto literal. Não foram importadas ou aprovadas questões pelo serviço de curadoria nesse banco.

Não havia captura prévia completa de todas as tabelas. Portanto, não é correto afirmar que as migrações antigas não tiveram efeitos nos dados: **houve alteração de estado editorial de 12 questões e 12 artigos**, além de alterações de estrutura/constraints. O confirmado é a ausência de importação/aprovação editorial pelo novo operador e o estado acima, não uma garantia de invariância de toda a base. Não restaurar aprovação sem revisor como forma de desfazer o desvio; qualquer tratamento posterior exige direção específica.

## Contenção e prevenção adotadas

Testes seguintes usam exclusivamente o novo servidor temporário em `127.0.0.1:55441/leiprova_binding_test`, sem copiar conteúdo ou clientes de outro banco. Nas migrações de teste, **MIGRATION_DATABASE_URL e DATABASE_URL** são ambas fixadas no comando. A identidade e porta do banco foram conferidas antes dos grants e testes. O importador novo não aceita fallback de `DATABASE_URL`: exige destino explícito, papel restrito em produção e confirmação de importação pendente, nunca de aprovação.

Nenhuma alteração de DNS, VPS, Stripe, envio de e-mail ou WhatsApp foi realizada por esta operação.
