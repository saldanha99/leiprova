-- FAURGS aplicou a última prova do TJ-RS para juiz (Edital 61/2019, prova em
-- 16/01/2022). Entra só como banca de prova anterior: não aparece nos filtros de
-- estudo, que leem a lista de bancas do código.
INSERT INTO "quiz_banks" ("slug", "name", "full_name", "is_active")
VALUES ('faurgs', 'FAURGS', 'Fundação de Apoio da Universidade Federal do Rio Grande do Sul', true)
ON CONFLICT ("slug") DO NOTHING;
