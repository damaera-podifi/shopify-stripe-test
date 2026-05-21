import { provisionShopifyCustomerFromAppUser } from "@/lib/shopify/customer-provision";
import { syncCartForActiveSession } from "@/lib/shopify/cart-membership";
import {
  clearPersistedSession,
  createPersistedSession,
  getActivePersistedSession,
  type PersistedStoreSession,
} from "./sessions-db";
import {
  findUserByCredentials,
  userRecordToSessionFields,
  type StoreUserRecord,
} from "./users-db";

export type StoreSession = {
  userId: string;
  email: string;
  isMembershipActive: boolean;
};

function toStoreSession(session: PersistedStoreSession): StoreSession {
  return {
    userId: session.userId,
    email: session.email,
    isMembershipActive: session.isMembershipActive,
  };
}

export async function getStoreSession(): Promise<StoreSession | null> {
  const session = await getActivePersistedSession();
  if (!session) {
    return null;
  }

  return toStoreSession(session);
}

export async function requireStoreSession(): Promise<StoreSession> {
  const session = await getStoreSession();
  if (!session) {
    throw new Error("You must be signed in");
  }
  return session;
}

export async function setStoreSessionFromUser(
  user: StoreUserRecord,
): Promise<StoreSession> {
  const fields = userRecordToSessionFields(user);

  await createPersistedSession(fields);

  try {
    await provisionShopifyCustomerFromAppUser(user);
  } catch {
    // App login still succeeds; Shopify sync can be retried on next cart read.
  }

  try {
    await syncCartForActiveSession();
  } catch {
    // Cart may not exist yet at login.
  }

  return fields;
}

export async function authenticateStoreUser(
  email: string,
  password: string,
): Promise<
  | { ok: true; session: StoreSession }
  | { ok: false; error: string }
> {
  const user = await findUserByCredentials(email, password);
  if (!user) {
    return { ok: false, error: "Invalid email or password" };
  }

  const session = await setStoreSessionFromUser(user);
  return { ok: true, session };
}

export async function clearStoreSession(): Promise<void> {
  await clearPersistedSession();
}
