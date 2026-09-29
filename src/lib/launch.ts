import "server-only";

function enabled(name: string) {
  return process.env[name]?.trim().toLowerCase() === "true";
}

export function isRegistrationEnabled() {
  return enabled("REGISTRATION_ENABLED");
}

export function isContactEnabled() {
  return enabled("CONTACT_ENABLED");
}

export function isPrivacyRequestsEnabled() {
  return enabled("PRIVACY_REQUESTS_ENABLED");
}

export function isCommerceOpen() {
  return (
    isRegistrationEnabled() &&
    enabled("CHECKOUT_ENABLED") &&
    enabled("TRANSACTIONAL_EMAIL_ENABLED")
  );
}

/** Ofertas do Master (home, cadastro com plano, cartões e carrinho) só aparecem
 * como compráveis quando o Master também estiver aberto. */
export function isMasterCommerceOpen() {
  return isCommerceOpen() && enabled("MASTER_CHECKOUT_ENABLED");
}
