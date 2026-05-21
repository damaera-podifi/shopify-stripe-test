import { createHash } from "crypto";

export const APP_USER_ID_NAMESPACE = "app";
export const APP_USER_ID_KEY = "user_id";

export function normalizeAuthEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function createUserIdFromEmail(email: string): string {
  return createHash("sha256")
    .update(normalizeAuthEmail(email))
    .digest("hex");
}
