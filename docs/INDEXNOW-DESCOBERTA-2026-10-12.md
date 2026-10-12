# Descoberta IndexNow — preparação em 12/10/2026

Após a migração, as URLs canônicas mudaram para `editaleiseca.com.br`. IndexNow
permite notificar mecanismos participantes sobre essas alterações, com um único
lote. É um protocolo gratuito; não requer conta nova, OAuth ou API paga.
O recebimento da notificação não garante indexação, ranking ou citações por IA.
[Referência oficial do Bing](https://www.bing.com/indexnow).

## Operador delimitado

`node scripts/indexnow-discovery.mjs` é **preview**: lê o sitemap público e mostra
o lote proposto, sem notificar nenhum mecanismo. Não aceita domínio, endpoint ou
URLs fornecidos pela linha de comando; o host é somente `editaleiseca.com.br`.

A chave de titularidade pública é `3f3de0bfb7e56de32de024a433b94f08`. O arquivo
`public/3f3de0bfb7e56de32de024a433b94f08.txt` contém somente a chave e precisa ser
publicado na raiz desse mesmo host. Esse arquivo é uma prova pública de domínio,
não uma chave privada de acesso à infraestrutura ou aos dados de clientes.
[Formato e verificação do protocolo](https://www.indexnow.org/documentation).

Depois do deploy e da conferência, o operador responsável pode executar:

```bash
node scripts/indexnow-discovery.mjs
node scripts/indexnow-discovery.mjs --apply
```

`--apply` exige primeiro HTTP 200, texto simples e conteúdo correto da prova de
titularidade. Também confere cada URL do sitemap: host exato, caminho público
permitido, HTTP 200, HTML, H1, canonical próprio único e ausência de `noindex`.
Domínios estrangeiros, `www`, privados, queries, fragmentos, duplicatas e redirects
são recusados. São aceitos no máximo 256 URLs; respostas são limitadas a 2 MiB,
requisições a dez segundos e páginas são conferidas sequencialmente.

Só após todas as conferências envia um POST para `https://api.indexnow.org/indexnow`.
Não há retry, cron, disparo após deploy ou automação periódica. O endpoint global
compartilha a notificação entre participantes; não é necessário repetir o lote em
cada mecanismo. HTTP 200 significa recebimento aceito; 202 significa recebimento
com validação de chave pendente. Nenhum dos dois prova indexação.
[Endpoint, compartilhamento e resultados](https://www.indexnow.org/faq).

## Recibos

- Preview real em `.local/migration-20261011/indexnow-preview.json` (privado).
- Testes com rede simulada verificam ausência de POST no preview, escopo de host,
  bloqueio de privados, prova inválida, `noindex`, canonical divergente, recebimento
  200/202 e ausência de retry em 429.
- **Nenhum envio IndexNow executado nesta preparação.** Arquivo de titularidade
  ainda precisa estar no deploy e ser conferido publicamente pelo operador.

Guardar o JSON do envio e o status HTTP em recibo privado quando executado. Depois
medir indexação e tráfego separadamente. Notificar mudanças substanciais, sem repetir
lotes sem alteração; sitemap permanece a lista principal de páginas canônicas.
