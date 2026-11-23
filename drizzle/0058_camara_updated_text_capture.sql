-- Texto atualizado da Câmara para 5 leis sem compilação em texto no Senado (23/11/2026).
-- Só com o parser de captura; a carga recusa aprovar estas fontes (revisão no painel).
ALTER TABLE "legal_text_snapshots" DROP CONSTRAINT "legal_text_snapshots_url_check";
--> statement-breakpoint
ALTER TABLE "legal_text_snapshots" ADD CONSTRAINT "legal_text_snapshots_url_check" CHECK (
  "source_url" ~ '^https://legis\.senado\.leg\.br/norma/[0-9]+/publicacao/[0-9]+$'
  or "source_url" in (
    'https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm',
    'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm',
    'https://www2.camara.leg.br/legin/fed/lei/2018/lei-13709-14-agosto-2018-787077-normaatualizada-pl.html',
    'https://www2.camara.leg.br/legin/fed/lei/2021/lei-14133-1-abril-2021-791222-normaatualizada-pl.pdf'
  )
  or (
    "source_url" = 'https://www2.camara.leg.br/legin/fed/declei/1940-1949/decreto-lei-2848-7-dezembro-1940-412868-normaatualizada-pe.html'
    and "legal_act_id" = 17 and "article_count" = 402 and "parser_version" = 'camara-cp-correction-preview-v1.0.0'
    and "checksum_sha256" = '7cd4ac2c76ca87f8032df0bd0c369dcfe7b1458038cd956bd01e5d7b68d8323d'
    and "checksum_sha256" = encode(sha256(convert_to("normalized_content",'UTF8')),'hex')
  )
  or (
    "source_url" in ('https://www2.camara.leg.br/legin/fed/lei/2023/lei-14597-14-junho-2023-794299-normaatualizada-pl.html', 'https://www2.camara.leg.br/legin/fed/lei/2022/lei-14344-24-maio-2022-792692-normaatualizada-pl.html', 'https://www2.camara.leg.br/legin/fed/lei/1998/lei-9609-19-fevereiro-1998-364738-normaatualizada-pl.html', 'https://www2.camara.leg.br/legin/fed/lei/2017/lei-13431-4-abril-2017-784569-normaatualizada-pl.html', 'https://www2.camara.leg.br/legin/fed/lei/1993/lei-8625-12-fevereiro-1993-363257-normaatualizada-pl.html')
    and "parser_version" = 'camara-updated-text-capture-v1.0.0'
  )
);
