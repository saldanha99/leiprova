export const OFFICIAL_LEGAL_SOURCES = [
  {
    slug: "constituicao-federal-1988",
    title: "Constituição da República Federativa do Brasil de 1988",
    shortTitle: "Constituição Federal",
    actType: "constituicao",
    actNumber: null,
    actYear: 1988,
    officialUrl: "https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm",
    monitorUrl: "https://legis.senado.leg.br/norma/579494",
  },
  {
    slug: "codigo-civil-2002",
    title: "Lei nº 10.406, de 10 de janeiro de 2002 — Código Civil",
    shortTitle: "Código Civil",
    actType: "lei",
    actNumber: "10.406",
    actYear: 2002,
    officialUrl: "https://www.planalto.gov.br/ccivil_03/leis/2002/l10406compilada.htm",
    monitorUrl: "https://legis.senado.leg.br/norma/552282",
  },
  {
    slug: "codigo-processo-civil-2015",
    title: "Lei nº 13.105, de 16 de março de 2015 — Código de Processo Civil",
    shortTitle: "Código de Processo Civil",
    actType: "lei",
    actNumber: "13.105",
    actYear: 2015,
    officialUrl: "https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13105.htm",
    monitorUrl: "https://legis.senado.leg.br/norma/584917",
  },
  {
    slug: "codigo-penal",
    title: "Decreto-Lei nº 2.848, de 7 de dezembro de 1940 — Código Penal",
    shortTitle: "Código Penal",
    actType: "decreto-lei",
    actNumber: "2.848",
    actYear: 1940,
    officialUrl: "https://www.planalto.gov.br/ccivil_03/decreto-lei/del2848compilado.htm",
    monitorUrl: "https://legis.senado.leg.br/norma/527942",
  },
  {
    slug: "codigo-processo-penal",
    title: "Decreto-Lei nº 3.689, de 3 de outubro de 1941 — Código de Processo Penal",
    shortTitle: "Código de Processo Penal",
    actType: "decreto-lei",
    actNumber: "3.689",
    actYear: 1941,
    officialUrl: "https://www.planalto.gov.br/ccivil_03/decreto-lei/del3689compilado.htm",
    monitorUrl: "https://legis.senado.leg.br/norma/528776",
  },
  {
    slug: "consolidacao-leis-trabalho",
    title: "Decreto-Lei nº 5.452, de 1º de maio de 1943 — Consolidação das Leis do Trabalho",
    shortTitle: "CLT",
    actType: "decreto-lei",
    actNumber: "5.452",
    actYear: 1943,
    officialUrl: "https://www.planalto.gov.br/ccivil_03/decreto-lei/del5452compilado.htm",
    monitorUrl: "https://legis.senado.leg.br/norma/530547",
  },
  {
    slug: "codigo-tributario-nacional",
    title: "Lei nº 5.172, de 25 de outubro de 1966 — Código Tributário Nacional",
    shortTitle: "Código Tributário Nacional",
    actType: "lei",
    actNumber: "5.172",
    actYear: 1966,
    officialUrl: "https://www.planalto.gov.br/ccivil_03/leis/l5172compilado.htm",
    monitorUrl: "https://legis.senado.leg.br/norma/547034",
  },
  {
    slug: "regime-juridico-servidores-federais",
    title: "Lei nº 8.112, de 11 de dezembro de 1990",
    shortTitle: "Regime dos Servidores Federais",
    actType: "lei",
    actNumber: "8.112",
    actYear: 1990,
    officialUrl: "https://www.planalto.gov.br/ccivil_03/leis/l8112cons.htm",
    monitorUrl: "https://legis.senado.leg.br/norma/549988",
  },
  {
    slug: "lei-licitacoes-contratos-2021",
    title: "Lei nº 14.133, de 1º de abril de 2021 — Lei de Licitações e Contratos",
    shortTitle: "Lei de Licitações e Contratos",
    actType: "lei",
    actNumber: "14.133",
    actYear: 2021,
    officialUrl: "https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm",
    monitorUrl: "https://legis.senado.leg.br/norma/33382036",
  },
  {
    slug: "estatuto-crianca-adolescente",
    title: "Lei nº 8.069, de 13 de julho de 1990 — Estatuto da Criança e do Adolescente",
    shortTitle: "ECA",
    actType: "lei",
    actNumber: "8.069",
    actYear: 1990,
    officialUrl: "https://www.planalto.gov.br/ccivil_03/leis/l8069.htm",
    monitorUrl: "https://legis.senado.leg.br/norma/549945",
  },
] as const;

export type OfficialLegalSource = (typeof OFFICIAL_LEGAL_SOURCES)[number];

export function getOfficialLegalSource(slug: string) {
  return OFFICIAL_LEGAL_SOURCES.find((source) => source.slug === slug) ?? null;
}

export function isAllowedOfficialLegalUrl(url: string) {
  return OFFICIAL_LEGAL_SOURCES.some((source) => source.monitorUrl === url);
}
