# Migração do Edital Lei Seca

Autorização do proprietário em 11/10/2026: migrar para a VPS que hospeda Everglades,
usar editaleiseca.com.br e atualizar marca, Stripe e descoberta pública. Domínio
registrado em 11/10, válido até 11/10/2027. Não cancelar a VPS de origem nem apagar
seus volumes/arquivos como consequência automática da migração.

## Corte concluído — 12/10/2026, cerca de 01h23 BRT

Registro baseado nas verificações efetivas do operador de migração. Produção agora
em **https://editaleiseca.com.br**, na VPS Everglades. A revisão publicada é
`1b5bc146` no corte, seguida de `3e9323a` (1.623 testes aprovados e 239 opcionais
pulados). Os dados
abaixo descrevem o corte, não uma homologação financeira nem a conclusão dos 84 cursos.

| Conferência | Resultado registrado |
| --- | --- |
| DNS autoritativo | `b.sec.dns.br` e `c.sec.dns.br`; A raiz `179.236.255.4` e TXT Google visíveis publicamente. |
| HTTPS canônico | Certificado válido; home HTTP 200 e `/api/health` HTTP 200. |
| Alias `www` | HTTP 301 para o domínio canônico. |
| Banco final | Restauração concluída; conferência das 68 tabelas coincidiu entre origem e destino. |
| Serviços de origem | App e workers parados; banco, pooler, volumes e arquivos preservados. |
| Serviços de destino | App serve produção; os três workers foram iniciados e a instalação dos crons terminou com código 0. |
| Ponte do Maestri | Configuração privada aponta para `everglades-vps`. |
| Domínio legado | GET `/concursos` respondeu 301 para `https://editaleiseca.com.br/concursos`. |
| Webhook legado | POST é encaminhado à aplicação nova, sem redirecionamento; um POST sem assinatura recebeu HTTP 400. |
| Everglades | Home continuou HTTP 200 após a mudança. |

A resposta 400 do webhook sem assinatura confirma o roteamento e a rejeição do
pedido não assinado. Não comprova uma transação paga nem entrega financeira completa.
A partida dos workers e a instalação dos crons não garantem autoria contínua: os
agentes continuam dependentes dos terminais, reservas, quotas e recibos de execução.

### Recibos da cópia final

- Origem: `/opt/leiprova/backups/final-migration-20261011/final.dump` e `counts.txt`
  no mesmo diretório.
- Destino: `/opt/leiprova-migration-20261011/final.dump`.
- Conferência: `/opt/leiprova-migration-20261011/source-final-counts.txt` e
  `/opt/leiprova-migration-20261011/destination-final-counts.txt`.
- SHA-256 do dump final:
  `3a39b1f6f2d2ab3eab16cbc5c401eed5243bc2cec3ea3dfcd002d3d1d32e50fd`.
- `.env`, logs, dumps e recibos continuam privados; não incorporar esses arquivos
  ao Git nem copiar credenciais para prompts ou notas.

### Stripe após o corte

O endpoint existente `we_1ULXBMBkl6797u2uZyCIYjSM` foi alterado no painel para
`https://editaleiseca.com.br/api/stripe/webhook`, identificado como Edital Lei Seca
e conferido **ativo**. Foram preservados o segredo de assinatura, os 18 eventos
e a versão API. Não foi criado endpoint duplicado. A conta e os IDs comerciais
continuam os existentes. Compra real de controle e estorno permanecem pendentes;
checkout LIVE configurado não equivale a homologação financeira concluída.

### Conteúdo e descoberta ainda pendentes

No corte havia **4 preparações disponíveis entre 84 planejadas**, com **367 questões
com vínculos válidos**: ENAM, PC-MA Delegado, TC-DF e ENAC. Os produtos e preços LIVE
cadastrados para os demais concursos não indicam que seu conteúdo esteja pronto.
Treino histórico e pré-edital precisam de programa identificado e legislação atual;
a LGPD recebeu carga real de 72 artigos na versão legal 110. A aprovação consta
na auditoria 6309 (`editorial.legal_text.approved`,
`approvalMode: owner_standing_authorization`, `humanReview: false`), com snapshot
`0f7ba2b8-797e-4939-a86f-57077eea58a5` e checksum
`2189954871b10f2cdec1609149aa12ab2cd836343407fb8c26f2b1429c0fb490`.
Esse recibo não libera automaticamente preparações sem programa e questões válidas.

