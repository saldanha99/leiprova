const ESCAPE_LOOKUP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#039;",
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ESCAPE_LOOKUP[character] ?? character);
}

export function buildAccountAccessEmail({
  name,
  accessUrl,
  purchase,
}: {
  name: string;
  accessUrl: string;
  purchase: boolean;
}) {
  const firstName = name.trim().split(/\s+/)[0] || "estudante";
  const safeName = escapeHtml(firstName);
  const safeUrl = escapeHtml(accessUrl);
  const intro = purchase
    ? "Seu pagamento foi confirmado e o acesso ao LeiProva já está liberado."
    : "Recebemos um pedido para criar ou atualizar a senha da sua conta LeiProva.";
  const subject = purchase ? "Seu acesso ao LeiProva está liberado" : "Crie uma nova senha no LeiProva";

  return {
    subject,
    text: [
      `Olá, ${firstName}!`,
      "",
      intro,
      "",
      "Use o link abaixo para criar sua senha e entrar no portal:",
      accessUrl,
      "",
      "Este link é pessoal, funciona uma única vez e expira em 24 horas.",
      "Se você não reconhece esta solicitação, ignore este e-mail.",
    ].join("\n"),
    html: `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;background:#050b12;color:#e8eef7;font-family:Arial,sans-serif">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#050b12;padding:32px 16px">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;border:1px solid #1c2b3d;border-radius:22px;background:#0a1420;overflow:hidden">
          <tr><td style="padding:30px 32px 12px;color:#fbbf24;font-size:13px;font-weight:700;letter-spacing:.12em;text-transform:uppercase">LeiProva</td></tr>
          <tr><td style="padding:8px 32px 30px">
            <h1 style="margin:0 0 14px;color:#ffffff;font-size:28px;line-height:1.2">Olá, ${safeName}!</h1>
            <p style="margin:0;color:#a9b6c8;font-size:16px;line-height:1.65">${escapeHtml(intro)}</p>
            <p style="margin:26px 0">
              <a href="${safeUrl}" style="display:inline-block;border-radius:12px;background:#fbbf24;color:#07111d;padding:14px 22px;font-size:15px;font-weight:700;text-decoration:none">Criar minha senha</a>
            </p>
            <p style="margin:0;color:#7f8ea3;font-size:13px;line-height:1.65">O link é pessoal, funciona uma única vez e expira em 24 horas.</p>
          </td></tr>
          <tr><td style="border-top:1px solid #1c2b3d;padding:20px 32px;color:#65758a;font-size:12px;line-height:1.6">Se você não reconhece esta solicitação, ignore este e-mail. Nenhuma senha será alterada.</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`,
  };
}
