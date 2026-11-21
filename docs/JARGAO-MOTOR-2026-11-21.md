# Jargão do motor no texto do aluno — 21/11/2026

**Questões novas (aprovado):** o contrato de autoria recusa enunciado, alternativas, justificativas e
comentário com id interno, versão, "corpus", "pacote" (exceto "pacote anticrime"), "texto/dispositivo/
redação recebido/fornecido/versionado", "versionId"/"articleId" (src/lib/editorial/student-facing-text.ts).
O prompt de sistema do worker manda citar lei e artigo pelo nome (fora do hash dos pacotes). Medir nas
primeiras 24 h após o deploy: recusas por "referência interna" e custo extra.

**Questões antigas (aguarda OK do Vinícius sobre a amostra):** regra determinística, sem IA
(src/lib/editorial/jargon-rewrite.ts). Amostra, contagem e não resolvidos em
/data/OpenBot/Shared/leiprova/jargao-motor/.

Gravar (só com OK), como dono do banco, numa transação:
1. Exportar (só leitura) as questões candidatas para JSONL (ver a consulta no relatório de 21/11).
2. `npx tsx scripts/editorial/jargon-rewrite-sql.ts entrada.jsonl saida.sql` (ensaio, termina em ROLLBACK);
   conferir "vinculos_em_dia" e "certificacoes_em_dia" iguais antes e depois.
3. Backup das linhas antigas: o próprio SQL grava antes/depois em audit_logs
   (action editorial.jargon_rewrite); fazer também o backup.sh do banco.
4. Gerar com `--commit` e rodar com psql como dono do banco.

O SQL: só altera campo cujo texto ainda é o esperado; não toca updated_at; regrava
evidence->questionContent só nos vínculos que batiam com o conteúdo antigo e recalcula
question_content_hash só nas certificações que batiam com o hash antigo. Ensaio em produção
(30 questões com vínculo, ROLLBACK): 24 vínculos e 24 certificações em dia antes e depois.

Reverter: para cada audit_log editorial.jargon_rewrite, repor `before` nos campos e regravar
vínculo/certificação pelo mesmo procedimento (o gerador aceita a entrada invertida).

## Gravação feita em 21/11/2026, 18:05 UTC (OK do Vinícius via Chefe de Gabinete)
- Backup antes: backups/leiprova-20261121T180030Z.dump (pg_restore --list com 1.360 entradas).
- Entrada: mesma lista de 4.496 questões da amostra. SQL idêntico ao do ensaio, terminando em COMMIT.
  sha256 b18bf420bede2bd7aa9ee3ce727da996d0f6fdd8fa2bba64f1fb25ae151ec6a1.
- Resultado: 3.667 campos (0 pulados), 2.861 audit_logs, 2.677 vínculos e 2.402 certificações regravados.
- Conferência: em dia antes = depois; vínculos e certificações aprovados dessincronizados 0 → 0 no banco todo;
  updated_at das 4.496 sem mudança (mesmo md5); elegíveis por produto iguais (27 produtos, 11.414).
- Fora da gravação: 11 questões novas com jargão, geradas antes da trava (7 com 11 campos que a regra corrige; ids 19148, 19150, 19156–19159,
  19161, 19162, 19171, 19172, 19196). Ficam para um próximo OK.