### Recibos Google — 12/10/2026

- **Titularidade:** o Search Console verificou automaticamente o novo domínio por
  DNS; não permanece pendente a confirmação da propriedade nova.
- **Sitemap enviado e processado:** `https://editaleiseca.com.br/sitemap.xml`, em
  12/10. O primeiro erro “Não foi possível buscar” foi superado: o painel passou
  a informar processamento de **23 páginas e zero vídeos**. Captura privada:
  `google-sitemap-processed.png`.
- **Mudança de endereço confirmada:** propriedade de origem exata
  `https://leiprova.2b.app.br/` → `sc-domain:editaleiseca.com.br`. As verificações de
  redirecionamento 301 e titularidade passaram. O painel confirmou **“Este site está
  sendo movido”**, com data de início em 12/10/2026.
- **Capturas privadas:** `google-change-address-confirmed.png` e
  `google-sitemap-submitted.png`; manter fora do Git.

A auditoria pública após o corte confirmou **23 URLs HTTP 200 e indexáveis**, sem
problemas críticos, avisos, JSON-LD inválido ou URLs repetidas. A home apresentou
1.488 palavras ao agente padrão, Googlebot e OAI-SearchBot, sem diferença de volume.
A auditoria antiga de 24 URLs e a cópia de ensaio continuam como histórico.

A solicitação de mudança foi aceita e o sitemap foi processado. **Indexação das
páginas, ranking e citações por IA não estão confirmados**; o processamento é um
recibo de descoberta, não uma garantia de resultado.

IndexNow está preparado por operador com preview como padrão, somente para URLs
públicas do sitemap no domínio novo; arquivo de titularidade precisa ser publicado
e conferido antes de `--apply`. **Ainda não houve notificação IndexNow.** Ver
[operador e limites](INDEXNOW-DESCOBERTA-2026-10-12.md).


## Origem e destino

| Recurso | Origem | Destino |
| --- | --- | --- |
| SSH | wisewolf-vps | everglades-vps |
| IP | 187.127.46.251 | 179.236.255.4 |
| Projeto | /opt/leiprova | /opt/leiprova |
| Entrada | Traefik, rede forza | Caddy existente, rede própria leiprova_edge |
| Domínio | leiprova.2b.app.br | editaleiseca.com.br |

Banco, volume, contêineres, cookies técnicos, contas e IDs Stripe continuam
leiprova. Everglades mantém seus serviços e banco próprios. Banco novo só participa
da rede interna leiprova_internal; app participa também de leiprova_edge. O Caddy
participa da rede de entrada, sem conceder acesso ao banco. Proxy/compose Everglades
foram preservados em backup; a alteração persiste somente a rede adicional do proxy
e os blocos de host deste projeto. Saúde externa Everglades permaneceu 200.

## Evidências antes da virada

- VPS destino: 16 GB RAM, cerca de 131 GB livres antes da implantação.
- Backup inicial: /opt/leiprova/backups/before-vps-migration-20261011.dump.
- SHA-256 no destino e origem: e584ea797d072ec16e9d07974d98aadb0ad50a62f43db5eaebc7874530bd44a7.
- Restauração inicial confirmou 9.557 artigos, 636 questões, 84 produtos e 2 usuários.
  Essa cópia é de ensaio; a fábrica continuou na origem. Não usar esses números como
  conferência da cópia final.
- Migrações 0048/0049 aplicadas no destino sem seed; app responde saúde ok.
- HTML privado contém marca nova, canonical novo, imagem social nova. Robots,
  sitemap e llms.txt usam a origem nova. Nenhuma porta do app/banco foi publicada.
