import {
  getOfficialLegalSource,
  type OfficialLegalSource,
} from "./legal-registry";

export type OfficialLegalSourceResolution =
  | { matched: true; source: OfficialLegalSource }
  | { matched: false; reason: "unregistered_slug" | "official_url_mismatch" };

export function resolveOfficialLegalSource(slug: string, officialUrl: string): OfficialLegalSourceResolution {
  const source = getOfficialLegalSource(slug);
  if (!source) return { matched: false, reason: "unregistered_slug" };
  if (source.officialUrl !== officialUrl) return { matched: false, reason: "official_url_mismatch" };
  return { matched: true, source };
}

export function officialSourceMonitorHasHardFailures(
  laws: { failed: number },
  portals: { failed: number },
) {
  return laws.failed + portals.failed > 0;
}
