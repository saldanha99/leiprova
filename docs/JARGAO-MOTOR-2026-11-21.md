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
