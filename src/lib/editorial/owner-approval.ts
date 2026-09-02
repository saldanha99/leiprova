import "server-only";

export function isEditorialOwnerApprover(
  userEmail: string,
  configuredEmail = process.env.EDITORIAL_OWNER_APPROVER_EMAIL,
) {
  const ownerEmail = configuredEmail?.trim().toLowerCase();
  return Boolean(ownerEmail && userEmail.trim().toLowerCase() === ownerEmail);
}
