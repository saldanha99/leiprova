# Conferência da conta e preflight do lote de 160 questões

Verificação em 05/09/2026. Escopo: somente LeiProva. As consultas à VPS foram executadas em transações `READ ONLY`, com limite de tempo e sem leitura de credenciais, sessões ou dados de outros usuários/projetos.

## Confirmação humana recebida

O usuário confirmou expressamente que conferiu as 160 questões e suas fontes e indicou a conta revisora. A consulta encontrou exatamente essa conta com papel `editor`; `requireAdmin` aceita esse papel para a área editorial. Não houve criação de conta, elevação de papel ou uso de sessão autenticada.

A declaração e a identidade estão registradas **somente localmente** em `.local/editorial/review-confirmation-cf-2026-09-05.json`, excluído do Git e do contexto Docker. Não inserir esse registro privado no repositório público, ZIP ou prompts externos.

O registro está vinculado ao manifesto SHA-256 `bb5edf04048d8130617ca7e1f595ec0d9d31a4d9e270b7082ae3b047f035647a`. Os hashes dos 14 arquivos relacionados no manifesto foram novamente conferidos e coincidem. Nenhum JSON, caderno ou parecer do pacote original foi alterado.

A confirmação resolve a pendência humana expressa na conversa; **não significa que os itens já foram importados, aprovados no banco ou publicados**. Também não fabrica uma declaração adicional de responsabilidade/autoria limpa.

## Estado observado na VPS

| Verificação | Resultado |
|---|---|
| Repositório em `/opt/leiprova` | `main`, árvore limpa, commit `ec608475e8f9ce3e592ca69d4f82fbfcde00b2ec` |
| Local/GitHub após fetch | HEAD e origin/main no mesmo commit, 0 à frente / 0 atrás; branch de trabalho local com alterações preservadas |
| Última migration registrada | `0026_little_forge`; id 27 na tabela de histórico, timestamp `1788462702535` |
| Fila durável e função de lock editorial | Ausentes; migrations 0027–0030 ainda não aplicadas |
| Questões existentes | 72 `reviewed` e 12 `pending_review`; estes totais não são o novo lote de 160 |
| Recibos do novo importador para este lote | 0 |
| Versão Planalto da Constituição | id 1, `superseded`, 12 artigos |
| Versão vigente da Constituição | id 65, compilação do Senado, 273 artigos |
| Artigo 5º vigente | id 5834, `reviewed`, referência `Art. 5º`, texto integral de 13.450 caracteres |
| Referências exatas do lote no cadastro | 0 de 40; o lote aponta incisos separados, como `Art. 5º, I` |

A versão vigente usa [a compilação do Senado](https://legis.senado.leg.br/norma/579494/publicacao/16434817), checksum `d53ca8e9a37bb0501c486f2f7c66a640db89d603e41e347d0ff481f6a3b3f001`. O pacote foi capturado do [Planalto](https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm).

Isso identifica **diferença de representação e procedência**, não comprova divergência jurídica nem equivalência textual. Não foi realizada comparação completa Senado × Planalto nesta etapa.

## Próxima etapa necessária

1. Implementar e testar uma estratégia explícita de vínculo entre cada inciso revisado e o artigo/versão vigente, preservando URL, checksum e citação completa de ambas as fontes. Não trocar a versão vigente nem recriar artigos aprovados para contornar o importador.
2. Homologar a importação com esses vínculos em ambiente dedicado. A CLI atual continua limitada aos dois bancos locais permitidos; esta conferência não introduz acesso de escrita a produção.
3. Preparar a operação remota com autorização própria, revisão do diff, backup, migrations e privilégios mínimos. Nenhum deploy deve sair diretamente da árvore suja.
4. Executar o fluxo editorial legítimo, registrando responsabilidade, revisão já confirmada e impressões dos dossiês correspondentes. Não promover os 12 pendentes antigos nem qualquer outro lote.
5. Verificar elegibilidade no catálogo e o treino do aluno após a liberação; não abrir canais comerciais nem fornecedores pagos.

O pacote original continua como retrato imutável da autoria. Sua indicação histórica de revisão pendente deve ser lida junto deste registro posterior, não editada para simular uma aprovação no banco.

Nenhum dado de produção foi modificado; nenhum commit, push, deploy, API paga ou worker 24h foi acionado.

## Verificação desta continuação

Lint, tipos, 407 testes em 58 arquivos (incluindo os 31 PostgreSQL opt-in) e build passaram novamente. O validador offline confirmou 160 questões, 40 fontes, sem erros ou alertas mecânicos. O banco sintético exclusivo foi iniciado apenas para esses testes e encerrado ao final; nenhum teste usou o banco do produto.

O registro privado foi validado contra os hashes do manifesto, está ignorado pelo Git e excluído do contexto Docker, com diretório `700` e arquivo `600`. `git diff --check` passou. Nesta etapa, apenas documentação, exclusões de arquivos privados e o recibo local foram alterados; a aplicação e o pacote revisado não foram reescritos.
