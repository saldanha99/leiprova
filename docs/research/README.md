# Pesquisa pública do catálogo — 05/09/2026

Fonte: [Decorando a Lei Seca](https://www.decorandoaleiseca.com.br/). Navegação e extração feitas com agent-browser, sem autenticação, acesso a cursos ou download de questões.

`catalogo-dls-2026-09-05.json` preserva a fotografia da vitrine (75 cards), do menu (71 entradas) e do sitemap (545 URLs). O sitemap inclui páginas históricas e artigos: **545 URLs não significam 545 cursos à venda**. A fotografia não é um monitor contínuo e não confirma disponibilidade atual, edital aberto ou autorização de uso de materiais.

| Categoria | Ofertas na vitrine |
|---|---:|
| Cartórios | 7 |
| Carreiras Jurídicas | 19 |
| Carreiras Policiais | 14 |
| Tribunais | 4 |
| Procuradorias | 6 |
| Fiscal e Controle | 12 |
| Área Legislativa | 5 |
| Trabalhistas | 8 |

Foram coletados apenas nomes, cargos, rótulos de edição, categorias e links públicos. Não foram copiados textos de venda, imagens, cursos, comentários ou questões. A vitrine completa foi extraída; não se afirma que todos os destinos individuais foram auditados.

## Normalização e divergências

- `src/lib/commerce/planning-catalog.json`: 75 edições/produtos únicos, todos em pesquisa. Cargo e edição distinguem concursos do mesmo órgão.
- O menu inclui “Projeto Carreiras Jurídicas”, uma oferta agregadora, não contada como concurso individual. As diferenças entre menu e vitrine foram preservadas no arquivo bruto.
- SEFAZ-SC: o link da vitrine `/reta-final-sefaz-sc` aponta para página não encontrada; o link do menu `/reta-final-auditor-sefaz-sc` abriu com título e canonical válidos. O catálogo normalizado usa este último; a evidência bruta não foi alterada.
- Abrangência nacional usa `BR`. Concursos regionais aparecem nos filtros dos estados abrangidos, mas mantêm uma única URL e um único produto. Ex.: TRF5 em AL, CE, PB, PE, RN e SE; TRF2 em ES e RJ; TRT10 em DF e TO; TRT15 em SP.
- Referências primárias de abrangência: [TRF5](https://www5.trf5.jus.br/jurisdicao/) e [TRF2](https://www.trf2.jus.br/trf2/institucional/competencia).
- Há 24 códigos territoriais representados, incluindo Brasil. Não foram inventadas ofertas para estados ausentes na fotografia.
- A classificação territorial é organização de catálogo, não confirmação de edital. Antes da venda, conferir fonte oficial, cargo, edição, território, banca, conteúdo e licença aplicável.

Páginas de pesquisa permanecem em preparação, com `noindex` e fora do sitemap do Editalume. Uma oferta do concorrente nunca é promovida automaticamente a produto liberado.
