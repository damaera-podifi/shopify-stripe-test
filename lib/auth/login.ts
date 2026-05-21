import type { SessionUser } from "./types";
import {
  createUser,
  findUserByEmail,
  updateUserMembership,
  updateUserShopifyCustomerId,
} from "./users-db";
import { getTrackedSegmentIds } from "./segments";
import { createSession } from "./session";
import { ensureShopifyCustomer } from "@/lib/shopify/customer";
import {
  getAdminMemberPricing,
  resolveShopifyCustomerIdForEmail,
} from "@/lib/shopify/admin-member-pricing";
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
    isMembership: Boolean(user.isMembership),
    shopifyStorefrontAccessToken: user.shopifyStorefrontAccessToken ?? null,
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

  let shopifyCustomerId = await resolveShopifyCustomerIdForEmail(
    email,
    user.shopifyCustomerId,
  );
  if (!shopifyCustomerId) {
    shopifyCustomerId = await ensureShopifyCustomer(email);
  }
  if (shopifyCustomerId !== user.shopifyCustomerId) {
    await updateUserShopifyCustomerId(user.id, shopifyCustomerId);
  }

  let isMembership = Boolean(user.isMembership);
  if (getTrackedSegmentIds().length > 0) {
    const adminPricing = await getAdminMemberPricing({
      email,
      shopifyCustomerId,
    }).catch(() => null);
    if (adminPricing) {
      isMembership = adminPricing.isMember;
      if (isMembership !== Boolean(user.isMembership)) {
        await updateUserMembership(user.id, isMembership);
      }
    }
  }

  await createSession(user.id);
  const updated = await findUserByEmail(email);
  const sessionUser: SessionUser = {
    id: user.id,
    email: user.email,
    shopifyCustomerId,
    isMembership,
    shopifyStorefrontAccessToken:
      updated?.shopifyStorefrontAccessToken ?? null,
  };
  await syncCartBuyerIdentity(sessionUser).catch(() => {});
  return sessionUser;
}
