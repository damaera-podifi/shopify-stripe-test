import { randomUUID } from "crypto";
import { readJsonFile, writeJsonFile } from "./json-db";

const SESSION_MAX_AGE_MS = 60 * 60 * 24 * 30 * 1000;

export type PersistedStoreSession = {
  userId: string;
  email: string;
  isMembershipActive: boolean;
  shopifyCustomerAccessToken?: string;
  shopifyCustomerAccessTokenExpiresAt?: number;
  expiresAt: number;
};

type SessionsFile = {
  sessions: Record<string, PersistedStoreSession>;
};

type AuthStateFile = {
  activeSessionId: string | null;
};

async function readSessionsFile(): Promise<SessionsFile> {
  return readJsonFile<SessionsFile>("sessions.json");
}

async function readAuthStateFile(): Promise<AuthStateFile> {
  return readJsonFile<AuthStateFile>("auth-state.json");
}

function pruneExpiredSessions(sessions: SessionsFile["sessions"]) {
  const now = Date.now();
  for (const [sessionId, session] of Object.entries(sessions)) {
    if (session.expiresAt <= now) {
      delete sessions[sessionId];
    }
  }
}

export async function createPersistedSession(
  session: Omit<PersistedStoreSession, "expiresAt">,
): Promise<string> {
  const sessionsFile = await readSessionsFile();
  pruneExpiredSessions(sessionsFile.sessions);

  const sessionId = randomUUID();
  sessionsFile.sessions[sessionId] = {
    ...session,
    expiresAt: Date.now() + SESSION_MAX_AGE_MS,
  };

  await writeJsonFile("sessions.json", sessionsFile);
  await writeJsonFile("auth-state.json", { activeSessionId: sessionId });

  return sessionId;
}

export async function getActivePersistedSession(): Promise<PersistedStoreSession | null> {
  const [{ activeSessionId }, sessionsFile] = await Promise.all([
    readAuthStateFile(),
    readSessionsFile(),
  ]);

  if (!activeSessionId) {
    return null;
  }

  const session = sessionsFile.sessions[activeSessionId];
  if (!session || session.expiresAt <= Date.now()) {
    if (session || activeSessionId) {
      await clearPersistedSession(activeSessionId);
    }
    return null;
  }

  return session;
}

export async function updatePersistedSession(
  updates: Partial<
    Pick<
      PersistedStoreSession,
      | "shopifyCustomerAccessToken"
      | "shopifyCustomerAccessTokenExpiresAt"
    >
  >,
): Promise<PersistedStoreSession | null> {
  const [{ activeSessionId }, sessionsFile] = await Promise.all([
    readAuthStateFile(),
    readSessionsFile(),
  ]);

  if (!activeSessionId) {
    return null;
  }

  const session = sessionsFile.sessions[activeSessionId];
  if (!session) {
    return null;
  }

  sessionsFile.sessions[activeSessionId] = {
    ...session,
    ...updates,
  };

  await writeJsonFile("sessions.json", sessionsFile);
  return sessionsFile.sessions[activeSessionId];
}

export async function clearPersistedSession(
  sessionId?: string | null,
): Promise<void> {
  const [authState, sessionsFile] = await Promise.all([
    readAuthStateFile(),
    readSessionsFile(),
  ]);

  const targetId = sessionId ?? authState.activeSessionId;
  if (targetId) {
    delete sessionsFile.sessions[targetId];
    await writeJsonFile("sessions.json", sessionsFile);
  }

  if (!sessionId || authState.activeSessionId === sessionId) {
    await writeJsonFile("auth-state.json", { activeSessionId: null });
  }
}
