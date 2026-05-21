import { timingSafeEqual } from "crypto";
import { readJsonFile } from "./json-db";
import { createUserIdFromEmail, normalizeAuthEmail } from "./user-id";

export type StoreUserRecord = {
  email: string;
  password: string;
  is_membership_active: boolean;
};

type UsersFile = {
  users: StoreUserRecord[];
};

function passwordsMatch(expected: string, actual: string): boolean {
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }
  return timingSafeEqual(expectedBuffer, actualBuffer);
}

export async function findUserByCredentials(
  email: string,
  password: string,
): Promise<StoreUserRecord | null> {
  const normalizedEmail = normalizeAuthEmail(email);
  const { users } = await readJsonFile<UsersFile>("users.json");
  const user = users.find(
    (record) => normalizeAuthEmail(record.email) === normalizedEmail,
  );

  if (!user || !passwordsMatch(user.password, password)) {
    return null;
  }

  return user;
}

export function userRecordToSessionFields(user: StoreUserRecord) {
  const email = normalizeAuthEmail(user.email);
  return {
    email,
    userId: createUserIdFromEmail(email),
    isMembershipActive: user.is_membership_active,
  };
}
