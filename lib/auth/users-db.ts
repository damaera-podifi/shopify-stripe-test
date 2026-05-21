import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { UserRecord, UsersDatabase } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const USERS_PATH = path.join(DATA_DIR, "users.json");

async function ensureDataDir() {
  await mkdir(DATA_DIR, { recursive: true });
}

async function readDb(): Promise<UsersDatabase> {
  await ensureDataDir();
  try {
    const raw = await readFile(USERS_PATH, "utf8");
    const parsed = JSON.parse(raw) as UsersDatabase;
    if (!Array.isArray(parsed.users)) {
      return { users: [] };
    }
    return parsed;
  } catch {
    return { users: [] };
  }
}

async function writeDb(db: UsersDatabase) {
  await ensureDataDir();
  await writeFile(USERS_PATH, `${JSON.stringify(db, null, 2)}\n`, "utf8");
}

export async function findUserByEmail(
  email: string,
): Promise<UserRecord | undefined> {
  const normalized = email.trim().toLowerCase();
  const db = await readDb();
  return db.users.find((u) => u.email === normalized);
}

export async function findUserById(id: string): Promise<UserRecord | undefined> {
  const db = await readDb();
  return db.users.find((u) => u.id === id);
}

export async function createUser(input: {
  email: string;
  password: string;
  shopifyCustomerId?: string | null;
}): Promise<UserRecord> {
  const email = input.email.trim().toLowerCase();
  const existing = await findUserByEmail(email);
  if (existing) {
    throw new Error("An account with this email already exists");
  }

  const user: UserRecord = {
    id: randomUUID(),
    email,
    password: input.password,
    shopifyCustomerId: input.shopifyCustomerId ?? null,
    createdAt: new Date().toISOString(),
  };

  const db = await readDb();
  db.users.push(user);
  await writeDb(db);
  return user;
}

export async function updateUserShopifyCustomerId(
  userId: string,
  shopifyCustomerId: string,
): Promise<UserRecord> {
  const db = await readDb();
  const index = db.users.findIndex((u) => u.id === userId);
  if (index === -1) {
    throw new Error("User not found");
  }
  db.users[index] = { ...db.users[index], shopifyCustomerId };
  await writeDb(db);
  return db.users[index];
}
