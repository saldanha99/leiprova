# Migração do Edital Lei Seca

Autorização do proprietário em 11/10/2026: migrar para a VPS que hospeda Everglades,
usar editaleiseca.com.br e atualizar marca, Stripe e descoberta pública. Domínio
registrado em 11/10, válido até 11/10/2027. Não cancelar a VPS de origem nem apagar
seus volumes/arquivos como consequência automática da migração.

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

## Corte controlado

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

## Retorno

Antes de novas gravações no destino, falha de validação permite manter Caddy novo
em manutenção, restaurar crons/serviços da origem e conservar o site legado ativo.
Após o destino receber clientes/pagamentos, não iniciar a cópia antiga: primeiro
parar gravações, tirar novo checkpoint e transportar os dados atuais de volta.
Evitar dois bancos com gravação em paralelo e preservar eventos Stripe pendentes.

As cópias, logs, envs e recibos são privados em /opt/leiprova-migration-20261011 e
.local/migration-20261011. Os registros históricos abaixo do topo de OPERACAO.md
não comprovam estado atual do domínio novo. Atualizar este roteiro somente com
recibos efetivos, sem marcar passos tentados como concluídos.
