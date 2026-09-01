import { describe, expect, it } from "vitest";

import { classifyPilotAnchor } from "@/lib/quiz/pilot-seed-policy";

describe("classifyPilotAnchor", () => {
  it.each(["draft", "pending_review", "suspended"] as const)(
    "bloqueia artigo %s sem interromper o seed",
    (editorialStatus) => {
      expect(
        classifyPilotAnchor({
          editorialStatus,
          subjectId: "subject-id",
          topicId: "topic-id",
        }),
      ).toBe("blocked_by_review");
    },
  );

  it("libera somente âncora revisada e classificada", () => {
    expect(
      classifyPilotAnchor({
        editorialStatus: "reviewed",
        subjectId: "subject-id",
        topicId: "topic-id",
      }),
    ).toBe("eligible");
  });

  it("mantém erro para classificação incompleta depois da revisão", () => {
    expect(
      classifyPilotAnchor({
        editorialStatus: "reviewed",
        subjectId: "subject-id",
        topicId: null,
      }),
    ).toBe("invalid_classification");
  });
});
