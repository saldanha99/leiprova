type StripeModeEnvironment = {
  STRIPE_PAYMENTS_MODE?: string;
  NODE_ENV?: string;
  APP_URL?: string;
  NEXT_PUBLIC_APP_URL?: string;
};

export function expectedStripeMode(
  environment: StripeModeEnvironment,
): "test" | "live" | null {
  const mode =
    environment.STRIPE_PAYMENTS_MODE?.trim() ||
    (environment.NODE_ENV === "production" ? "live" : "test");
  if (mode !== "test" && mode !== "live") return null;
  // O domínio público nunca aceita compra de teste, mesmo por configuração acidental.
  for (const address of [
    environment.APP_URL,
    environment.NEXT_PUBLIC_APP_URL,
  ]) {
    if (!address) continue;
    try {
      if (new URL(address).hostname === "leiprova.2b.app.br" && mode !== "live")
        return null;
    } catch {
      return null;
    }
  }
  return mode;
}

export function stripeCredentialsMatchMode(
  environment: StripeModeEnvironment,
  secretKey: string,
  publishableKey?: string,
) {
  const mode = expectedStripeMode(environment);
  return Boolean(
    mode &&
      new RegExp(`^(sk|rk)_${mode}_`).test(secretKey) &&
      (publishableKey === undefined ||
        publishableKey.startsWith(`pk_${mode}_`)),
  );
}

export function validateStripeSyncTarget(input: {
  mode: string;
  secretKey: string;
  environment?: string;
  databaseUrl?: string;
  expectedAccount?: string;
  appUrl?: string;
}) {
  if (input.mode !== "test" && input.mode !== "live")
    throw new Error("Modo Stripe inválido.");
  if (!new RegExp(`^(sk|rk)_${input.mode}_`).test(input.secretKey))
    throw new Error("A chave não corresponde ao modo Stripe solicitado.");
  if (!input.databaseUrl)
    throw new Error("Banco de destino deve ser declarado explicitamente.");
  let target: URL;
  try {
    target = new URL(input.databaseUrl);
  } catch {
    throw new Error("Endereço do banco inválido.");
  }
  if (!["postgres:", "postgresql:"].includes(target.protocol))
    throw new Error("Destino não é PostgreSQL.");
  if (
    input.mode === "test" &&
    (input.environment !== "staging" ||
      !/_(test|staging)$/.test(target.pathname))
  )
    throw new Error(
      "Modo teste exige ambiente staging e banco com sufixo _test ou _staging.",
    );
  if (
    input.mode === "live" &&
    (input.environment !== "production" ||
      input.appUrl !== "https://leiprova.2b.app.br" ||
      target.pathname !== "/leiprova" ||
      !input.expectedAccount ||
      !/^acct_[A-Za-z0-9]+$/.test(input.expectedAccount))
  )
    throw new Error(
      "Produção exige ambiente, domínio, banco LeiProva e conta Stripe esperada explícitos.",
    );
  return {
    mode: input.mode,
    databaseUrl: input.databaseUrl,
    expectedAccount: input.expectedAccount,
  };
}
