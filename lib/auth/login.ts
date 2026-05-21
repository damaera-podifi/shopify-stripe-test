import type { SessionUser } from "./types";
import {
  createUser,
  findUserByEmail,
  updateUserShopifyCustomerId,
} from "./users-db";
import { createSession } from "./session";
import { ensureShopifyCustomer } from "@/lib/shopify/customer";
import { syncCartBuyerIdentity } from "@/lib/shopify/cart-buyer";

export async function registerUser(input: {
  email: string;
  password: string;
}): Promise<SessionUser> {
  const email = input.email.trim().toLowerCase();
  if (!email || !input.password) {
    throw new Error("Email and password are required");
  }
  const shopifyCustomerId = await ensureShopifyCustomer(email);
  const user = await createUser({
    email,
    password: input.password,
    shopifyCustomerId,
  });

  await createSession(user.id);
  const sessionUser: SessionUser = {
    id: user.id,
    email: user.email,
    shopifyCustomerId: user.shopifyCustomerId,
  };
  await syncCartBuyerIdentity(sessionUser).catch(() => {});
  return sessionUser;
}

export async function loginUser(input: {
  email: string;
  password: string;
}): Promise<SessionUser> {
  const email = input.email.trim().toLowerCase();
  const user = await findUserByEmail(email);
  if (!user) {
    throw new Error("Invalid email or password");
  }

  if (user.password !== input.password) {
    throw new Error("Invalid email or password");
  }

  let shopifyCustomerId = user.shopifyCustomerId;
  if (!shopifyCustomerId) {
    shopifyCustomerId = await ensureShopifyCustomer(email);
    await updateUserShopifyCustomerId(user.id, shopifyCustomerId);
  }

  await createSession(user.id);
  const sessionUser: SessionUser = {
    id: user.id,
    email: user.email,
    shopifyCustomerId,
  };
  await syncCartBuyerIdentity(sessionUser).catch(() => {});
  return sessionUser;
}
