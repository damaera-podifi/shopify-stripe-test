import type { SessionUser } from "./types";
import { getCustomerSegmentMemberships } from "@/lib/shopify/customer";

export function getTrackedSegmentIds(): string[] {
  const raw = process.env.SHOPIFY_SEGMENT_IDS?.trim();
  if (!raw) return [];
  return raw.split(",").map((id) => id.trim()).filter(Boolean);
}

export async function getUserSegmentMemberships(user: SessionUser) {
  if (!user.shopifyCustomerId) return [];
  const segmentIds = getTrackedSegmentIds();
  if (!segmentIds.length) return [];
  return getCustomerSegmentMemberships(user.shopifyCustomerId, segmentIds);
}

export async function userHasAnySegment(user: SessionUser): Promise<boolean> {
  const memberships = await getUserSegmentMemberships(user);
  return memberships.some((m) => m.isMember);
}
