# Código Penal: parser delimitado e prévia de correção

Esta entrega implementa **somente parser e prévia**. Não admite fonte no registry/loader, grava snapshot no banco, ativa versão, restaura artigo, revisa questão ou altera requisito/binding/Qcert. Não contém um modo `--apply`. A troca coordenada da versão e a conferência das cinco questões do ENAC continuam uma etapa posterior.

QA efetivamente executado em cópia própria na VPS, sem env de banco/rede:
lint geral, Next typegen/typecheck global e **1.763 testes gerais passaram**, com
269 opcionais pulados. Os **15 testes focados passaram sem skips**, incluindo
os819766 bytes da captura oficial privada,402 artigos e31 retirados/hash canônico.
O build Docker de produção passou em tag exclusiva de QA, sem substituir a aplicação.
Recibos privados em `.local/qa-cp-correction-20261012/`; a execução real da CLI e
o diff do banco atual ainda são etapas distintas. Falhas anteriores de sidecars
AppleDouble e env vazio no runner foram preservadas, corrigidas no QA e não
representam validações aprovadas. Nenhuma fonte dos quatro arquivos mudou durante a QA.

## Fonte e perfil fixados

Fonte primária: [Código Penal atualizado da Câmara](https://www2.camara.leg.br/legin/fed/declei/1940-1949/decreto-lei-2848-7-dezembro-1940-412868-normaatualizada-pe.html). A captura de pesquisa de 12/10/2026 respondeu HTTP200/robots200, 819766 bytes; SHA256 bruto `57547f371c5dd6e609f453397d2098e3930876b03f7233096b0dff907832b3e4`. A data editorial do documento, 23/09/2026, não determina a vigência uniforme de cada artigo.

`camara-cp-correction-preview-v1.0.0` aceita essa URL e esses bytes exatos. Reconhece **433 referências, 402 artigos normativos e 31 integralmente retirados**. O corpo canônico serializa `[path,"",literalText]`, com hash `7cd4ac2c76ca87f8032df0bd0c369dcfe7b1458038cd956bd01e5d7b68d8323d`. Os títulos estruturais ficam separados do literal; campos `heading` da versão futura exigirão política e fingerprint explícitos. Esse hash não é recibo de snapshot aprovado.

A prévia recaptura também a [publicação original da Lei 15.517/2026](https://www2.camara.leg.br/legin/fed/lei/2026/lei-15517-22-setembro-2026-800012-publicacaooriginal-181458-pl.html), hash bruto `44775d6c3fc157dfd63467295a6aa025285b304f762995577c8773eadc6ce596`. As adições dos arts.155/157 conferem literalmente com essa fonte. Publicação e vigor: 23/09/2026, segundo o texto oficial; a alínea vetada não vira conteúdo normativo.

Hash novo, HTML/PDF de erro, URL parecida, query/fragmento, redirect, MIME inadequado, corpo excedido, robots proibitivo/indisponível ou mudança normativa não explicada **bloqueiam a prévia**. Mesmo alteração editorial sem efeito jurídico nos bytes exige nova reconciliação antes de ampliar o perfil. Não há aprovação por semelhança, fallback Planalto/Senado, UA falso, proxy ou API paga.

O helper de inspeção de fronteiras aceita fragmentos para regressões, mas retorna `captureVerified:false` e `publicationAllowed:false`. Ele não fornece uma captura oficial verificada. O caminho de captura completa exige URL/bytes/identidade/contagens/hash canônico; o comparador revalida seu fingerprint.

## Estado legado protegido

A leitura é limitada ao ato17/versão63 do CP, `current`, checksum `2b51ad5b28b2b59ec56166503b388ee8f284d503ec2da705800f1e1085643838`, origem Senado527942/publicacao/39870011. O fingerprint do corpus423 preserva IDs, paths, ordem, headings, literais e direitos: `185eed2a650cdea3aed1b9c61f521426ab820f2de5fc4a8cec06385ed53282a2`.

As suspensões efetivamente executadas pelo operador — auditorias **6878 e7187** — permanecem: **27 suspended e396 reviewed**. O comparador fixa os27 IDs esperados e seus estados; uma fonte63 diferente ou outra alteração de estado exige nova conferência, sem restaurar o legado. A prévia fresca402 continua **unapproved_candidate**, nunca “402 publicadas”.

O diff esperado do literal contém108 exatos,267 apenas título vizinho,23 ajustes editoriais de notas/marcadores/estrutura/título, um footer/assinatura, dois normativos155/157 e o art88 válido omitido pelo parser antigo. Os22 artigos antigos ausentes têm prova oficial de retirada; o verbo “Revogado o livramento” do88 não é etiqueta de artigo revogado. Sufixos359-M-A/B permanecem distintos; títulos internos como cartão298 ficam no corpo, enquanto os nomes dos artigos vizinhos154-B/299/352 ficam fora.

## Executar a prévia na VPS

Exige `MIGRATION_DATABASE_URL` já existente do papel **leiprova_owner**, banco **leiprova**. O programa confirma `current_user`, `current_database` e `transaction_read_only=on`; usa `BEGIN READ ONLY`, uma conexão e timeout de10s, sem DML. Não copia conexão, `.env`, segredo, enunciado ou alternativas para saída.

Depois de publicar/reconstruir a ferramenta pelo fluxo normal, na VPS Everglades:

```sh
cd /opt/leiprova
install -d -m700 .local/editorial/cp-correction-previews
docker compose --profile tools run --rm --no-deps -T \
  -v /opt/leiprova/.local/editorial/cp-correction-previews:/app/.local/editorial/cp-correction-previews \
  -e NODE_OPTIONS=--max-old-space-size=256 \
  opportunity-approver pnpm exec tsx --env-file-if-exists=.env \
  scripts/preview-camara-cp-correction.ts output=cp-20261012-primeira
```

O comando usa o ambiente existente do serviço de manutenção; o volume acima contém somente a pasta privada de saída, sem montar credenciais. Esta documentação não confirma execução dessa prévia em produção. O operador registra o digest da imagem/revisão e o recibo real ao executá-la. Não existe agendamento ou daemon desse comando no Mac ou na VPS.

`output=<nome>` permite somente letras minúsculas, números e hífen; sem caminhos arbitrários. A CLI cria `.local/editorial/cp-correction-previews/<nome>` com modo700 e arquivos600, recusa symlinks e sobrescrita. Corpos oficiais e diff completo vão somente a essa pasta; stdout fornece hashes, contagens, estados, datas, fingerprint e caminho, sem texto integral. Saída incompleta sem `receipt.json` não comprova sucesso; remover um artefato parcial cabe ao operador, sem alterar o banco.

Os arquivos são `cp-current.html`, `law-15517-original.html`, `diff.json` e `receipt.json`. Nenhum pertence a Git/Docker/Autor. A prévia mantém `databaseWrites:0`, `snapshotsPersisted:0`, `currentVersionsChanged:0`, `questionsApproved:0`, `publicationAllowed:false`, `humanReview:false`.

## Limite do rebind posterior

Cinco questões do art351 estão no ENAC. Seus bindings citam o literal antigo completo, incluindo título vizinho; trocar apenas IDs/versão não preserva a citação válida. A revisão posterior deve conferir cada questão e sua fonte, produzir citações/evidências/bindings novos e Qcert correspondentes, atualizar o mapa pertinente e provar contagem/acesso antes do corte. A fonte revisada não aprova essas questões por consequência.

A versão63 permanece atual parcialmente suspensa até uma implantação coordenada da versão completa. Não publicar CP com quatro artigos, sobrescrever literal/checksum63, editar receipts passados ou reativar os27 suspensos. A prévia não decide o corte nem salva artificialmente o piso de venda; problemas encontrados ficam bloqueados para reconciliação.
