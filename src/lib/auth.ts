import "server-only";

import { hash, verify } from "@node-rs/argon2";
import { and, eq, gt } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, createHmac, randomBytes } from "node:crypto";

import { getDb } from "@/lib/db/client";
import { authSessions, users } from "@/lib/db/schema";
import { safeRedirectPath } from "@/lib/utils";

const SESSION_COOKIE = process.env.AUTH_COOKIE_NAME ?? "leiprova_session";
const SESSION_DAYS = Math.max(1, Number(process.env.AUTH_SESSION_DAYS ?? 30));

export type AuthUser = Pick<
  typeof users.$inferSelect,
  "id" | "publicId" | "email" | "name" | "role" | "avatarUrl" | "stripeCustomerId"
>;

function digestToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function hashIp(ip: string | null) {
  if (!ip) return null;
  const secret = process.env.IP_HASH_SECRET;
  if (!secret) return null;
  return createHmac("sha256", secret).update(ip).digest("hex");
}

export async function hashPassword(password: string) {
  return hash(password, {
    algorithm: 2,
    memoryCost: 19_456,
    timeCost: 2,
    outputLen: 32,
    parallelism: 1,
  });
}

export async function verifyPassword(passwordHash: string, password: string) {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

export async function createUserSession(userId: number) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  await getDb().insert(authSessions).values({
    id: digestToken(token),
    userId,
    expiresAt,
    userAgent: requestHeaders.get("user-agent")?.slice(0, 500) ?? null,
    ipHash: hashIp(forwardedFor),
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const [row] = await getDb()
    .select({
      id: users.id,
      publicId: users.publicId,
      email: users.email,
      name: users.name,
      role: users.role,
      avatarUrl: users.avatarUrl,
      stripeCustomerId: users.stripeCustomerId,
    })
    .from(authSessions)
    .innerJoin(users, eq(authSessions.userId, users.id))
    .where(and(eq(authSessions.id, digestToken(token)), gt(authSessions.expiresAt, new Date())))
    .limit(1);

  return row ?? null;
}

export async function requireUser(nextPath = "/app") {
  const user = await getCurrentUser();
  if (!user) redirect(`/entrar?next=${encodeURIComponent(safeRedirectPath(nextPath))}`);
  return user;
}

export async function requireAdmin(nextPath = "/admin") {
  const user = await requireUser(nextPath);
  if (user.role !== "admin" && user.role !== "editor") redirect("/app");
  return user;
}

export async function requireSuperAdmin(nextPath = "/admin") {
  const user = await requireUser(nextPath);
  if (user.role !== "admin") redirect("/app");
  return user;
}

export async function destroyCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    await getDb().delete(authSessions).where(eq(authSessions.id, digestToken(token)));
  }

  cookieStore.delete(SESSION_COOKIE);
}
