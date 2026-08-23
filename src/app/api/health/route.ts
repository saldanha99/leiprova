import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb, isDatabaseConfigured } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ status: "degraded", database: "not_configured" }, { status: 503 });
  }

  try {
    await getDb().execute(sql`select 1`);
    return NextResponse.json({ status: "ok" });
  } catch {
    return NextResponse.json({ status: "unavailable" }, { status: 503 });
  }
}
