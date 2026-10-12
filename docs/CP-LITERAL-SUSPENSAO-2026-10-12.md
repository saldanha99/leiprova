# Suspensão de dois textos do Código Penal

Em 12/10/2026, a conferência do corpus real identificou títulos do artigo
seguinte incorporados ao final de dois textos da versão 63 do Código Penal
(ato 17): artigo 154-A, ID3505, termina com “Ação penal”; artigo 298, ID3657,
termina com “Falsidade ideológica”. O título válido “Falsificação de cartão”,
interno ao artigo 298, não foi tratado como erro nem removido.

Os dois registros passaram de reviewed para **suspended**, em transação
serializável com administrador único, versão atual, IDs e hashes exatos
reconferidos sob locks. O texto original e a versão foram preservados. Auditoria
real **6878**, `editorial.legal_articles.suspended`, metadados objeto JSONB,
`owner_standing_authorization`, `humanReview:false`, referência
`owner-standing-2026-10-12:official-sources-programs`.

A mesma transação confirmou zero questões para esses artigos. A leitura anterior
também encontrou zero vínculos comerciais. A suspensão impede a fábrica de
consumir os dois textos, sem afetar as 285 questões dos três cursos disponíveis
naquela conferência. Não foi feita correção silenciosa do literal, reativação,
aprovação de questões ou alteração de flags.

Hashes preservados:

- ID3505: `f32a619cbc5ea7d576b56130cfe7780e0fb51363673faab3b9b2e94f62a20e4f`.
- ID3657: `334468d93303db42ec6f4c8dae0ed2f3bb6df28fb53210b5cf8b9936ff91de8d`.

Backup prévio validado: `/opt/leiprova/backups/before-cp-heading-hold-20261012.dump`.
Recibo privado: `/opt/leiprova/backups/cp-heading-hold-20261012.log`.
Uma nova captura oficial e revisão rastreável devem resolver a mistura de títulos.
Não restaurar os registros suspensos com edição direta do texto.

A pendência da Lei12.737/2012 deve distinguir a norma alteradora dos dispositivos
atuais do Código Penal. A conferência encontrou as alterações de14.155/2021 no
artigo154-A e de15.397/2026 no artigo266 já presentes no corpus; não carregar a
redação original de2012 como se fosse a redação atual. Isso ainda não aprova os
11 requisitos sem mapeamento que mencionam12.737/14.155.
