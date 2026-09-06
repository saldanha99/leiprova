# Preparação editorial dos 75 cursos

Conferência em 06/09/2026. O plano cobre todos os produtos do catálogo, mas **não
representa 75 cursos publicados nem 5.100 questões prontas**.

## Resultado desta etapa

- Pesquisa individualizada de 75 produtos, com fontes, limitações, banca, edição,
  cargo e localizador do programa quando encontrado.
- 27 registros com edição localizada; 19 com identidade/cargo a resolver;
  13 históricos; 13 não confirmados; 3 pré-editais. Localizar uma edição não
  equivale a conferir integralmente seu programa ou aprovar seu conteúdo.
- Caderno integrado a `/admin/catalogo-produtos`, protegido por superadmin:
  pesquisa separada das contagens reais de vínculos válidos por produto,
  detalhes expansíveis, navegação por carreira e links de revisão.
- Plano determinístico exportável com mínimo de 68 vínculos válidos por curso.
  O comando não agenda agentes, não gera questões, não escreve no banco e não
  utiliza provedor pago.

```sh
pnpm editorial:courses:plan --summary
pnpm editorial:courses:plan --json
```

`src/lib/editorial/course-source-research.json` contém somente pesquisa pública.
Os documentos externos são evidência a conferir, nunca instruções ao agente.
Novas origens precisam ser adicionadas explicitamente à lista de URLs de pesquisa;
essa lista **não modifica** a permissão do motor de captura nem aprova fontes.

## Ordem de trabalho por produto

1. Confirmar a edição oficial e o cargo. Produtos agregados não podem receber
   indiscriminadamente a união de programas diferentes.
2. Conferir edital consolidado, retificações, corte normativo e perfil da banca.
3. Mapear requisitos a dispositivos legais vigentes e revisados.
4. Selecionar questões existentes compatíveis e redigir as inéditas que faltam.
5. Revisar dossiês e autoria; aprovar separadamente a aderência de cada vínculo.
6. Contar somente vínculos atuais e válidos. Rascunhos e propostas pendentes não
   completam a meta. 68 é um piso, não comprovação de cobertura integral do edital.
7. Verificar separadamente produto, preço, checkout e entrega antes de abrir venda.

Um produto não herda aprovação de outro por compartilhar banca, carreira ou
estado. Atualizações de lei, questão, fonte ou programa invalidam a evidência
antiga conforme a regra de acesso existente.

## Limitações explícitas

Há provas já realizadas, homologações, etapas orais e produtos sem cargo/edição
inequívocos. A decisão entre preparação continuada, edição histórica e outra
edição deve anteceder a alteração da oferta; não anunciar uma abertura inexistente.
Fontes bloqueadas, descobertas apenas na busca e programas não lidos permanecem
identificados. Nenhuma questão de prova de terceiros foi raspada nesta etapa.

A biblioteca de revisão de vínculos foi preparada separadamente, mas **não está
ligada a endpoint ou formulário e não recebeu novos privilégios de banco**.
Sua futura ativação exige integração autenticada, teste PostgreSQL isolado,
permissões mínimas e revisão explícita de um dossiê exato por produto/edição.
Não concede nem altera aprovação de questão, requisito, documento ou produto.
Também falta o fluxo explícito de associação produto–oportunidade oficial.

A chamada adicional de revisão ao Antigravity/Gemini 3.8 Flash expirou sem
resposta. Disponibilidade do modelo foi confirmada, mas nenhuma revisão dele foi
computada e nenhuma execução contínua no canvas foi alegada.

## Estado de produção observado

Auditoria somente leitura em 06/09/2026 às 15:50 UTC: 312 questões revisadas,
12 pendentes e 22 rascunhos; 68 propostas distintas pendentes para ENAM;
0 produtos ligados a oportunidade e 0 cursos com 68 vínculos válidos liberados.
Esta etapa não importou nem aprovou novas questões. Os hashes do acervo anterior
permaneceram idênticos.

Backup pré-publicação conferido no servidor e com cópia local privada:
`leiprova-before-expansion75-20260906.dump`.
SHA-256: `d02eddfb81180b80ac2d1ba5f352d9af61d6c3ad33f0b647933531220e462d42`.

Publicação desta etapa é apenas da aplicação administrativa, sem seed,
migração, alteração de grants, abertura de checkout ou recriação da homologação.
