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

export function isCommerceOpen() {
  return isRegistrationEnabled() && enabled("CHECKOUT_ENABLED");
}
