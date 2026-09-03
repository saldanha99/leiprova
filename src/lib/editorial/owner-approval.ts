import "server-only";

export function isEditorialOwnerApprover(
  userEmail: string,
  configuredEmail = process.env.EDITORIAL_OWNER_APPROVER_EMAIL,
) {
  const ownerEmail = configuredEmail?.trim().toLowerCase();
  return Boolean(ownerEmail && userEmail.trim().toLowerCase() === ownerEmail);
}

export function canReviewEditorialSubmission(
  {
    initiatorUserId,
    reviewerUserId,
    reviewerEmail,
  }: {
    initiatorUserId: number | null;
    reviewerUserId: number;
    reviewerEmail: string;
  },
  configuredEmail = process.env.EDITORIAL_OWNER_APPROVER_EMAIL,
) {
  return (
    initiatorUserId === null ||
    initiatorUserId !== reviewerUserId ||
    isEditorialOwnerApprover(reviewerEmail, configuredEmail)
  );
}
