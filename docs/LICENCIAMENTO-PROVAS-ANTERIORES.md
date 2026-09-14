# Licenciamento de provas anteriores

Atualizado em 13/09/2026. Este documento transforma a pesquisa de provas
anteriores em um processo comercial auditável para a Editalume. Ele não é uma
licença e não autoriza a reprodução de nenhum caderno, gabarito ou questão.

## Decisão do responsável e limite do registro

O responsável declarou em 13/09/2026 que revisou o material e deseja liberar os
produtos. A declaração é aceita como manifestação comercial e como primeira
revisão humana, mas não pode ser convertida automaticamente em aprovação de cada
documento porque:

- os 75 produtos ainda não estão vinculados a oportunidades oficiais exatas;
- cada caderno, tipo e gabarito precisa ser identificado sem ambiguidade;
- a aplicação exige uma segunda revisão por usuário administrativo diferente;
- ainda não existe autorização escrita dos titulares para reprodução comercial;
- o cadastro fiscal/empresarial e o modo ao vivo da Stripe continuam incompletos.

Não registrar uma segunda pessoa fictícia, não presumir licença e não usar a
declaração geral para marcar os 75 produtos como publicados.

## Primeiro lote verificável

O inventário estruturado do piloto está em
`docs/research/provas-anteriores-piloto-2026-09-13.json`. Os dois pares abaixo
foram conferidos no portal oficial da FGV e podem ser cadastrados imediatamente
como **metadados e links externos pendentes**, sem copiar o conteúdo:

| Produto de destino | Prova anterior exata | Caderno | Gabarito | Estado de direitos |
| --- | --- | --- | --- | --- |
| ENAC 2026.2 | ENAC 2026.1, 3º exame, Tipo 1, 14/06/2026 | 36 páginas, 100 questões | definitivo, 15/07/2026 | autorização escrita pendente |
| ENAM 2026.2 | ENAM 2026.1, 5º exame, Tipo 1, 07/06/2026 | 32 páginas, 80 questões | definitivo, 21/07/2026 | autorização escrita pendente |

O fato de a organizadora disponibilizar o PDF publicamente permite apontar o
link oficial. Isso, isoladamente, não comprova licença para copiar as questões
para o banco pago, redistribuir os PDFs ou criar uma versão hospedada pela
Editalume.

## Pedido de autorização

Enviar uma solicitação por titular/organizadora. O primeiro contato da FGV
Conhecimento é `demanda.conhecimento@fgv.br`; os canais específicos publicados
para os exames são `enac@fgv.br` e `examemagistratura@fgv.br`. Para as demais
organizadoras, usar somente os canais oficiais registrados na matriz de fontes.

### Assunto

`Pedido de autorização comercial — provas anteriores na plataforma Editalume`

### Texto-base

> À equipe responsável,
>
> A Editalume é uma plataforma educacional de preparação para concursos. Pedimos
> autorização expressa, não exclusiva e documentada para utilizar as provas e os
> gabaritos oficiais listados no anexo, inclusive os enunciados, alternativas,
> imagens e respostas, em produto digital pago.
>
> O uso pretendido inclui: (1) reprodução integral ou parcial dentro de banco de
> questões autenticado; (2) exibição do PDF ao assinante, por link oficial ou por
> cópia hospedada, conforme autorizado; (3) indexação por concurso, cargo,
> disciplina, assunto e dispositivo legal; (4) comentários e estatísticas
> produzidos pela Editalume; e (5) disponibilidade em território brasileiro pelo
> prazo autorizado.
>
> Solicitamos que a resposta identifique: titular dos direitos; documentos e
> edições abrangidos; modalidades permitidas; necessidade de atribuição e texto
> de crédito; possibilidade ou vedação de armazenamento do PDF; prazo,
> território, preço e condições de revogação; permissão para atualizações e
> questões anuladas; e contato responsável por notificações.
>
> A Editalume manterá rastreabilidade por edição, versão do caderno, gabarito,
> fonte oficial, data de obtenção e hash do documento. Nenhum conteúdo será
> publicado como licenciado antes da formalização.
>
> Atenciosamente,
> Responsável legal da Editalume

Anexar a relação exata de URLs do lote, nunca uma descrição genérica como
“todas as provas”. Guardar a resposta integral e seus anexos fora do Git. No
painel, registrar somente a referência HTTPS da evidência, o hash SHA-256, a
data, o titular e o fundamento aprovado.

### Pedidos enviados em 13/09/2026

| Exame | Destinatários | Assunto | Situação |
| --- | --- | --- | --- |
| ENAC 2026.1 | `enac@fgv.br`, `demanda.conhecimento@fgv.br` | `Pedido de autorização comercial — ENAC 2026.1 — Editalume` | enviado; aguardando resposta escrita |
| ENAM 2026.1 | `examemagistratura@fgv.br`, `demanda.conhecimento@fgv.br` | `Pedido de autorização comercial — ENAM 2026.1 — Editalume` | enviado; aguardando resposta escrita |

