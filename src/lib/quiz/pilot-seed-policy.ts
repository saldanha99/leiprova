export type PilotAnchorEligibility = "eligible" | "blocked_by_review" | "invalid_classification";

interface PilotAnchorInput {
  editorialStatus: string;
  subjectId: string | number | null;
  topicId: string | number | null;
}

export function classifyPilotAnchor(input: PilotAnchorInput): PilotAnchorEligibility {
  if (input.editorialStatus !== "reviewed") return "blocked_by_review";
  if (!input.subjectId || !input.topicId) return "invalid_classification";
  return "eligible";
}
