ALTER TABLE "legal_text_snapshots" DROP CONSTRAINT "legal_text_snapshots_url_check";
--> statement-breakpoint
ALTER TABLE "legal_text_snapshots" ADD CONSTRAINT "legal_text_snapshots_url_check" CHECK (
  "source_url" ~ '^https://legis\.senado\.leg\.br/norma/[0-9]+/publicacao/[0-9]+$'
  or "source_url" in (
    'https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm',
    'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm',
    'https://www2.camara.leg.br/legin/fed/lei/2018/lei-13709-14-agosto-2018-787077-normaatualizada-pl.html'
  )
);
