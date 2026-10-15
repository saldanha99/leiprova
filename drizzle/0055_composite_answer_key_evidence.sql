-- Evidência final composta do gabarito de prova anterior EXTERNA.
--
-- Caso que motiva a mudança: MPRJ XXXIX/2026 (prova preambular de 31/05/2026).
-- O Edital XXXIX não possui o subitem que o XXXVIII tinha (11.7.3, "com a
-- divulgação dos novos gabaritos, se for o caso"), e por isso não existe
-- gabarito oficial definitivo autônomo. A finalidade se comprova por dois
-- documentos oficiais: o gabarito preliminar e o ato da comissão que, julgados
-- os recursos, mantém TODOS os gabaritos.
--
-- Nada aqui relabela preliminar como definitivo: o tipo novo
-- 'answer_key_decision' é um ato administrativo, não um gabarito, e o rótulo
-- exibido passa a derivar do tipo do documento.
--
-- Sem backfill, sem licença de conteúdo, sem cópia hospedada, sem liberação
-- comercial. 'definitive_document' continua o caminho padrão (MPMT, PGE-AC) e
-- não muda de comportamento.
--
-- LIMITE DECLARADO: a coerência entre exam_editions.answer_key_finality e o
-- conjunto de documentos presentes envolve duas tabelas e NÃO é expressável em
-- CHECK de tabela única. Ela é garantida pelo operador
-- (src/lib/exams/mprj-previous-exam-admission.ts), pela política
-- (src/lib/exams/answer-key-finality.ts) e pelos testes. Não presuma que o
-- banco a imponha.
ALTER TABLE "exam_edition_documents" DROP CONSTRAINT "exam_edition_documents_type_check";
--> statement-breakpoint
ALTER TABLE "exam_edition_documents" ADD CONSTRAINT "exam_edition_documents_type_check" CHECK ("document_type" in ('question_booklet', 'answer_key', 'answer_key_decision'));
--> statement-breakpoint
-- O check anterior era um OR de dois ramos, ambos exigindo um dos dois tipos
-- conhecidos: um terceiro tipo violava os dois ramos mesmo com a contagem nula.
ALTER TABLE "exam_edition_documents" DROP CONSTRAINT "exam_edition_documents_expected_questions_check";
--> statement-breakpoint
ALTER TABLE "exam_edition_documents" ADD CONSTRAINT "exam_edition_documents_expected_questions_check" CHECK ((
        "document_type" = 'question_booklet'
        and "expected_question_count" is not null
        and "expected_question_count" between 1 and 300
      ) or (
        "document_type" in ('answer_key', 'answer_key_decision')
        and "expected_question_count" is null
      ));
--> statement-breakpoint
-- O ato de manutenção é sempre link externo com metadados: nunca cópia
-- hospedada, nunca conteúdo licenciado, nunca armazenamento.
ALTER TABLE "exam_edition_documents" ADD CONSTRAINT "exam_edition_documents_decision_external_check" CHECK ("document_type" <> 'answer_key_decision' or (
        "distribution_mode" = 'external_link'
        and "source_policy" = 'metadata_only'
        and "storage_key" is null
        and "byte_length" is null
      ));
--> statement-breakpoint
ALTER TABLE "exam_editions" ADD COLUMN "answer_key_finality" text;
--> statement-breakpoint
ALTER TABLE "exam_editions" ADD CONSTRAINT "exam_editions_answer_key_finality_check" CHECK ("answer_key_finality" is null or "answer_key_finality" in ('definitive_document', 'preliminary_plus_maintenance_act'));
--> statement-breakpoint
ALTER TABLE "contest_product_exam_references" ADD COLUMN "answer_key_decision_document_id" bigint;
--> statement-breakpoint
ALTER TABLE "contest_product_exam_references" ADD COLUMN "answer_key_decision_document_type" text;
--> statement-breakpoint
-- Mesmo FK composto dos outros dois documentos: prende id + edição + tipo, de
-- modo que o terceiro slot não pode apontar para documento de outra edição nem
-- para outro tipo. Depende do índice exam_edition_documents_identity_scope_uidx,
-- criado em 0038.
ALTER TABLE "contest_product_exam_references" ADD CONSTRAINT "contest_product_exam_references_answer_key_decision_scope_fk" FOREIGN KEY ("answer_key_decision_document_id","exam_edition_id","answer_key_decision_document_type") REFERENCES "public"."exam_edition_documents"("id","exam_edition_id","document_type") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "contest_product_exam_references_answer_key_decision_idx" ON "contest_product_exam_references" USING btree ("answer_key_decision_document_id","exam_edition_id","answer_key_decision_document_type");
--> statement-breakpoint
-- Ambas nulas (caminho definitivo) ou ambas preenchidas com o tipo novo e um id
-- distinto dos outros dois documentos do vínculo.
ALTER TABLE "contest_product_exam_references" ADD CONSTRAINT "contest_product_exam_references_answer_key_decision_check" CHECK ((
        "answer_key_decision_document_id" is null
        and "answer_key_decision_document_type" is null
      ) or (
        "answer_key_decision_document_id" is not null
        and "answer_key_decision_document_type" is not null
        and "answer_key_decision_document_type" = 'answer_key_decision'
        and "answer_key_decision_document_id" <> "primary_document_id"
        and "answer_key_decision_document_id" <> "answer_key_document_id"
      ));
