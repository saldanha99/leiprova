import { randomBytes } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import { persistentQaAccountsSchema } from "./lib/qa-safety";

// Somente gera artefatos privados. Não conecta banco, DNS, Stripe ou servidor.
const directory = resolve(
  import.meta.dirname,
  "../.local/commerce/qa-persistente",
);
mkdirSync(directory, { recursive: true, mode: 0o700 });
chmodSync(directory, 0o700);
const accountsPath = resolve(directory, "accounts.json");
if (!existsSync(accountsPath)) {
  const definitions = [
    {
      email: "qa-admin@example.invalid",
      role: "admin",
      name: "QA — Administrador de homologação",
      access: "admin",
    },
    {
      email: "qa-master@example.invalid",
      role: "student",
      name: "QA — Cliente Master sem cobrança",
      access: "master",
    },
    {
      email: "qa-avulso@example.invalid",
      role: "student",
      name: "QA — Cliente de um curso sem cobrança",
      access: "contest",
    },
  ];
  writeFileSync(
    accountsPath,
    JSON.stringify(
      {
        environment: "synthetic-persistent-only",
        accounts: definitions.map((account) => ({
          ...account,
          password: randomBytes(24).toString("base64url"),
        })),
      },
      null,
      2,
    ),
    { mode: 0o600, flag: "wx" },
  );
}
const data = persistentQaAccountsSchema.parse(
  JSON.parse(readFileSync(accountsPath, "utf8")),
);
chmodSync(accountsPath, 0o600);
const envPath = resolve(directory, ".env");
if (!existsSync(envPath)) {
  writeFileSync(
    envPath,
    [
      `LEIPROVA_QA_OWNER_PASSWORD=${randomBytes(32).toString("hex")}`,
      `LEIPROVA_QA_APP_PASSWORD=${randomBytes(32).toString("hex")}`,
      `LEIPROVA_QA_IP_HASH_SECRET=${randomBytes(32).toString("hex")}`,
      "LEIPROVA_QA_APP_IMAGE=CONFIGURAR_ID_IMUTAVEL",
      "LEIPROVA_QA_TOOLS_IMAGE=CONFIGURAR_ID_IMUTAVEL",
      "",
    ].join("\n"),
    { mode: 0o600, flag: "wx" },
  );
}
chmodSync(envPath, 0o600);
const guide = [
  "# Acessos privados — homologação persistente LeiProva",
  "",
  "Destino previsto: https://homolog.leiprova.2b.app.br/entrar",
  "**Não disponível até a publicação da homologação e validação do HTTPS.**",
  "As contas não existem em leiprova.2b.app.br. Não são cobranças nem assinaturas Stripe.",
  "",
  ...data.accounts.flatMap((account) => [
    `## ${account.name}`,
    "",
    `E-mail: ${account.email}`,
    `Senha: ${account.password}`,
    "",
  ]),
  "Master: todo o conteúdo sintético. Individual: somente curso QA Alfa; QA Beta deve ser bloqueado.",
  "Permissões de teste vigentes por 30 dias após o bootstrap. Reexecutar renova as permissões sem trocar senhas.",
  "Administrador: /admin. Clientes: /app. Não informe cartão nem use dados de clientes reais.",
  "",
  "## Pendência DNS",
  "Criar A homolog.leiprova.2b.app.br → 187.127.46.251, TTL 300. Se houver registro AAAA, apontar somente para IPv6 válido deste servidor ou removê-lo.",
  "Os rótulos exclusivos leiprova-qa pedem certificado ao resolver le já existente. Não alteram as rotas dos outros projetos.",
  "",
];
writeFileSync(resolve(directory, "ACESSOS-HOMOLOGACAO.md"), guide.join("\n"), {
  mode: 0o600,
});
chmodSync(resolve(directory, "ACESSOS-HOMOLOGACAO.md"), 0o600);
console.log(
  `Artefatos privados preparados em ${directory}. Nenhum acesso remoto ativado; senhas não exibidas.`,
);