Os pedidos identificam os PDFs oficiais, o uso comercial pretendido e os
limites que precisam constar da autorização. O registro de envio não altera o
estado de direitos: os arquivos continuam somente como metadados e links
externos até a chegada e validação da resposta escrita.

## Canais oficiais para a primeira rodada

| Organizadora | Canal público | Uso do canal |
| --- | --- | --- |
| FGV Conhecimento | `demanda.conhecimento@fgv.br` e telefone +55 (21) 3799-6066 | proposta/licença; copiar o canal específico do exame |
| Cebraspe | formulário “Clientes/Como contratar”, `sac@cebraspe.org.br` e telefone (61) 3448-0100 | solicitar encaminhamento ao jurídico/comercial |
| Fundação Vunesp | `comercial@vunesp.com.br`, `planejamento@vunesp.com.br`, formulário “Fale Conosco” e telefone (11) 3670-5300 | proposta/licença; pedir confirmação do titular de cada caderno |
| Fundação Carlos Chagas | `contratar@fcc.org.br`, formulário oficial e telefone (11) 3723-3000 | proposta/licença; pedir encaminhamento ao jurídico quando necessário |

### Próxima rodada, ainda não enviada

Também é necessário pedir autorização à Vunesp, ao Cebraspe e à FCC. A resposta
da FGV não alcança outra organizadora, e uma autorização de banca pode não
alcançar material cujo contrato atribuiu direitos ao órgão contratante. A ordem
da próxima rodada é:

1. fechar a matriz produto atual → última prova exata → caderno → gabarito;
2. separar os documentos por organizadora e por eventual órgão titular;
3. anexar URLs oficiais exatas e modalidades de uso pretendidas;
4. enviar um pedido auditável a cada titular, sem pedir “todas as provas” de
   forma genérica;
5. quando a titularidade estiver dividida ou incerta, obter confirmação escrita
   também do órgão contratante.

Nenhuma mensagem dessa rodada foi enviada apenas com base em uma lista de
cargos: faltaria identificar os documentos que a autorização deve cobrir.

O envio de e-mail ou formulário é comunicação externa em nome da empresa e deve
ser feito pelo responsável ou confirmado imediatamente antes do envio. Este
arquivo é apenas o pacote pronto para envio.

## Evidências mínimas por documento

Um documento somente muda de `metadata_only` para `licensed` quando houver:

1. edição, cargo, data, tipo e organizadora exatos;
2. URL oficial do caderno e URL oficial do gabarito definitivo;
3. titular e fundamento de uso identificados;
4. autorização escrita cujo escopo cubra o produto pago e a modalidade usada;
5. referência HTTPS da evidência e hash SHA-256 do arquivo autorizado;
6. validade territorial e temporal da autorização;
7. revisão do proponente e revisão independente de outro administrador;
8. tratamento explícito de anulações, retificações e versões do gabarito.

Links públicos sem autorização permanecem externos e gratuitos. Não importar o
texto das questões, não hospedar cópias e não incluí-los como benefício pago.

## Ordem de liberação comercial

1. Resolver a identidade dos 75 produtos e vincular cada um à oportunidade
   oficial correta. Produtos agregados devem ser divididos por cargo quando o
   edital tiver programas distintos.
2. Priorizar ENAM e ENAC como lote piloto, obter a autorização escrita e
   registrar os dois pares caderno/gabarito.
3. Importar o conteúdo autorizado como pendente, revisar o lote com duas contas
   humanas distintas e publicar apenas as questões aprovadas.
4. Associar a prova anterior ao produto atual correspondente, sem apresentar o
   exame passado como edital aberto.
5. Repetir por organizadora e concurso. Um contrato não se estende a outra banca
   ou edição sem cláusula expressa.
6. Depois de pelo menos um produto integralmente entregável, concluir os dados
   empresariais da Stripe, trocar credenciais para modo ao vivo, executar compra
   e reembolso reais controlados e só então abrir o checkout daquele produto.

O checkout Master deve ser o último a abrir: ele promete acesso transversal e
não pode ser sustentado por um único piloto.

## Critério objetivo de saída do zero

O primeiro produto sai de zero somente quando todos estes números forem maiores
que zero para a mesma identidade de concurso/cargo/edição:

- 1 oportunidade oficial publicada e ligada ao produto;
- 1 edição histórica identificada;
- 1 caderno e 1 gabarito definitivo com autorização escrita válida;
- lote importado, duas revisões humanas e questões aprovadas;
- entrega autenticada testada;
- produto publicado e checkout ao vivo validado.

Até isso acontecer, manter os contadores comerciais como zero é informação
correta, não falha técnica.
