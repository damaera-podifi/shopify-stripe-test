import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { createUserIdFromEmail, normalizeAuthEmail } from "./user-id";

export const STORE_SESSION_COOKIE = "store_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

export type StoreSession = {
  userId: string;
  email: string;
};

type SessionPayload = StoreSession & {
  exp: number;
};

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET?.trim();
  if (!secret) {
    throw new Error("Missing SESSION_SECRET environment variable");
  }
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", getSessionSecret())
    .update(payload)
    .digest("base64url");
}

function encodeSession(session: StoreSession): string {
  const payload = Buffer.from(
    JSON.stringify({
      userId: session.userId,
      email: session.email,
      exp: Date.now() + SESSION_MAX_AGE * 1000,
    } satisfies SessionPayload),
  ).toString("base64url");

  return `${payload}.${sign(payload)}`;
}

function decodeSession(token: string): StoreSession | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) {
    return null;
  }

  const expected = sign(payload);
  try {
    const actual = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (
      actual.length !== expectedBuffer.length ||
      !timingSafeEqual(actual, expectedBuffer)
    ) {
      return null;
    }
  } catch {
    return null;
  }

  try {
    const data = JSON.parse(
      Buffer.from(payload, "base64url").toString(),
    ) as SessionPayload;

    if (!data.userId || !data.email || Date.now() > data.exp) {
      return null;
    }

    return {
      userId: data.userId,
      email: data.email,
    };
  } catch {
    return null;
  }
}

export async function getStoreSession(): Promise<StoreSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(STORE_SESSION_COOKIE)?.value;
  if (!token) {
    return null;
  }

  return decodeSession(token);
}

export async function requireStoreSession(): Promise<StoreSession> {
  const session = await getStoreSession();
  if (!session) {
    throw new Error("You must be signed in");
  }
  return session;
}

export async function setStoreSession(email: string): Promise<StoreSession> {
  const normalizedEmail = normalizeAuthEmail(email);
  const session: StoreSession = {
    email: normalizedEmail,
    userId: createUserIdFromEmail(normalizedEmail),
  };

  const cookieStore = await cookies();
  cookieStore.set(STORE_SESSION_COOKIE, encodeSession(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });

  return session;
}

export async function clearStoreSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(STORE_SESSION_COOKIE);
}
