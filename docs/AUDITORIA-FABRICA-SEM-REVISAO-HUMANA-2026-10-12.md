# Revisão automática da fábrica: auditoria fiel à autorização

A linha automática aprovava requisitos e vínculos usando notas/campos de revisão humana. O proprietário autorizou a aprovação automática das inéditas em11/10/2026 e estendeu essa autorização às fontes/programas oficiais em12/10. A atualização distingue as duas referências e registra explicitamente ausência de revisão humana; nenhum registro histórico é reescrito.

A revisão de vínculos automática exige administrador, aprovação e a referência permanente exata da fábrica. Cada questão precisa de recibo real de aprovação no concurso exato, autoria original, status reviewed e a procedência server_cli; o fluxo também reconhece a autorização em massa de11/10 já registrada. Questão de outro concurso, recibo ausente ou fingerprint obtido no modo manual não autoriza aplicação automática. As verificações anteriores de fonte, programa, contrato, alternativas, acesso e certificação permanecem.

A revisão automática dos requisitos usa a referência de fontes/programas de12/10 e exige a mesma procedência da fábrica para todas as questões candidatas. A execução é serializable e grava objetos JSONB nativos. O fluxo manual mantém suas exigências próprias; a nova opção automática pertence ao operador de manutenção, sem campo no formulário público.

QA em cópia isolada na VPS Everglades, base16ff5c5 mais oito arquivos delimitados: lint e tipos passaram;1.768 testes gerais passaram,270 opcionais sem ambiente foram pulados. Os24 testes PostgreSQL reais passaram em banco sintético loopback após recriação isolada; incluem prova positiva do recibo/concurso exatos, rejeição cruzada e auditoria JSONB/humanReview:false. O build QA passou, imagem `sha256:8e8f14e88266a48fa49b1fdb61a286e8ffeb411440f2ff8d119255d52caf1dde`. Logs privados em `/opt/leiprova-qa-standing-factory-review-20261012/`.

A primeira rodada PostgreSQL encontrou uma fixture sem os campos obrigatórios de originalidade e duas interferências de fixtures acumuladas. A fixture foi corrigida e o banco sintético foi recriado; os erros e logs anteriores foram preservados. Uma execução com variável de ambiente incorreta pulou os24 casos e não foi usada como evidência; a rodada efetiva posterior executou todos os24.

Código e QA não comprovam publicação nem novas questões. Este recibo ainda não afirma deploy ou execução da linha em produção. As três preparações/285 questões válidas continuam sendo o último estado produtivo conferido.