- .env foi transmitido diretamente entre VPS pelo canal SSH, sem arquivo de
  produção no Mac; permanece 0600. Credenciais existentes preservadas.
- Código f789d9b: lint, typecheck e 1.596 testes passaram (239 opcionais sem ambiente
  ficaram pulados); build na VPS passou. Builds não foram executados no Mac.
- Registro.br confirmou os registros A raiz para 179.236.255.4 e CNAME www para
  editaleiseca.com.br às 22h42 BRT. O editor ficou inicialmente em transição;
  a delegação externa/modo básico tem contador separado. Registros salvos não
  comprovam propagação nem certificado; validar DNS autoritativo e HTTPS.
- Após novo login às 23h24 BRT, o editor confirmou ambos os registros salvos;
  a consulta pública ainda retornou NODATA. O endpoint Stripe segue na origem.
- A conferência independente da nova marca no catálogo LIVE passou: 84 produtos
  individuais e Master, 170 preços do projeto, quatro preços legados preservados.

## Procedimento executado no corte (referência para futuras migrações)

1. Confirmar resolução A/CNAME e TLS válido para os hosts novos; domínio novo pode
   continuar em manutenção enquanto o site de origem opera normalmente.
2. Recolher respostas de agentes por settle, verificar leases em andamento e
   aguardar a linha de liberação terminar. Preservar dados/tokens de reservas.
3. Guardar crons leiprova da origem e parar somente app e workers deste projeto.
   Banco e pooler permanecem acessíveis para cópia. Não parar Everglades ou outros sites.
4. Produzir dump final consistente, registrar SHA-256 e contagens. Transmitir,
   verificar e restaurar no banco de ensaio do destino, com app/workers destino
   parados; nunca restaurar por cima de uma instância que já recebe clientes.
5. Reaplicar migrations e privilégios existentes, sem seed. Verificar contagens,
   saúde, curso, autenticação, condições comerciais e modo LIVE.
6. Trocar o bloco novo do Caddy de manutenção para reverse_proxy leiprova-app:3000,
   validar/recarregar; conferir rotas públicas, recursos, robots e sitemap por HTTPS.
7. Alterar somente o endpoint Stripe we_1ULXBMBkl6797u2uZyCIYjSM para
   https://editaleiseca.com.br/api/stripe/webhook, preservando segredo e 18 eventos.
   A conta é acct_1TCQvlBkl6797u2u; outros endpoints permanecem fora do escopo.
8. Reconciliar apresentação do catálogo Stripe com o domínio novo, preservando
   produtos/preços/assinaturas. Verificação independente deve passar.
9. Instalar proxy legado com deploy/Caddyfile.legacy-domain na rede forza da
   origem, atrás do Traefik: páginas vão direto à URL equivalente nova; webhook
   legado é encaminhado à aplicação nova, mantendo assinatura e idempotência.
10. Habilitar workers e crons somente no destino. Configurar a ponte do Mac em
    .local/maestri/remote-target.json com {"sshHost":"everglades-vps"}; confirmar
    status e protocolo. A ponte permite só os dois aliases autorizados.
11. Repetir auditoria pública, conferir link/PDF de cada produto liberado, registrar
    recebimento de notificações por indexadores quando executadas e relatar limites.
    Não chamar disponibilidade técnica de cobrança financeira homologada.

## Retorno após o corte

O destino já serve produção e seus workers foram iniciados. **Não iniciar a cópia
antiga como se ainda fosse o banco atual.** Para retornar, primeiro parar as
gravações no destino, guardar um checkpoint novo e transportar os dados atuais
de volta antes de reativar app e workers na origem. Reverter DNS, Caddy e endpoint
Stripe somente em uma sequência coordenada, após conferir a instância restaurada.
Evitar dois bancos com gravação em paralelo e preservar eventos Stripe pendentes.

As cópias, logs, envs e recibos são privados em `/opt/leiprova-migration-20261011`
e `.local/migration-20261011`. As evidências de ensaio acima e os registros
históricos abaixo do topo de OPERACAO.md não substituem o recibo do corte.
Atualizar este documento somente com verificações efetivas.
