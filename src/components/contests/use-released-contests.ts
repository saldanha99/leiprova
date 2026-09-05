"use client";
import { useEffect, useState } from "react";

// Falha fechado: o cliente nunca decide se uma compra pode ser realizada.
export function useReleasedContests(enabled = true) {
  const [slugs, setSlugs] = useState<string[]>([]);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    void fetch("/api/contests/catalog", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return;
        const data: unknown = await response.json();
        if (
          typeof data === "object" &&
          data !== null &&
          "releasedSlugs" in data &&
          Array.isArray(data.releasedSlugs) &&
          data.releasedSlugs.every((item) => typeof item === "string")
        )
          setSlugs(data.releasedSlugs);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [enabled]);
  return slugs;
}
