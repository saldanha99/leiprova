# Evidência de formato MPRJ XXXIX/2026

Operador exclusivo da oportunidade20, edição41, Promotor de Justiça Substituto,
prova preambular Tipo1. O edital aprovado comprova a etapa de100 questões de
múltipla escolha; as instruções da página1 do caderno comprovam cinco opções e
uma única correta. Não é incorporação de prova nem perfil oficial da FGV.

A capa não fornece instituição/UF/ano como texto extraível. A identidade composta
exige o edital aprovado, a edição/publicId exatos, cargo, banca, metadados do
caderno aprovado, URL oficial exata e hashes atuais; a capa acrescenta ordinal,
cargo e Tipo1. Não aceitar a capa isoladamente como identidade de qualquer concurso.
Somente página1 é interpretada, em memória. Não persistir PDF, texto da capa,
questões, alternativas ou gabaritos; a tabela guarda fatos tipados e hashes.

## Admissão auditada

Usar o CLI `scripts/review-mprj-format-contract.ts` com entrada JSON privada
`{ "contract": ... }`, ator administrador UUID explícito e banco/papel esperados.
A entrada não recebe `formatEvidence`: ela é derivada pelo operador. O perfil
abstrato interno é `MPRJ_PROMOTOR_MULTIPLE_CHOICE_PROFILE`. O modo preview é
somente leitura; apply exige o fingerprint exato e observa novamente a fonte.

```sh
pnpm exec tsx --env-file-if-exists=.env scripts/review-mprj-format-contract.ts --input=ARQUIVO_PRIVADO --actor=UUID_ADMIN --mode=preview
pnpm exec tsx --env-file-if-exists=.env scripts/review-mprj-format-contract.ts --input=ARQUIVO_PRIVADO --actor=UUID_ADMIN --mode=apply --expected-fingerprint=SHA256_DA_PREVIA
```

No contêiner operacional, usar limite de execução do processo (`timeout 90`) para
cada chamada. A rede tem timeout15s por fonte; isso não é uma garantia de tempo
máximo da computação síncrona do parser PDF. Falhas não autorizam contornar fonte,
robots ou preencher evidência por inferência.

O operador não publica produto, certifica questões, altera flags ou substitui
revisão humana por alegação fictícia. Registra `owner_standing_authorization`,
`humanReview:false`, fatos e contrato na mesma transação serializable.

## Renovação e continuidade

A observação expira à00hUTC do segundo dia após a verificação. Antes disso,
repetir preview/apply com `--refresh` nos dois comandos, usando fonte atual.
Ausência de observação válida fecha o gate por leitura; nenhum monitor HTTP novo
ou renovação automática foi instalado por este módulo. A coordenação deve conferir
a janela nas retomadas, sem declarar vigência remota contínua.

Renovar fatos de formato idênticos preserva o contrato autoral original e seus
certificados. A função SQL exige uma observação atual aprovada dos mesmos bytes,
fatos, parser e documento; a evidência histórica referida no payload pode estar
superada por essa renovação, mas nunca suspensa. Não trocar IDs de questões nem
recontar uma renovação como publicação. Mudança material de fonte/formato exige
novo contrato, sem aproveitar automaticamente a autoria anterior.

A aplicação pode executar somente a função booleana; não recebe leitura ou escrita
na tabela privada. Suspensão do documento, evidência original ou observação atual,
identidade divergente, fonte alterada e falta de renovação impedem validade.
Migração0056 deve preceder o novo código SQL da aplicação e da ponte.

## Validação de integração

Além da suíte geral, executar o teste opt-in PostgreSQL em instância descartável:
`tests/mprj-format-postgres.test.ts`. Ele exige loopback, banco vazio e papel de
teste exatos. Verifica constraints, timestamps com microssegundos, gates sob o
papel app sem acesso à tabela, expiração, renovação equivalente e suspensão.
O ensaio da cadeia completa deve incluir as57 migrações do journal.

Retorno operacional: preservar backup anterior à0056 e imagens da revisão anterior.
O código anterior funciona com a tabela nova sem removê-la; não destruir evidências
ou restaurar banco sobre produção automaticamente. A ponte temporariamente fixada
no código antigo deve voltar ao fonte validado após aplicar a migração, para usar
os mesmos gates que a aplicação.
